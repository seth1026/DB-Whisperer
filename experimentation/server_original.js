// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'perfdb',
  password: process.env.PGPASSWORD || 'postgres',
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
});

/* -------------------------
   PROFESSIONAL LOAD SIM
   ------------------------- */
let cpuTrend = 0;
let ioTrend = 0;
const simulateLoad = (type) => {
  const baseCpu = type === "unoptimized" ? 78 : 22;
  const baseIo = type === "unoptimized" ? 42 : 6;
  cpuTrend += (Math.random() - 0.5) * 4;
  ioTrend += (Math.random() - 0.5) * 3;
  cpuTrend = Math.max(-10, Math.min(10, cpuTrend));
  ioTrend = Math.max(-8, Math.min(8, ioTrend));
  return {
    cpu: Math.max(1, Math.round(baseCpu + cpuTrend)),
    io: Math.max(1, Math.round(baseIo + ioTrend)),
  };
};

/* =====================
   INDEX SUGGESTIONS
   ===================== */
function suggestIndexes(plan, query) {
  const suggestions = [];
  const lowerPlan = (plan || '').toLowerCase();
  const lowerQuery = (query || '').toLowerCase();

  if (lowerPlan.includes("seq scan")) {
    const match = lowerQuery.match(/where\s+([a-z_][a-z0-9_]*)\s*=/i);
    if (match) {
      const col = match[1];
      suggestions.push(`CREATE INDEX idx_${col} ON sales(${col});`);
    } else {
      suggestions.push('Consider adding an index on filtered columns.');
    }
  }

  if (lowerQuery.includes(`like '%`)) {
    suggestions.push(
      "CREATE INDEX idx_sales_product_fts ON sales USING GIN(to_tsvector('english', product_name));"
    );
  }

  return suggestions;
}

/* =====================
   PLAN ANALYSIS
   ===================== */
function analyzePlan(plan, duration) {
  const lines = (plan || '').toLowerCase();
  let score = 100;
  const issues = [];
  const suggestions = [];

  if (lines.includes('seq scan')) {
    score -= 40;
    issues.push('Full table scan detected');
    suggestions.push('Add index on filtered column');
  }
  if (lines.includes('filter')) {
    score -= 20;
    suggestions.push('Use index or rewrite condition');
  }
  if (duration > 1000) {
    score -= 30;
    issues.push(`Slow query: ${duration.toFixed(0)}ms`);
  }
  if (lines.includes('materialized view')) {
    score += 20;
  }
  if (lines.includes('index scan')) {
    score += 30;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    suggestions,
    verdict: score > 80 ? 'Excellent' : score > 60 ? 'Good' : score > 40 ? 'Needs Work' : 'Poor',
  };
}

/* =====================
   PARSE EXPLAIN -> TREE (more robust indent handling)
   ===================== */
function parsePlanToTree(plan) {
  if (!plan) return [];

  const lines = plan.split('\n').map(l => l.replace(/\r/g, ''));
  const filtered = lines.filter(l => l.trim().length > 0);

  const nodes = filtered.map(line => {
    const match = line.match(/^(\s*)/);
    const spaces = match ? match[1].length : 0;

    // heuristic to map spaces -> levels:
    // many EXPLAIN outputs indent by 2,4,6 or tab-like steps. Map:
    // 0 => 0, 1-3 => 1, 4-6 => 2, 7-10 => 3, else floor(spaces/4)
    let level;
    if (spaces === 0) level = 0;
    else if (spaces <= 3) level = 1;
    else if (spaces <= 6) level = 2;
    else if (spaces <= 10) level = 3;
    else level = Math.floor(spaces / 4);

    return { text: line.trim(), level, children: [] };
  });

  const root = [];
  const stack = [];

  nodes.forEach(node => {
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(node);
      stack.push(node);
    } else {
      const parent = stack[stack.length - 1];
      parent.children.push(node);
      stack.push(node);
    }
  });

  return root;
}

/* =====================
   NATURAL LANGUAGE EXPLAINER
   ===================== */
function makeExplanation(plan, analysis, suggestions, duration) {
  const lines = [];
  lines.push(`Query took ${Math.round(duration)} ms.`);

  if (!analysis || (analysis.issues || []).length === 0) {
    lines.push('The planner shows no obvious issues; the query appears well-optimized.');
  } else {
    lines.push('Found issues: ' + analysis.issues.join('; ') + '.');
  }

  const lower = (plan || '').toLowerCase();
  if (lower.includes('seq scan')) {
    lines.push('Planner used a sequential scan which indicates no useful index for the filtering column(s).');
  }
  if (lower.includes('index scan')) {
    lines.push('Index scans are present — that is usually fast for selective filters.');
  }
  if (lower.includes('materialized view')) {
    lines.push('A materialized view is used — materialized views can speed aggregated/complex queries.');
  }

  if (suggestions && suggestions.length > 0) {
    lines.push('Recommended actions:');
    suggestions.slice(0, 3).forEach(s => lines.push(` • ${s}`));
  } else {
    lines.push('No automatic index suggestions were generated. Consider analyzing column selectivity or rewriting the filter.');
  }

  const score = (analysis && analysis.score) || 0;
  lines.push(score > 80 ? 'Overall: good performance.' : score > 60 ? 'Overall: acceptable, some improvements possible.' : score > 40 ? 'Overall: needs improvement — consider adding indexes or rewriting queries.' : 'Overall: poor — prioritize indexing or query rewrite.');

  return lines.join(' ');
}

/* =====================
   INDEX CONFIDENCE SCORE (0-100)
   ===================== */
function computeIndexConfidence(plan, suggestions, duration) {
  let confidence = 40;
  const lower = (plan || '').toLowerCase();

  if (lower.includes('seq scan')) confidence += 30;
  if (lower.includes('index scan')) confidence -= 10;
  if (lower.includes('filter')) confidence += 10;
  if (duration > 2000) confidence += 15;
  if ((suggestions || []).length >= 1) confidence += 10;
  if ((suggestions || []).some(s => s.toLowerCase().includes('gin'))) confidence -= 5;

  return Math.max(0, Math.min(100, Math.round(confidence)));
}

/* =====================
   SOCKET HANDLER
   ===================== */
io.on('connection', (socket) => {
  console.log('Client connected');

  socket.on("runQuery", async ({ query: userQuery = "", mode = "normal" }) => {
    let interval;
    const start = Date.now();
    const requestedQuery = (userQuery || "").trim();

    try {
      const query = requestedQuery;
      if (!query || !/^SELECT\s/i.test(query)) {
        socket.emit("error", "Only SELECT queries allowed!");
        return;
      }

      // detect slow-ish queries heuristically
      const isSlow = /sales.*product_name|like\s*'%/i.test(query);

      // immediate metric snapshot
      const initialLoad = simulateLoad(isSlow ? 'unoptimized' : 'optimized');
      socket.emit('metrics', { timestamp: Date.now(), ...initialLoad, latency: Date.now() - start });

      // streaming metrics while running
      interval = setInterval(() => {
        const load = simulateLoad(isSlow ? 'unoptimized' : 'optimized');
        socket.emit('metrics', { timestamp: Date.now(), ...load, latency: Date.now() - start });
      }, 200);

      // run EXPLAIN ANALYZE
      const explainRes = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, VERBOSE) ${query}`);
      const plan = explainRes.rows.map(r => r["QUERY PLAN"]).join("\n");

      // run actual query (to measure) - note: SELECT only
      const queryStart = Date.now();
      await pool.query(query);
      const actualDuration = Date.now() - queryStart;

      // analysis & suggestions
      const analysis = analyzePlan(plan, actualDuration);
      const suggestions = suggestIndexes(plan, query);
      const planTree = parsePlanToTree(plan);
      const explanation = makeExplanation(plan, analysis, suggestions, actualDuration);
      const indexConfidence = computeIndexConfidence(plan, suggestions, actualDuration);

      clearInterval(interval);

      // DEBUG log (optional)
      console.log('queryComplete -> duration:', actualDuration, 'confidence:', indexConfidence);

      socket.emit("queryComplete", {
        mode,
        duration: actualDuration,
        plan,
        analysis,
        suggestions,
        planTree,
        explanation,
        indexConfidence,
      });
    } catch (err) {
      clearInterval(interval);
      console.error("runQuery error:", err);
      socket.emit("error", err.message || String(err));
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

server.listen(process.env.PORT || 4000, () => console.log(`Backend running on http://localhost:${process.env.PORT || 4000}`));
