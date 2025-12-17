// backend/server.js - Updated & Fully Compatible with Your Frontend

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);

// Allow frontend from any origin during development (you can restrict later)
const io = new Server(server, {
  cors: {
    origin: "*", // Or specifically "http://localhost:3000"
    methods: ["GET", "POST"]
  }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Simple load simulation based on query pattern
const simulateLoad = (isSlow) => ({
  cpu: isSlow ? 65 + Math.random() * 30 : 10 + Math.random() * 20,
  ram: isSlow ? 40 + Math.random() * 30 : 15 + Math.random() * 15,
  io: isSlow ? 35 + Math.random() * 35 : 3 + Math.random() * 10,
});

// Analyze EXPLAIN plan and generate rich feedback
function analyzePlan(planText, duration) {
  const lines = planText.toLowerCase();
  let score = 100;
  const issues = [];
  const suggestions = [];

  if (lines.includes('seq scan') || lines.includes('sequential scan')) {
    score -= 50;
    issues.push('Full table scan detected — very slow on large tables');
    suggestions.push('CREATE INDEX CONCURRENTLY ON sales (category_id);');
    suggestions.push('CREATE INDEX CONCURRENTLY ON sales USING gin (to_tsvector(\'english\', product_name));');
  }

  if (lines.includes('filter') && !lines.includes('index scan')) {
    score -= 25;
    issues.push('Row-by-row filtering — index not fully utilized');
    suggestions.push('Rewrite condition to be index-friendly (e.g., avoid leading % in LIKE)');
  }

  if (lines.includes('index scan')) {
    score += 30;
    suggestions.push('Great! Using an index scan');
  }

  if (lines.includes('bitmap')) {
    score += 20;
    suggestions.push('Efficient bitmap index scan used');
  }

  if (duration > 2000) score -= 30;
  else if (duration > 500) score -= 15;

  const verdict =
    score >= 85 ? 'Excellent' :
    score >= 70 ? 'Good' :
    score >= 50 ? 'Needs Improvement' :
    'Poor';

  // Confidence that an index will help
  const indexConfidence = lines.includes('seq scan') || duration > 500 ? 90 : 30;

  // Natural language explanation
  const explanation = lines.includes('seq scan')
    ? "Your query caused a full table scan because there's no supporting index. This is very slow on large datasets."
    : lines.includes('index scan')
    ? "Great! PostgreSQL used an index to quickly locate the rows."
    : "The query executed successfully. Performance is acceptable.";

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    verdict,
    explanation,
    indexConfidence,
    suggestions: suggestions.length > 0 ? suggestions : ['Your query is already well-optimized!'],
  };
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('runQuery', async ({ query: userQuery }) => {
    if (!userQuery || !userQuery.trim()) {
      socket.emit('error', 'No query provided');
      return;
    }

    const query = userQuery.trim();

    // SECURITY: Only allow SELECT queries
    if (!/^SELECT\s/i.test(query)) {
      socket.emit('error', 'Only SELECT queries are allowed for safety');
      return;
    }

    const startTime = Date.now();
    let interval = null;

    try {
      // Determine if this query looks slow (for realistic simulated load)
      const looksSlow = /LIKE\s*'%.*%'/i.test(query) || /product_name/i.test(query);

      // Stream simulated real-time metrics
      interval = setInterval(() => {
        const load = simulateLoad(looksSlow);
        socket.emit('metrics', {
          timestamp: Date.now(),
          cpu: load.cpu,
          ram: load.ram,
          io: load.io,
          latency: Date.now() - startTime,
        });
      }, 150); // Slightly slower for smoother chart

      // Run EXPLAIN ANALYZE to get the actual plan
      const explainRes = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, VERBOSE) ${query}`);
      const plan = explainRes.rows.map(row => row['QUERY PLAN']).join('\n');

      // Execute the real query to measure true duration
      const execStart = Date.now();
      await pool.query(query);
      const actualDuration = Date.now() - execStart;

      // Stop metrics streaming
      if (interval) clearInterval(interval);

      // Generate analysis
      const analysis = analyzePlan(plan, actualDuration);

      // Send complete result — matches your frontend perfectly!
      socket.emit('queryComplete', {
        duration: actualDuration,
        plan,
        explanation: analysis.explanation,
        analysis: {
          score: analysis.score,
          verdict: analysis.verdict,
        },
        indexConfidence: analysis.indexConfidence,
        suggestions: analysis.suggestions,
      });

    } catch (err) {
      if (interval) clearInterval(interval);
      console.error('Query error:', err);
      socket.emit('error', err.message || 'Query execution failed');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Connect your frontend to this server via socket.io`);
});   