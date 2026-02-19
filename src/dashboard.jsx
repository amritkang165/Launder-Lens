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

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // ✅ Autoload rows from CoverPage upload
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

      {output && (
        <button
          onClick={() => downloadJSON(output)}
          style={{ marginTop: 12, padding: "8px 12px" }}
        >
          Download JSON
        </button>
      )}

      {fgData && (
        <div style={{ height: 600, border: "1px solid #ddd", marginTop: 16 }}>
          <ForceGraph2D
            graphData={fgData}
            nodeLabel={(n) =>
              `Account: ${n.id}\nSuspicious: ${suspiciousSet.has(n.id) ? "YES" : "NO"}`
            }
            linkLabel={(l) => `₹${l.amount}`}
          />
        </div>
      )}
    </div>
  );
}
