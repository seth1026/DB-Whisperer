// backend/server.js
require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const os = require("os");

/* ===================== APP SETUP ===================== */
const app = express();
const server = http.createServer(app);

/* ===================== ALLOWED ORIGINS ===================== */
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://db-whisperer.vercel.app" // replace after frontend deploy
];

/* ===================== EXPRESS CORS ===================== */
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true
  })
);

/* ===================== SOCKET.IO (CRITICAL FIX) ===================== */
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

/* ===================== POSTGRES ===================== */
const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT),
  ssl: { rejectUnauthorized: false }
});

/* ===================== HEALTH CHECK ===================== */
app.get("/", (req, res) => {
  res.send("Backend running successfully");
});

/* ===================== SYSTEM METRICS ===================== */
let lastCpuInfo = os.cpus().map(cpu => ({ ...cpu.times }));

setInterval(() => {
  const cpus = os.cpus();
  let cpuPercent = 0;

  cpus.forEach((cpu, i) => {
    const prev = lastCpuInfo[i];
    const curr = cpu.times;
    const prevTotal = Object.values(prev).reduce((a, b) => a + b, 0);
    const currTotal = Object.values(curr).reduce((a, b) => a + b, 0);
    const totalDiff = currTotal - prevTotal;
    const idleDiff = curr.idle - prev.idle;
    cpuPercent += totalDiff > 0 ? 100 * (1 - idleDiff / totalDiff) : 0;
  });

  cpuPercent /= cpus.length;
  lastCpuInfo = cpus.map(c => ({ ...c.times }));

  const ramPercent =
    ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;

  io.emit("metrics", {
    timestamp: Date.now(),
    cpu: Math.round(cpuPercent),
    ram: Math.round(ramPercent),
    io: Math.round(Math.random() * 40 + 10),
    latency: 0
  });
}, 500);

/* ===================== HELPERS ===================== */
function analyzePlan(plan, duration) {
  let score = 100;
  if (plan.toLowerCase().includes("seq scan")) score -= 40;
  if (duration > 1000) score -= 30;
  if (duration > 2000) score -= 20;

  return {
    score: Math.max(score, 0),
    verdict:
      score > 80 ? "Excellent" :
      score > 60 ? "Good" :
      score > 40 ? "Slow" : "Very Slow"
  };
}

function suggestIndexes(plan, query) {
  const suggestions = [];
  if (plan.toLowerCase().includes("seq scan")) {
    const match = query.match(/where\s+([a-z_]+)/i);
    if (match) {
      suggestions.push(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_${match[1]} ON sales(${match[1]});`
      );
    }
  }
  return suggestions.length ? suggestions : ["No strong index suggestion detected"];
}

function parsePlanToTree(plan) {
  return plan.split("\n").map(line => ({ text: line }));
}

function makeExplanation(plan, analysis, duration) {
  if (analysis.score > 80)
    return "PostgreSQL used an efficient execution plan.";
  if (plan.toLowerCase().includes("seq scan"))
    return "Sequential scan detected. Indexing may improve performance.";
  return "Query performance can be improved.";
}

function computeIndexConfidence(plan, duration) {
  if (plan.toLowerCase().includes("seq scan") && duration > 500) return 85;
  if (duration > 1000) return 60;
  return 30;
}

/* ===================== SOCKET HANDLERS ===================== */
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("runQuery", async ({ query }) => {
    let interval;
    const start = Date.now();

    try {
      if (!query || !/^select/i.test(query.trim())) {
        socket.emit("error", "Only SELECT queries are allowed");
        return;
      }

      // Ensure correct schema
      await pool.query("SET search_path TO public");

      interval = setInterval(() => {
        socket.emit("metrics", { latency: Date.now() - start });
      }, 100);

      const explainRes = await pool.query(
        `EXPLAIN (ANALYZE, BUFFERS, VERBOSE) ${query}`
      );

      const plan = explainRes.rows.map(r => r["QUERY PLAN"]).join("\n");

      const qStart = Date.now();
      await pool.query(query);
      const duration = Date.now() - qStart;

      clearInterval(interval);

      const analysis = analyzePlan(plan, duration);

      socket.emit("queryComplete", {
        duration,
        plan,
        analysis,
        suggestions: suggestIndexes(plan, query),
        planTree: parsePlanToTree(plan),
        explanation: makeExplanation(plan, analysis, duration),
        indexConfidence: computeIndexConfidence(plan, duration)
      });

    } catch (err) {
      clearInterval(interval);

      console.error("=========== QUERY ERROR ===========");
      console.error("Message:", err.message);
      console.error("Code:", err.code);
      console.error("===================================");

      socket.emit("error", err.message);
    }
  });

  socket.on("applyIndex", async ({ sql }) => {
    try {
      const safeSql = sql.replace(
        /^CREATE INDEX/i,
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS"
      );
      await pool.query(safeSql);
      socket.emit("indexCreated", { message: "Index created successfully" });
    } catch (err) {
      console.error("INDEX ERROR:", err.message);
      socket.emit("error", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

/* ===================== START SERVER ===================== */
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
