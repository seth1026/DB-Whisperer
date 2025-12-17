# 🕵️ DB-Whisperer — The SQL Performance Detective

DB-Whisperer is an **educational query analysis and visualization tool** that helps developers understand **why SQL queries are slow** and how they can be optimized.

It interprets PostgreSQL query execution behavior, visualizes performance trends, and explains inefficiencies in **plain English**, making query tuning approachable for learners and early backend engineers.

> ⚠️ **Note:** DB-Whisperer focuses on **query plan analysis and performance simulation**, not live production database monitoring.

---

## 🚀 Why DB-Whisperer?

SQL performance issues are often hard to understand because:
- Query execution plans are complex  
- Performance bottlenecks are invisible  
- Optimization advice feels abstract  

DB-Whisperer acts like a **database detective** — helping users *see* how a query behaves and *learn* how design choices (indexes, filters, scans) affect performance.

---

## 🔥 Key Features

### 🔹 1. Query Execution Analysis (Simulated PostgreSQL)
- Executes queries against a **sandboxed PostgreSQL dataset**
- Uses **EXPLAIN / EXPLAIN ANALYZE-style outputs** to inspect execution behavior
- Highlights common inefficiencies such as:
  - Sequential scans  
  - Missing indexes  
  - Broad filters (`SELECT *`)  

---

### 🔹 2. Plain-English Query Explanations
Automatically converts execution behavior into readable insights:
- “This query scanned every row because no usable index was found.”
- “Filtering on this column would significantly reduce work.”

Explanations are **rule-based** and derived from query plan patterns.

---

### 🔹 3. Optimization Suggestions (Preview Mode)
- Recommends index creation strategies  
- Suggests query rewrites  
- Generates example SQL fixes  

> ⚠️ Index creation actions are **preview-only** and not executed automatically on production databases.

---

### 🔹 4. Performance Scoring System
Each query is graded using heuristic rules based on:
- Scan type (sequential vs index)  
- Estimated rows scanned  
- Execution cost indicators  

Grades include:
- Explanation of the score  
- Key bottlenecks detected  
- Suggested improvements  

> Scores are **advisory**, not database-derived guarantees.

---

### 🔹 5. Interactive Visualization Dashboard
- Latency trends (simulated)  
- Query behavior indicators  
- Execution plan highlights  

Designed to make performance issues **intuitive**, not just textual.

---

## 🧠 How It Works (High-Level Architecture)

User Query
↓
Backend Analyzer
↓
PostgreSQL Sandbox
↓
EXPLAIN / Plan Interpretation
↓
Heuristic Scoring + Explanations
↓
WebSocket Streaming
↓
Frontend Visualization


### Flow Breakdown
1. **React frontend** accepts SQL input  
2. **Node.js backend** processes the query  
3. PostgreSQL provides execution plan data  
4. Analyzer detects inefficiencies using rule-based logic  
5. Results are streamed to the UI  
6. Charts and explanations update in real time  

---

## 🛠 Tech Stack

### **Frontend**
- React.js  
- Recharts / Chart.js  
- Socket.io Client  

### **Backend**
- Node.js  
- Express.js  
- Socket.io  
- Query-plan interpretation engine  

### **Database**
- PostgreSQL (sandboxed / simulated dataset)

### **DevOps**
- Docker  
- Docker Compose  
- CI-ready multi-service setup  

---

## 🧪 Example Use Cases
- Learn how PostgreSQL executes queries  
- Understand why indexes matter  
- Visualize sequential scans vs indexed access  
- Teach SQL optimization concepts  
- Demonstrate query tuning principles interactively  

---

## 🌱 Future Enhancements
- Live `EXPLAIN ANALYZE` comparison (before vs after)  
- Index impact simulation (cost estimation)  
- Query history & learning reports  
- Read-only production DB support  
- Multi-database adapters (MySQL, MariaDB)  

---

## 🧑‍💻 Contributing
Contributions are welcome.  
This project is ideal for experimenting with:
- Database internals  
- Query optimization logic  
- Developer tooling UX  

---

## 📜 License
MIT License
