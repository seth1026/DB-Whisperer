require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const app = express();

/* ===================== CORS ===================== */
app.use(cors({
  origin: [
    "http://localhost:3000"
  ],
  credentials: true
}));

app.use(express.json());

/* ===================== SERVER ===================== */
const server = http.createServer(app);

/* ===================== SOCKET.IO ===================== */
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

/* ===================== POSTGRES ===================== */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===================== SOCKET HANDLERS ===================== */
io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("runQuery", async ({ query }) => {
    try {
      if (!query || !query.trim().toUpperCase().startsWith("SELECT")) {
        throw new Error("Only SELECT queries allowed");
      }

      const explain = await pool.query(
        `EXPLAIN (ANALYZE, BUFFERS) ${query}`
      );

      const result = await pool.query(query);

      socket.emit("queryComplete", {
        plan: explain.rows.map(r => r["QUERY PLAN"]).join("\n"),
        rows: result.rows,
        duration: explain.rows.at(-1)?.["QUERY PLAN"] || "N/A"
      });

    } catch (err) {
      console.error("runQuery error:", err);
      socket.emit("error", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

/* ===================== START ===================== */
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
