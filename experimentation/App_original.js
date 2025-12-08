// src/App.js - DB-Whisperer PRO v2 (Version A: static PRO gradient) + Execution Tree + Explanation + Confidence
import React, { useState, useEffect, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import io from "socket.io-client";
import { Copy, AlertTriangle, Moon, Sun, Sparkles } from "lucide-react";

const SOCKET_URL = "http://localhost:4000";

function TreeNode({ node }) {
  if (!node) return null;
  if (!node.children || node.children.length === 0) {
    return <div className="pl-4 text-sm">{node.text}</div>;
  }
  return (
    <details className="pl-2" open>
      <summary className="cursor-pointer font-mono text-sm">{node.text}</summary>
      <div className="pl-4">
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
  const [beforeMetrics, setBeforeMetrics] = useState([]);
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
    });
    socketRef.current = socket;

    socket.on("metrics", (data) => {
      setMetrics((prev) => [...prev.slice(-120), data]);
      if (compareMode) setBeforeMetrics((prev) => [...prev.slice(-120), data]);
    });

    socket.on("queryComplete", (data) => {
      setIsRunning(false);
      setResult(data);
    });

    socket.on("error", (msg) => {
      alert("Error: " + msg);
      setIsRunning(false);
    });

    return () => socket.disconnect();
  }, [isAuthenticated, compareMode]);

  const runQuery = (mode = "normal") => {
    if (!socketRef.current || isRunning || !customQuery.trim()) return;

    setIsRunning(true);
    setMetrics([]);
    setBeforeMetrics([]);
    setResult(null);

    // reset compare mode correctly
    if (mode === "before") setCompareMode(true);
    else setCompareMode(false);

    socketRef.current.emit("runQuery", { query: customQuery, mode });
  };

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch (e) { console.error(e); }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-fuchsia-600 to-blue-600 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-lg p-10 rounded-2xl shadow-2xl">
          <h1 className="text-5xl font-bold text-white mb-8 text-center">DB-Whisperer PRO</h1>
          <form onSubmit={handleLogin} className="space-y-6">
            <input defaultValue="user" className="w-full p-4 rounded-lg bg-white/20 placeholder-white/70 text-white" placeholder="Username" required />
            <input type="password" defaultValue="password" className="w-full p-4 rounded-lg bg-white/20 placeholder-white/70 text-white" placeholder="Password" required />
            <button type="submit" className="w-full bg-white text-purple-600 py-4 rounded-lg font-bold text-xl hover:bg-white/90 transition">Enter the Matrix</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all ${darkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-purple-600 via-fuchsia-600 to-blue-600'}`}>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent">
            DB-Whisperer <span className="text-3xl">PRO</span>
          </h1>
          <button onClick={() => setDarkMode(!darkMode)} className="p-3 rounded-full bg-gray-200 dark:bg-gray-800">
            {darkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
              <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-purple-600" /> Write Your Query
              </h3>

              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="SELECT * FROM sales WHERE category_id = 5;"
                className="w-full h-40 p-4 font-mono text-sm bg-gray-900 text-green-400 rounded-lg focus:ring-4 focus:ring-purple-500 focus:outline-none"
              />

              {customQuery.includes("SELECT *") && (
                <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/50 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertTriangle /> Avoid SELECT * in production
                </div>
              )}
              {customQuery.toLowerCase().includes("like '%") && (
                <div className="mt-3 p-3 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center gap-2 text-orange-700 dark:text-orange-300">
                  <AlertTriangle /> Leading % prevents index usage
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => runQuery("normal")}
                  disabled={isRunning || !customQuery}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl"
                >
                  {isRunning ? "Analyzing..." : "Run & Analyze"}
                </button>

                <button
                  onClick={() => runQuery("before")}
                  disabled={isRunning || !customQuery}
                  className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-xl"
                >
                  Before vs After
                </button>
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={() => setCustomQuery("SELECT * FROM sales WHERE product_name LIKE '%Laptop%'")} className="flex-1 py-2 bg-red-500/20 text-red-700 rounded-lg text-sm">
                  Load Slow Query
                </button>
                <button onClick={() => setCustomQuery("SELECT * FROM mv_sales_summary WHERE category = 'Electronics'")} className="flex-1 py-2 bg-green-500/20 text-green-700 rounded-lg text-sm">
                  Load Fast Query
                </button>
              </div>
            </div>

            {result && (
              <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl p-6 shadow-xl text-gray-900 dark:text-white">
                <div className="mb-4">
                  <h4 className="font-semibold text-lg">Quick Explanation</h4>
                  <p className="text-sm mt-2 text-gray-700 dark:text-gray-200">{result.explanation}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-bold">Score: {result.analysis?.score ?? '-' } / 100</h3>
                    <p className={`mt-2 ${result.analysis.score > 80 ? 'text-green-600' : result.analysis.score > 60 ? 'text-yellow-600' : result.analysis.score > 40 ? 'text-orange-600' : 'text-red-600'}`}>{result.analysis?.verdict}</p>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-300">Index Confidence</div>
                    <div className="text-3xl font-mono">{result.indexConfidence ?? '-' }%</div>
                  </div>
                </div>

                {result.suggestions?.length > 0 && (
                  <div className="mt-4 bg-gradient-to-r from-blue-500 to-purple-600 p-4 rounded text-white">
                    <h5 className="font-semibold">Index Suggestions</h5>
                    <div className="mt-2 space-y-2">
                      {result.suggestions.map((s, i) => (
                        <div key={i} className="flex justify-between items-center bg-black/20 p-2 rounded">
                          <code className="text-sm">{s}</code>
                          <button onClick={() => copyToClipboard(s)} className="ml-4 p-1 bg-white/20 rounded">Copy</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl p-6 shadow-xl">
              <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Real-Time System Load</h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={compareMode ? beforeMetrics : metrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="cpu" stroke="#f59e0b" name="CPU %" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="io" stroke="#ef4444" name="I/O Wait %" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="latency" stroke="#10b981" name="Latency (ms)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {result?.planTree && (
              <div className="bg-black/80 p-4 rounded-2xl font-mono text-xs text-green-400 overflow-x-auto max-h-96">
                <h3 className="text-white text-lg mb-3">Execution Tree</h3>
                <div>
                  {result.planTree.map((node, i) => (
                    <TreeNode node={node} key={i} />
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div className="bg-black/80 p-4 rounded-2xl font-mono text-xs text-green-400 overflow-x-auto max-h-96">
                <h3 className="text-white text-lg mb-3">EXPLAIN ANALYZE</h3>
                <pre>{result.plan}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
