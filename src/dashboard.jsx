import { useState } from "react";
import Papa from "papaparse";
import ForceGraph2D from "react-force-graph-2d";

import { parseTransactions } from "./Engine/parseTransactions";
import { buildGraph } from "./Engine/buildGraph";
import { detectCycles } from "./Engine/detectCycles";

function buildForceGraph(transactions) {
  const nodeSet = new Set();
  const links = transactions.map((t) => {
    nodeSet.add(t.sender_id);
    nodeSet.add(t.receiver_id);
    return { source: t.sender_id, target: t.receiver_id, amount: t.amount, timestamp: t.timestamp };
  });
  const nodes = Array.from(nodeSet).map((id) => ({ id }));
  return { nodes, links };
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

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
  const fgData = transactions.length ? buildForceGraph(transactions) : null;

  const suspiciousSet = new Set(cycleRings.flat());

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>LaunderLens — Investigation Dashboard</h1>

      <div style={{ marginTop: 16 }}>
        <input type="file" accept=".csv" onChange={handleFile} />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </div>

      <p>Rows loaded: {rows.length}</p>
      <p>Cycle rings detected: {cycleRings.length}</p>

      {fgData && (
        <div style={{ height: 600, border: "1px solid #ddd", marginTop: 16 }}>
          <ForceGraph2D
            graphData={fgData}
            nodeLabel={(n) => `Account: ${n.id}\nSuspicious: ${suspiciousSet.has(n.id) ? "YES" : "NO"}`}
            linkLabel={(l) => `₹${l.amount}`}
          />
        </div>
      )}
    </div>
  );
}
