// src/App.js - DB-Whisperer ULTIMATE FINAL (Original Style + Fixed Socket URL)

import React, { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import io from "socket.io-client";
import { Copy, AlertTriangle, Moon, Sun, Sparkles, Zap, CheckCircle } from "lucide-react";

// Smart socket URL handling
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";
const SOCKET_URL = BACKEND_URL.replace(/^http/, "ws").replace(/^https/, "wss");

function TreeNode({ node }) {
  if (!node || !node.children || node.children.length === 0) {
    return <div className="pl-6 text-sm font-mono">{node?.text || ""}</div>;
  }
  return (
    <details className="pl-4 border-l-2 border-purple-500/30" open>
      <summary className="cursor-pointer font-mono text-sm hover:text-purple-400 font-semibold">
        {node.text}
      </summary>
      <div className="ml-4">
        {node.children.map((c, i) => <TreeNode node={c} key={i} />)}
      </div>
    </details>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState([]);
  const [afterMetrics, setAfterMetrics] = useState([]);
  const [result, setResult] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  const handleLogin = (e) => {
    e.preventDefault();
    const mockToken = btoa("user:password");
    localStorage.setItem("jwt", mockToken);
    setIsAuthenticated(true);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = io(SOCKET_URL, {
      auth: { token: localStorage.getItem("jwt") },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("metrics", (data) => {
      setMetrics((prev) => [...prev.slice(-120), data]);
      if (compareMode) setAfterMetrics((prev) => [...prev.slice(-120), data]);
    });

    socket.on("queryComplete", (data) => {
      setIsRunning(false);
      setResult(data);
    });

    socket.on("indexCreated", () => {
      alert("Index created successfully! Re-running query to show improvement...");
      setCompareMode(true);
      runQuery();
    });

    socket.on("error", (msg) => {
      alert("Error: " + msg);
      setIsRunning(false);
    });

    return () => socket.disconnect();
  }, [isAuthenticated, compareMode]);

  const runQuery = () => {
    if (!socketRef.current || isRunning || !customQuery.trim()) return;
    setIsRunning(true);
    setMetrics([]);
    setAfterMetrics([]);
    setResult(null);
    socketRef.current.emit("runQuery", { query: customQuery });
  };

  const applyIndex = (sql) => {
    if (window.confirm("Create this index with zero downtime? (CONCURRENTLY)")) {
      socketRef.current.emit("applyIndex", { sql });
      setIsRunning(true);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => alert("Copied!"));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-xl p-12 rounded-3xl shadow-2xl max-w-md w-full">
          <h1 className="text-6xl font-black text-white text-center mb-8">DB-Whisperer</h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <input defaultValue="user" className="w-full p-4 rounded-xl bg-white/20 placeholder-white/70 text-white text-lg" placeholder="Username" required />
            <input type="password" defaultValue="password" className="w-full p-4 rounded-xl bg-white/20 placeholder-white/70 text-white text-lg" placeholder="Password" required />
            <button type="submit" className="w-full bg-white text-purple-600 py-5 rounded-xl font-bold text-2xl hover:scale-105 transition">
              Enter the Matrix
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all ${darkMode ? 'dark bg-gray-950' : 'bg-gradient-to-br from-purple-50 to-pink-50'}`}>
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-6xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            DB-Whisperer <span className="text-4xl">ULTIMATE</span>
          </h1>
          <button onClick={() => setDarkMode(!darkMode)} className="p-4 rounded-full bg-gray-200 dark:bg-gray-800 hover:scale-110 transition">
            {darkMode ? <Sun className="w-8 h-8" /> : <Moon className="w-8 h-8" />}
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-10">
          {/* Left Panel */}
          <div className="space-y-8">
            {/* Query Input */}
            <div className="bg-white/80 dark:bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
              <h3 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Sparkles className="w-10 h-10 text-purple-600" /> Your Query
              </h3>
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="SELECT * FROM sales WHERE category_id = 42;"
                className="w-full h-48 p-6 font-mono text-lg bg-black/70 text-green-400 rounded-2xl focus:ring-4 focus:ring-purple-600 outline-none resize-none"
              />
              {/* Bad Practice Warnings */}
              {customQuery.includes("SELECT *") && (
                <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/60 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-6 h-6" />
                  <span className="font-semibold">Avoid SELECT * in production</span>
                </div>
              )}
              {customQuery.toLowerCase().includes("like '%") && (
                <div className="mt-4 p-4 bg-orange-100 dark:bg-orange-900/60 rounded-xl flex items-center gap-3 text-orange-700 dark:text-orange-300">
                  <AlertTriangle className="w-6 h-6" />
                  <span className="font-semibold">Leading % prevents index usage</span>
                </div>
              )}
              <div className="flex gap-4 mt-8">
                <button
                  onClick={runQuery}
                  disabled={isRunning || !customQuery.trim()}
                  className="flex-1 py-5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xl rounded-2xl hover:scale-105 transition disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <Zap className="w-8 h-8" />
                  {isRunning ? "Analyzing..." : "Run & Analyze"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <button onClick={() => setCustomQuery("SELECT * FROM sales WHERE product_name LIKE '%Laptop%'")} className="py-3 bg-red-500/20 text-red-700 rounded-xl font-semibold hover:bg-red-500/30 transition">
                  Load Slow Query
                </button>
                <button onClick={() => setCustomQuery("SELECT * FROM sales WHERE category_id = 10")} className="py-3 bg-green-500/20 text-green-700 rounded-xl font-semibold hover:bg-green-500/30 transition">
                  Load Fast Query
                </button>
              </div>
            </div>

            {/* USER-FRIENDLY EXPLANATION SECTION - KEPT EXACTLY AS YOU HAD IT */}
            {result && (
              <div className="bg-white/80 dark:bg-gray-900/90 backdrop-blur-xl rounded-3xl p-10 shadow-2xl space-y-10">
                <h3 className="text-5xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent text-center">
                  What Just Happened? (In Plain English)
                </h3>
                {/* Duration Card */}
                <div className="flex items-center gap-8 p-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-3xl text-white shadow-xl">
                  <Zap className="w-20 h-20" />
                  <div>
                    <p className="text-3xl font-bold">Query Duration</p>
                    <p className="text-8xl font-black">{result.duration.toFixed(1)} ms</p>
                    <p className="text-2xl mt-4 opacity-90">
                      {result.duration < 100 ? "Lightning fast! ⚡" :
                       result.duration < 500 ? "Pretty good! 👍" :
                       result.duration < 2000 ? "A bit slow... 😬" : "Ouch! This needs help 🔥"}
                    </p>
                  </div>
                </div>
                {/* Overall Verdict */}
                <div className={`p-10 rounded-3xl text-white text-center shadow-xl ${
                  result.analysis.score > 80 ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
                  result.analysis.score > 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                  'bg-gradient-to-r from-red-500 to-pink-600'
                }`}>
                  <p className="text-4xl font-bold">Overall Verdict</p>
                  <p className="text-9xl font-black mt-6">{result.analysis.verdict}</p>
                  <p className="text-5xl mt-6">Score: {result.analysis.score}/100</p>
                </div>
                {/* Step-by-Step Breakdown */}
                <div className="space-y-8">
                  <h4 className="text-3xl font-bold flex items-center gap-4">
                    <Sparkles className="w-10 h-10 text-yellow-500" /> Step-by-Step Breakdown
                  </h4>
                  {/* Sequential Scan */}
                  {result.plan.toLowerCase().includes('seq scan') && (
                    <div className="p-8 bg-red-100 dark:bg-red-900/60 rounded-3xl border-4 border-red-500">
                      <p className="text-3xl font-bold text-red-700 dark:text-red-300 mb-4">Sequential Scan Detected</p>
                      <p className="text-xl leading-relaxed">PostgreSQL had to read <strong>every single row</strong> in the table because there's no useful index.</p>
                      <p className="text-lg mt-4 opacity-80 italic">Imagine reading an entire phone book to find one name — very slow! 📖</p>
                    </div>
                  )}
                  {/* Index Scan */}
                  {result.plan.toLowerCase().includes('index scan') && (
                    <div className="p-8 bg-green-100 dark:bg-green-900/60 rounded-3xl border-4 border-green-500">
                      <p className="text-3xl font-bold text-green-700 dark:text-green-300 mb-4">Index Scan Used</p>
                      <p className="text-xl leading-relaxed">Great! PostgreSQL used an index to jump straight to the matching rows.</p>
                      <p className="text-lg mt-4 opacity-80 italic">Like having an alphabetical index at the back of the phone book — instant lookup! 📖→🔍</p>
                    </div>
                  )}
                  {/* Materialized View */}
                  {result.plan.toLowerCase().includes('materialized view') && (
                    <div className="p-8 bg-purple-100 dark:bg-purple-900/60 rounded-3xl border-4 border-purple-500">
                      <p className="text-3xl font-bold text-purple-700 dark:text-purple-300 mb-4">Materialized View Magic</p>
                      <p className="text-xl leading-relaxed">The result was pre-computed and stored — no calculation needed!</p>
                      <p className="text-lg mt-4 opacity-80 italic">Like having the answer already written down on a sticky note. Nuclear-level optimization! 💥</p>
                    </div>
                  )}
                  {/* Filter Warning */}
                  {result.plan.toLowerCase().includes('filter') && !result.plan.toLowerCase().includes('index scan') && (
                    <div className="p-8 bg-orange-100 dark:bg-orange-900/60 rounded-3xl border-4 border-orange-500">
                      <p className="text-3xl font-bold text-orange-700 dark:text-orange-300 mb-4">Row-by-Row Filtering</p>
                      <p className="text-xl leading-relaxed">PostgreSQL is checking each row one by one after reading it.</p>
                      <p className="text-lg mt-4 opacity-80 italic">This usually means your WHERE condition can't use an index efficiently.</p>
                    </div>
                  )}
                  {/* Perfect Execution */}
                  {!result.plan.toLowerCase().includes('seq scan') &&
                   !result.plan.toLowerCase().includes('filter') &&
                   result.analysis.score > 80 && (
                    <div className="p-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl text-white text-center shadow-2xl">
                      <CheckCircle className="w-32 h-32 mx-auto mb-6" />
                      <p className="text-5xl font-black">Perfect Execution!</p>
                      <p className="text-3xl mt-6">Your query is using the optimal path. Nothing to improve here! 🎉</p>
                    </div>
                  )}
                </div>
                {/* Natural Language Summary */}
                <div className="p-8 bg-gray-100 dark:bg-gray-800 rounded-3xl border-4 border-gray-400">
                  <p className="text-2xl italic leading-relaxed text-gray-700 dark:text-gray-300 text-center font-medium">
                    "{result.explanation}"
                  </p>
                </div>
                {/* Confidence Meter */}
                <div className="p-8 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-3xl text-white text-center shadow-2xl">
                  <p className="text-3xl font-bold mb-6">How confident are we that adding an index will help?</p>
                  <div className="text-9xl font-black">{result.indexConfidence}%</div>
                  <div className="mt-8 bg-white/30 rounded-full h-16 overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-white transition-all duration-2000 ease-out rounded-full"
                      style={{ width: `${result.indexConfidence}%` }}
                    />
                  </div>
                  {result.indexConfidence > 70 && <p className="text-3xl mt-8 font-bold">Very likely to help! 🚀</p>}
                </div>
              </div>
            )}

            {/* One-Click Index Suggestions */}
            {result?.suggestions?.length > 0 && (
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-10 shadow-2xl">
                <h3 className="text-4xl font-bold text-white mb-8 text-center">One-Click Fixes</h3>
                {result.suggestions.slice(0, 3).map((s, i) => (
                  <div key={i} className="bg-black/40 p-6 rounded-2xl mb-6 flex justify-between items-center shadow-xl">
                    <code className="text-green-300 font-mono text-lg break-all">{s}</code>
                    <div className="flex gap-4 ml-6">
                      <button onClick={() => copyToClipboard(s)} className="px-6 py-3 bg-white/20 rounded-xl hover:bg-white/40 transition flex items-center gap-2">
                        <Copy className="w-6 h-6" /> Copy
                      </button>
                      <button
                        onClick={() => applyIndex(s)}
                        className="px-8 py-3 bg-green-500 rounded-xl font-bold text-xl hover:bg-green-400 transition flex items-center gap-3"
                      >
                        <Zap className="w-8 h-8" /> Apply Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="space-y-8">
            {/* Live Chart */}
            <div className="bg-white/80 dark:bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
              <h3 className="text-3xl font-bold mb-6 text-center">
                Real System Load {compareMode && "(Before → After)"}
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="5 5" />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis />
                  <Tooltip contentStyle={{ background: darkMode ? "#111" : "#fff", border: "none" }} />
                  <Legend />
                  <Line type="monotone" dataKey="cpu" stroke="#f59e0b" name="CPU %" strokeWidth={4} dot={false} />
                  <Line type="monotone" dataKey="ram" stroke="#8b5cf6" name="RAM %" strokeWidth={4} dot={false} />
                  <Line type="monotone" dataKey="io" stroke="#ef4444" name="I/O" strokeWidth={4} dot={false} />
                  <Line type="monotone" dataKey="latency" stroke="#10b981" name="Latency (ms)" strokeWidth={4} dot={false} />
                  {compareMode && afterMetrics.length > 0 && (
                    <>
                      <Line data={afterMetrics} dataKey="cpu" stroke="#f59e0b" name="CPU (After)" strokeWidth={4} strokeDasharray="10 5" dot={false} />
                      <Line data={afterMetrics} dataKey="ram" stroke="#8b5cf6" name="RAM (After)" strokeWidth={4} strokeDasharray="10 5" dot={false} />
                      <Line data={afterMetrics} dataKey="io" stroke="#ef4444" name="I/O (After)" strokeWidth={4} strokeDasharray="10 5" dot={false} />
                      <Line data={afterMetrics} dataKey="latency" stroke="#10b981" name="Latency (After)" strokeWidth={4} strokeDasharray="10 5" dot={false} />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Execution Plan Tree */}
            {result?.planTree && (
              <div className="bg-black/80 rounded-3xl p-8 font-mono text-sm text-green-400 max-h-96 overflow-auto shadow-2xl">
                <h3 className="text-3xl font-bold text-white mb-6">Interactive Execution Plan</h3>
                {result.planTree.map((node, i) => (
                  <TreeNode node={node} key={i} />
                ))}
              </div>
            )}

            {/* Raw EXPLAIN */}
            {result && (
              <div className="bg-black/80 rounded-3xl p-8 font-mono text-xs text-green-400 max-h-96 overflow-auto shadow-2xl">
                <h3 className="text-3xl font-bold text-white mb-6">EXPLAIN ANALYZE</h3>
                <pre>{result.plan}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}