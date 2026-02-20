<div align="center">

# 🧼🔍 **LaunderLens**
### **Graph-Based Money Muling Detection Engine**
#### *RIFT 2026 Hackathon • Graph Theory / Financial Crime Detection Track*

Upload a CSV → Build a transaction graph → Detect muling rings → Visualize networks → Download **judge-format JSON**.


🔗 **Live Demo:** `https://launder-lens-gilt.vercel.app`  
📦 **GitHub Repo:** `https://github.com/amritkang165/Launder-Lens`

</div>

---

## ✨ Overview
**LaunderLens** is a web-based financial forensics engine that detects **money muling networks** using **graph algorithms + temporal analysis**. Instead of using simple database filters, LaunderLens models transactions as a **directed graph** and identifies suspicious rings that represent common laundering behaviors.

Built for **RIFT 2026 — Money Muling Detection Challenge**.

---

## ✅ Judge Requirement Checklist (Covered)
### 1) Interactive Graph Visualization ✅
- Nodes: all accounts from `sender_id` & `receiver_id`
- Directed edges: `sender → receiver` (money flow)
- Suspicious nodes visually distinct
- Rings highlighted clearly by pattern type (edges + nodes)
- Hover interaction shows account info

### 2) Downloadable JSON Output ✅
A **Download JSON** button exports `launderlens_output.json` in the exact required structure:
- `suspicious_accounts` (sorted by suspicion_score desc)
- `fraud_rings`
- `summary`

### 3) Fraud Ring Summary Table ✅
Dashboard table includes:
- Ring ID
- Pattern Type
- Member Count
- Risk Score
- Member Account IDs (comma-separated)

### 4) Mandatory Web App Behavior ✅
- CSV upload available on **homepage**
- Loading screen → Dashboard results
- Live deployed, public, no authentication

---

## 📥 Input CSV Format (Strict)
CSV must contain these exact columns:

| Column | Type | Example |
|---|---|---|
| transaction_id | String | TXN_0001 |
| sender_id | String | ACC_A |
| receiver_id | String | ACC_B |
| amount | Float | 5000.00 |
| timestamp | DateTime | 2026-02-10 09:10:00 |

---

## 🧠 Detection Patterns Implemented

### 🔁 1) Circular Fund Routing (Cycles)
Detects directed cycles of length **3 to 5**  
Example: `A → B → C → A`

### 🧩 2) Smurfing (Fan-in / Fan-out within 72 hours)
Uses a **72-hour window**
- **Fan-in:** 10+ unique senders → 1 aggregator  
- **Fan-out:** 1 disperser → 10+ unique receivers  

### 🪆 3) Layered Shell Networks (3+ hop chains)
Detects chains of **3+ hops** where intermediate accounts are low-activity “shell” accounts  
Example: `SRC → S1 → S2 → DST`

### 🛡 False Positive Control
Includes a guard to reduce naive smurfing flags for long-lived, high-volume “merchant/payroll-like” hubs.

---

## 🎨 Visualization Legend
Ring edges are highlighted for clarity:
- 🔴 Cycle edges
- 🟠 Smurfing fan-in edges
- 🔵 Smurfing fan-out edges
- 🟣 Shell chain edges

Suspicious nodes are visually distinct from normal accounts.

---

## 🧾 Output JSON Format (Exact)
```json
{
  "suspicious_accounts": [
    {
      "account_id": "ACC_00123",
      "suspicion_score": 87.5,
      "detected_patterns": ["cycle_length_3", "fan_in_72h"],
      "ring_id": "RING_001"
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "RING_001",
      "member_accounts": ["ACC_00123", "ACC_00456"],
      "pattern_type": "cycle",
      "risk_score": 95.3
    }
  ],
  "summary": {
    "total_accounts_analyzed": 500,
    "suspicious_accounts_flagged": 15,
    "fraud_rings_detected": 4,
    "processing_time_seconds": 2.3
  }
}


SYSTEM ARCHITECTURE
CSV Upload (Homepage)
   ↓
Parse CSV (PapaParse)
   ↓
Build Graph (adjacency + stats + time-sorted transactions)
   ↓
Detection Engine
   ├─ Cycles (3–5)
   ├─ Smurfing (72h fan-in/out)
   └─ Shell Chains (3+ hops)
   ↓
Dashboard UI
   ├─ Graph Visualization (react-force-graph-2d)
   ├─ Fraud Rings Table
   └─ JSON Download (exact judge schema)



🧠 Known Limitations
Very dense graphs can make cycle enumeration heavier; depth is bounded to 5 with optional ring limits.
Rule-based scoring may miss novel laundering patterns outside cycle/smurf/shell families.
No persistent storage without backend (session-based results).



🌱 Future Improvements
Community detection / clustering for larger mule networks
Stronger merchant/payroll identification (periodicity + entropy checks)
Optional backend for audit logs and case management


👥 Team
Amrit Kang — Detection Engine, Graph Algorithms, Scoring Logic, JSON Output Pipeline
Vanshika Asati — Frontend UI, Landing/Loading/Dashboard UX, Visual Design & Integration


