import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import ForceGraph2D from "react-force-graph-2d";

import { runDetection } from "./Engine/runDetection";
import { parseTransactions } from "./Engine/parseTransactions";
import { buildGraph } from "./Engine/buildGraph";
import { detectCycles } from "./Engine/detectCycles";

function buildForceGraph(transactions) {
  const nodeSet = new Set();
  const links = transactions.map((t) => {
    nodeSet.add(t.sender_id);
    nodeSet.add(t.receiver_id);
    return {
      source: t.sender_id,
      target: t.receiver_id,
      amount: t.amount,
      timestamp: t.timestamp,
    };
  });
  const nodes = Array.from(nodeSet).map((id) => ({ id }));
  return { nodes, links };
}

function downloadJSON(obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "launderlens_output.json";
  a.click();
  URL.revokeObjectURL(url);
}


function SummaryCard({ label, value, color = "#14ff6e" }) {
  return (
    <div style={{ background: "#111827", padding: 18, borderRadius: 10, textAlign: "center" }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>{label}</div>
    </div>
  );
}

function Legend({ color, label, line }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {line ? (
        <div style={{ width: 20, height: 2, background: color }} />
      ) : (
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
      )}
      <span style={{ fontSize: 12, opacity: 0.7 }}>{label}</span>
    </div>
  );
}

const th = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: "0.85rem",
  opacity: 0.7,
  borderBottom: "1px solid #1f2933",
};

const td = {
  padding: "10px 12px",
  borderBottom: "1px solid #1f2933",
};

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("launderlens_rows");
    if (saved) setRows(JSON.parse(saved));
  }, []);

  function validateColumns(fields) {
    const required = ["transaction_id", "sender_id", "receiver_id", "amount", "timestamp"];
    return required.filter((c) => !fields.includes(c));
  }

  function handleFile(e) {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields || [];
        const missing = validateColumns(fields);
        if (missing.length) {
          setRows([]);
          setError(`Missing columns: ${missing.join(", ")}`);
          return;
        }
        setRows(results.data);
      },
      error: () => setError("Failed to parse CSV."),
    });
  }

  const transactions = rows.length ? parseTransactions(rows) : [];
  const graph = transactions.length ? buildGraph(transactions) : null;
  const cycleRings = graph ? detectCycles(graph.out) : [];
  const output = graph ? runDetection(transactions, graph, cycleRings) : null;
  const fgData = transactions.length ? buildForceGraph(transactions) : null;
  const ringCounts =
  output?.fraud_rings?.reduce(
    (acc, r) => {
      acc.total++;
      if (r.pattern_type === "cycle") acc.cycles++;
      else if (r.pattern_type.startsWith("smurfing")) acc.smurf++;
      else if (r.pattern_type === "shell_chain") acc.shell++;
      return acc;
    },
    { total: 0, cycles: 0, smurf: 0, shell: 0 }
  ) || { total: 0, cycles: 0, smurf: 0, shell: 0 };

const suspiciousSet = new Set((output?.suspicious_accounts || []).map((x) => x.account_id));

  // ⏱ Build transaction count over time (72-hour window)
  const timeBucketMap = {};

  transactions.forEach((t) => {
    const time = new Date(t.timestamp);
    if (isNaN(time)) return;

    // Bucket by hour (YYYY-MM-DD HH)
    const bucket = time.toISOString().slice(0, 13);

    timeBucketMap[bucket] = (timeBucketMap[bucket] || 0) + 1;
  });

  const transactionTimeSeries = Object.entries(timeBucketMap)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([time, count]) => ({
      time,
      count,
    }));

  // 🔢 Build number of transactions per account
  const transactionCountMap = {};

  transactions.forEach((t) => {
    transactionCountMap[t.sender_id] =
      (transactionCountMap[t.sender_id] || 0) + 1;

    transactionCountMap[t.receiver_id] =
      (transactionCountMap[t.receiver_id] || 0) + 1;
  });

  const transactionCountData = Object.entries(transactionCountMap).map(
    ([account, count]) => ({
      account,
      count,
      suspicious: suspiciousSet.has(account),
    })
  );

// Build edge highlights from ALL detected rings
// edgeKey format: "A->B" => pattern_type
const ringEdgeMap = new Map();

if (output?.fraud_rings?.length) {
  for (const ring of output.fraud_rings) {
    const members = ring.member_accounts;

    if (ring.pattern_type === "cycle") {
      // cycle edges: follow the member order as cycle path
      for (let i = 0; i < members.length; i++) {
        const a = members[i];
        const b = members[(i + 1) % members.length];
        ringEdgeMap.set(`${a}->${b}`, "cycle");
      }
    } else if (ring.pattern_type === "smurfing_fanin") {
      // many -> hub : treat first element as hub if your detectSmurfing returns [hub,...]
      // If not sure, we make hub = the one with max in-degree (safe)
      let hub = members[0];
      if (graph?.in) {
        hub =
          members.reduce((best, id) => {
            const deg = graph.in.get(id)?.size || 0;
            const bestDeg = graph.in.get(best)?.size || 0;
            return deg > bestDeg ? id : best;
          }, members[0]);
      }

      for (const m of members) {
        if (m === hub) continue;
        ringEdgeMap.set(`${m}->${hub}`, "smurfing_fanin");
      }
    } else if (ring.pattern_type === "smurfing_fanout") {
      // hub -> many : hub = max out-degree
      let hub = members[0];
      if (graph?.out) {
        hub =
          members.reduce((best, id) => {
            const deg = graph.out.get(id)?.size || 0;
            const bestDeg = graph.out.get(best)?.size || 0;
            return deg > bestDeg ? id : best;
          }, members[0]);
      }

      for (const m of members) {
        if (m === hub) continue;
        ringEdgeMap.set(`${hub}->${m}`, "smurfing_fanout");
      }
    } else if (ring.pattern_type === "shell_chain") {
      // shell chain: we don't store the exact path in JSON, so approximate:
      // highlight edges between consecutive members if they exist in graph
      for (let i = 0; i < members.length; i++) {
        for (let j = 0; j < members.length; j++) {
          if (i === j) continue;
          const a = members[i];
          const b = members[j];
          if (graph?.out?.get(a)?.has(b)) {
            ringEdgeMap.set(`${a}->${b}`, "shell_chain");
          }
        }
      }
    }
  }
}



  return (
    <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#e5e7eb" }}>
      {/* HEADER */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #1f2933", display: "flex", justifyContent: "space-between" }}>
        <h2 style={{ color: "#14ff6e", margin: 0 }}>LaunderLens — Investigation Dashboard</h2>
        <label style={{ border: "1px solid #14ff6e", padding: "6px 14px", borderRadius: 6, cursor: "pointer", color: "#14ff6e" }}>
          Upload New CSV
          <input type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
        </label>
      </div>

      <div style={{ padding: 24 }}>
        {/* SUMMARY */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          <SummaryCard label="Rows Loaded" value={rows.length} />
          <SummaryCard label="Transactions" value={transactions.length} />
          <SummaryCard label="Cycle Rings" value={cycleRings.length} color="#facc15" />
          <SummaryCard label="Suspicious Accounts" value={suspiciousSet.size} color="#ef4444" />
          <SummaryCard label="Total Rings" value={ringCounts.total} color="#60a5fa" />
<SummaryCard label="Smurf Rings" value={ringCounts.smurf} color="#f97316" />
<SummaryCard label="Shell Rings" value={ringCounts.shell} color="#a78bfa" />

        </div>
        {output && (
  <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
    <button
      onClick={() => downloadJSON(output)}
      style={{
        background: "#14ff6e",
        color: "#000",
        border: "none",
        padding: "10px 14px",
        borderRadius: 8,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      Download JSON Output
    </button>
  </div>
)}

        {/* ANALYTICS GRAPHS */}
        {transactionTimeSeries.length > 0 && transactionCountData.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
              gap: 24,
              marginTop: 32,
            }}
          >
            {/* LEFT — TRANSACTIONS OVER TIME */}
            <div>
              <h3 style={{ marginBottom: 10 }}>
                Transaction Activity Over Time (72 Hours)
              </h3>

              <div
                style={{
                  height: 260,
                  background: "#020617",
                  borderRadius: 10,
                  padding: 12,
                  boxShadow: "0 0 20px rgba(20, 255, 110, 0.15)",
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={transactionTimeSeries}>
                    <CartesianGrid stroke="#1f2933" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      minTickGap={20}
                    />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#14ff6e"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* RIGHT — TRANSACTIONS PER ACCOUNT */}
            <div>
              <h3 style={{ marginBottom: 10 }}>
                Number of Transactions per Account
              </h3>

              <div
                style={{
                  height: 260,
                  background: "#111827",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={transactionCountData} barCategoryGap={30}>
                    <CartesianGrid stroke="#1f2933" vertical={false} />
                    <XAxis
                      dataKey="account"
                      tick={{ fill: "#9ca3af", fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" barSize={36} fill="#14ff6e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        {/* GRAPH */}
        <div style={{ marginTop: 30 }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
            <Legend color="#14ff6e" label="Normal Account" />
            <Legend color="#ef4444" label="Suspicious Account" />
            <Legend color="#ef4444" label="Cycle Transaction" line />
            <Legend color="#f97316" label="Smurfing Fan-in Edge" line />
<Legend color="#60a5fa" label="Smurfing Fan-out Edge" line />
<Legend color="#a78bfa" label="Shell Chain Edge" line />

          </div>

          {fgData && (
            <div style={{ height: 600, background: "#020617", borderRadius: 10 }}>
              <ForceGraph2D
                graphData={fgData}
                nodeCanvasObject={(node, ctx) => {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, suspiciousSet.has(node.id) ? 6 : 4, 0, 2 * Math.PI);
                  ctx.fillStyle = suspiciousSet.has(node.id) ? "#ef4444" : "#14ff6e";
                  ctx.fill();
                }}
               linkColor={(l) => {
  const key = `${l.source.id}->${l.target.id}`;
  const type = ringEdgeMap.get(key);

  if (type === "cycle") return "#ef4444";          // red
  if (type === "smurfing_fanin") return "#f97316"; // orange
  if (type === "smurfing_fanout") return "#60a5fa"; // blue
  if (type === "shell_chain") return "#a78bfa";    // purple

  return "#555";
}}
linkWidth={(l) => {
  const key = `${l.source.id}->${l.target.id}`;
  return ringEdgeMap.has(key) ? 2 : 1;
}}

                cooldownTicks={150}
              />
            </div>
          )}
        </div>

        {/* FRAUD TABLE */}
        {output?.fraud_rings?.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h3>Detected Fraud Rings</h3>
            <table style={{ width: "100%", background: "#111827", borderRadius: 10 }}>
              <thead>
                <tr>
                  <th style={th}>Ring ID</th>
                  <th style={th}>Pattern</th>
                  <th style={th}>Members</th>
                  <th style={th}>Risk Score</th>
                  <th style={th}>Member Account IDs</th>
                  


                </tr>
              </thead>
              <tbody>
                {output.fraud_rings.map((ring) => (
                  <tr key={ring.ring_id}>
  <td style={td}>{ring.ring_id}</td>
  <td style={td}>{ring.pattern_type}</td>
  <td style={td}>{ring.member_accounts.length}</td>
  <td style={{ ...td, color: "#ef4444" }}>{ring.risk_score}</td>
  <td style={td}>{ring.member_accounts.join(", ")}</td>
</tr>

                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
