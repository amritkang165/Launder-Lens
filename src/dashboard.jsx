import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import ForceGraph2D from "react-force-graph-2d";

import { runDetection } from "./Engine/runDetection";
import { parseTransactions } from "./Engine/parseTransactions";
import { buildGraph } from "./Engine/buildGraph";
import { detectCycles } from "./Engine/detectCycles";
import "./dashboard.css";

/* -----------------------------
   Helpers
----------------------------- */

function buildForceGraph(transactions) {
  const nodeMap = new Map();
  const links = transactions.map((t) => {
    if (!nodeMap.has(t.sender_id)) nodeMap.set(t.sender_id, { id: t.sender_id });
    if (!nodeMap.has(t.receiver_id))
      nodeMap.set(t.receiver_id, { id: t.receiver_id });

    return {
      source: t.sender_id,
      target: t.receiver_id,
      amount: t.amount,
      timestamp: t.timestamp,
    };
  });

  return { nodes: Array.from(nodeMap.values()), links };
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
    <div
      style={{
        background: "linear-gradient(180deg, rgba(17,24,39,0.95), rgba(2,6,23,0.95))",
        border: "1px solid rgba(31,41,51,0.9)",
        padding: 16,
        borderRadius: 14,
        textAlign: "center",
        boxShadow: "0 0 18px rgba(20, 255, 110, 0.08)",
      }}
    >
      <div style={{ fontSize: "1.9rem", fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: "0.85rem", opacity: 0.75 }}>{label}</div>
    </div>
  );
}

function LegendDot({ color, label, line }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {line ? (
        <div style={{ width: 22, height: 3, borderRadius: 999, background: color }} />
      ) : (
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
      )}
      <span style={{ fontSize: 12, opacity: 0.8 }}>{label}</span>
    </div>
  );
}

const th = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: "0.85rem",
  opacity: 0.75,
  borderBottom: "1px solid #1f2933",
  position: "sticky",
  top: 0,
  background: "#0b1220",
};

const td = {
  padding: "10px 12px",
  borderBottom: "1px solid #1f2933",
  fontSize: "0.9rem",
};

/* -----------------------------
   Layout: pin rings into zones
----------------------------- */
function applyRingLayout(fgData, output, graph) {
  if (!fgData || !output?.fraud_rings?.length) return fgData;

  const nodeById = new Map(fgData.nodes.map((n) => [n.id, n]));
  const used = new Set();

  // More separated zones so shapes don't collide
  const zones = {
    cycle: { x: -320, y: -170 },
    smurfing_fanin: { x: -320, y: 170 },
    smurfing_fanout: { x: 320, y: 170 },
    shell_chain: { x: 320, y: -170 },
  };

  for (const ring of output.fraud_rings) {
    const center = zones[ring.pattern_type] || { x: 0, y: 0 };
    const members = ring.member_accounts || [];

    // Cycle: circle
    if (ring.pattern_type === "cycle") {
      const R = Math.max(45, Math.min(80, members.length * 16));
      members.forEach((id, i) => {
        const n = nodeById.get(id);
        if (!n || used.has(id)) return;
        const ang = (2 * Math.PI * i) / members.length;
        n.fx = center.x + R * Math.cos(ang);
        n.fy = center.y + R * Math.sin(ang);
        used.add(id);
      });
    }

    // Smurfing: star around hub
    if (
      ring.pattern_type === "smurfing_fanin" ||
      ring.pattern_type === "smurfing_fanout"
    ) {
      let hub = members[0];

      if (ring.pattern_type === "smurfing_fanout" && graph?.out) {
        hub = members.reduce((best, id) => {
          const deg = graph.out.get(id)?.size || 0;
          const bestDeg = graph.out.get(best)?.size || 0;
          return deg > bestDeg ? id : best;
        }, hub);
      }

      if (ring.pattern_type === "smurfing_fanin" && graph?.in) {
        hub = members.reduce((best, id) => {
          const deg = graph.in.get(id)?.size || 0;
          const bestDeg = graph.in.get(best)?.size || 0;
          return deg > bestDeg ? id : best;
        }, hub);
      }

      const hubNode = nodeById.get(hub);
      if (hubNode && !used.has(hub)) {
        hubNode.fx = center.x;
        hubNode.fy = center.y;
        used.add(hub);
      }

      const spokes = members.filter((x) => x !== hub);
      const R = Math.max(70, Math.min(120, spokes.length * 10));
      spokes.forEach((id, i) => {
        const n = nodeById.get(id);
        if (!n || used.has(id)) return;
        const ang = (2 * Math.PI * i) / spokes.length;
        n.fx = center.x + R * Math.cos(ang);
        n.fy = center.y + R * Math.sin(ang);
        used.add(id);
      });
    }

    // Shell chain: line
    if (ring.pattern_type === "shell_chain") {
      const spacing = 46;
      const startX = center.x - ((members.length - 1) * spacing) / 2;
      members.forEach((id, i) => {
        const n = nodeById.get(id);
        if (!n || used.has(id)) return;
        n.fx = startX + i * spacing;
        n.fy = center.y;
        used.add(id);
      });
    }
  }

  return fgData;
}

/* -----------------------------
   Edge coloring based on rings
----------------------------- */
function buildRingEdgeMap(output, graph) {
  const ringEdgeMap = new Map();
  if (!output?.fraud_rings?.length) return ringEdgeMap;

  for (const ring of output.fraud_rings) {
    const members = ring.member_accounts || [];

    if (ring.pattern_type === "cycle") {
      for (let i = 0; i < members.length; i++) {
        const a = members[i];
        const b = members[(i + 1) % members.length];
        ringEdgeMap.set(`${a}->${b}`, "cycle");
      }
    } else if (ring.pattern_type === "smurfing_fanin") {
      let hub = members[0];
      if (graph?.in) {
        hub = members.reduce((best, id) => {
          const deg = graph.in.get(id)?.size || 0;
          const bestDeg = graph.in.get(best)?.size || 0;
          return deg > bestDeg ? id : best;
        }, hub);
      }
      for (const m of members) {
        if (m === hub) continue;
        ringEdgeMap.set(`${m}->${hub}`, "smurfing_fanin");
      }
    } else if (ring.pattern_type === "smurfing_fanout") {
      let hub = members[0];
      if (graph?.out) {
        hub = members.reduce((best, id) => {
          const deg = graph.out.get(id)?.size || 0;
          const bestDeg = graph.out.get(best)?.size || 0;
          return deg > bestDeg ? id : best;
        }, hub);
      }
      for (const m of members) {
        if (m === hub) continue;
        ringEdgeMap.set(`${hub}->${m}`, "smurfing_fanout");
      }
    } else if (ring.pattern_type === "shell_chain") {
      // highlight existing edges between any consecutive in chain order if present
      for (let i = 0; i < members.length - 1; i++) {
        const a = members[i];
        const b = members[i + 1];
        if (graph?.out?.get(a)?.has(b)) ringEdgeMap.set(`${a}->${b}`, "shell_chain");
      }
    }
  }

  return ringEdgeMap;
}

function prettyPattern(p) {
  if (p === "cycle") return "Cycle";
  if (p === "smurfing_fanin") return "Smurfing (Fan-in)";
  if (p === "smurfing_fanout") return "Smurfing (Fan-out)";
  if (p === "shell_chain") return "Shell Chain";
  return p;
}

/* -----------------------------
   Main Component
----------------------------- */

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  // Node inspector
  const [activeNode, setActiveNode] = useState(null);
  const [activeNodePinned, setActiveNodePinned] = useState(null);

  // ForceGraph ref for zoomToFit
  const fgRef = useRef();

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
        sessionStorage.setItem("launderlens_rows", JSON.stringify(results.data));
        // reset inspector when new data comes
        setActiveNode(null);
        setActiveNodePinned(null);
      },
      error: () => setError("Failed to parse CSV."),
    });
  }

  const transactions = useMemo(() => (rows.length ? parseTransactions(rows) : []), [rows]);
  const graph = useMemo(() => (transactions.length ? buildGraph(transactions) : null), [transactions]);
  const cycleRings = useMemo(() => (graph ? detectCycles(graph.out) : []), [graph]);
  const output = useMemo(() => (graph ? runDetection(transactions, graph, cycleRings) : null), [transactions, graph, cycleRings]);

  // ring counts
  const ringCounts = useMemo(() => {
    if (!output?.fraud_rings?.length) return { total: 0, cycles: 0, smurf: 0, shell: 0 };
    return output.fraud_rings.reduce(
      (acc, r) => {
        acc.total++;
        if (r.pattern_type === "cycle") acc.cycles++;
        else if (r.pattern_type.startsWith("smurfing")) acc.smurf++;
        else if (r.pattern_type === "shell_chain") acc.shell++;
        return acc;
      },
      { total: 0, cycles: 0, smurf: 0, shell: 0 }
    );
  }, [output]);

  const suspiciousSet = useMemo(
    () => new Set((output?.suspicious_accounts || []).map((x) => x.account_id)),
    [output]
  );

  // Build fgData and apply fixed layout
  const fgData = useMemo(() => {
    if (!transactions.length) return null;
    let d = buildForceGraph(transactions);
    if (output && graph) d = applyRingLayout(d, output, graph);
    return d;
  }, [transactions, output, graph]);

  // Center the fixed layout in the canvas
  useEffect(() => {
    if (!fgRef.current || !fgData?.nodes?.length) return;
    requestAnimationFrame(() => {
      try {
        fgRef.current.centerAt(0, 0, 0);
        fgRef.current.zoomToFit(600, 60); // ms, padding
      } catch (e) { }
    });
  }, [fgData]);

  // Time series (per hour)
  const transactionTimeSeries = useMemo(() => {
    const timeBucketMap = {};
    for (const t of transactions) {
      const time = new Date(t.timestamp);
      if (isNaN(time)) continue;
      const bucket = time.toISOString().slice(0, 13);
      timeBucketMap[bucket] = (timeBucketMap[bucket] || 0) + 1;
    }
    return Object.entries(timeBucketMap)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([time, count]) => ({ time, count }));
  }, [transactions]);

  // Tx count per account
  const transactionCountData = useMemo(() => {
    const transactionCountMap = {};
    for (const t of transactions) {
      transactionCountMap[t.sender_id] = (transactionCountMap[t.sender_id] || 0) + 1;
      transactionCountMap[t.receiver_id] = (transactionCountMap[t.receiver_id] || 0) + 1;
    }
    return Object.entries(transactionCountMap).map(([account, count]) => ({
      account,
      count,
      suspicious: suspiciousSet.has(account),
    }));
  }, [transactions, suspiciousSet]);

  // Ring edges → color
  const ringEdgeMap = useMemo(() => buildRingEdgeMap(output, graph), [output, graph]);

  const linkColor = (l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    const key = `${s}->${t}`;
    const typ = ringEdgeMap.get(key);

    if (typ === "cycle") return "#ef4444";
    if (typ === "smurfing_fanin") return "#f97316";
    if (typ === "smurfing_fanout") return "#60a5fa";
    if (typ === "shell_chain") return "#a78bfa";
    return "rgba(148,163,184,0.35)";
  };

  const linkWidth = (l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    const key = `${s}->${t}`;
    return ringEdgeMap.has(key) ? 2.2 : 1;
  };

  function getNodeDetails(nodeId) {
    if (!nodeId || !graph) return null;
    const st = graph.stats.get(nodeId);
    const suspiciousObj = (output?.suspicious_accounts || []).find((x) => x.account_id === nodeId);
    return {
      id: nodeId,
      inDegree: graph.in.get(nodeId)?.size || 0,
      outDegree: graph.out.get(nodeId)?.size || 0,
      totalTx: st?.totalTx || 0,
      firstTs: st?.firstTs ? new Date(st.firstTs).toLocaleString() : "—",
      lastTs: st?.lastTs ? new Date(st.lastTs).toLocaleString() : "—",
      suspicion: suspiciousObj?.suspicion_score ?? null,
      patterns: suspiciousObj?.detected_patterns ?? [],
      ringId: suspiciousObj?.ring_id ?? null,
    };
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#e5e7eb" }}>
      {/* HEADER */}
      <div
        style={{
          padding: "18px 24px",
          borderBottom: "1px solid #1f2933",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(180deg, rgba(2,6,23,0.95), rgba(11,15,20,0.95))",
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(10px)",
        }}
      >
        <div>
          <h2 style={{ color: "#14ff6e", margin: 0, letterSpacing: 0.2 }}>
            LaunderLens <span style={{ color: "#9ca3af" }}>— Investigation Dashboard</span>
          </h2>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Upload a CSV → detect cycles, smurfing, and shell chains → export JSON.
          </div>
        </div>

        <label className="update-btn">
          ⬆ Upload New CSV
          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
            hidden
          />
        </label>
      </div>

      {/* CONTENT */}
      <div style={{ padding: 24, maxWidth: 1300, margin: "0 auto" }}>
        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.35)",
              padding: 12,
              borderRadius: 12,
              color: "#fecaca",
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* SUMMARY */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
          }}
        >
          <SummaryCard label="Rows Loaded" value={rows.length} />
          <SummaryCard label="Transactions" value={transactions.length} />
          <SummaryCard label="Cycle Rings" value={cycleRings.length} color="#facc15" />
          <SummaryCard label="Suspicious Accounts" value={suspiciousSet.size} color="#ef4444" />
          <SummaryCard label="Total Rings" value={ringCounts.total} color="#60a5fa" />
          <SummaryCard label="Smurf Rings" value={ringCounts.smurf} color="#f97316" />
          <SummaryCard label="Shell Rings" value={ringCounts.shell} color="#a78bfa" />
        </div>

        {/* ACTIONS */}
        {output && (
          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={() => downloadJSON(output)}
              style={{
                padding: "12px 22px",
                fontSize: "0.95rem",
                fontWeight: 600,

                background: "transparent",
                color: "#14ff6e",

                border: "1.5px solid #14ff6e",
                borderRadius: "10px",

                cursor: "pointer",
                transition: "all 0.25s ease",

                boxShadow: "0 0 0 rgba(20, 255, 110, 0)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#5ccd88";
                e.currentTarget.style.color = "#000";
                e.currentTarget.style.boxShadow =
                  "0 0 18px rgba(20, 255, 110, 0.7), 0 0 40px rgba(20, 255, 110, 0.4)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#14ff6e";
                e.currentTarget.style.boxShadow = "0 0 0 rgba(20, 255, 110, 0)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              ⬇ Download Investigation Report
            </button>

            <div style={{ fontSize: 12, opacity: 0.75, alignSelf: "center" }}>
              Output matches the required judge JSON format (suspicious_accounts + fraud_rings + summary).
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {transactionTimeSeries.length > 0 && transactionCountData.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: 18,
              marginTop: 26,
            }}
          >
            <div
              style={{
                background: "#020617",
                borderRadius: 14,
                padding: 14,
                border: "1px solid #1f2933",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Transaction Activity (hour buckets)</h3>
                <span style={{ fontSize: 12, opacity: 0.7 }}>72h signal is inside detection</span>
              </div>

              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={transactionTimeSeries}>
                    <CartesianGrid stroke="#1f2933" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "#9ca3af", fontSize: 11 }}
                      minTickGap={20}
                    />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#14ff6e" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              style={{
                background: "#111827",
                borderRadius: 14,
                padding: 14,
                border: "1px solid #1f2933",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Transactions per Account</h3>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Quick outlier view</span>
              </div>

              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={transactionCountData} barCategoryGap={26}>
                    <CartesianGrid stroke="#1f2933" vertical={false} />
                    <XAxis dataKey="account" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" barSize={34} fill="#14ff6e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* GRAPH */}
        <div style={{ marginTop: 28 }}>
          <div style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Graph: Money Flow Network</h3>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.78, lineHeight: 1.45 }}>
              Nodes = accounts. Directed edges = transactions (sender → receiver). Shapes are pinned by detected ring type.
              Hover a node to inspect. Click to pin.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 10,
              flexWrap: "wrap",
              background: "rgba(2,6,23,0.7)",
              border: "1px solid #1f2933",
              padding: 10,
              borderRadius: 12,
            }}
          >
            <LegendDot color="#14ff6e" label="Normal account" />
            <LegendDot color="#ef4444" label="Suspicious account" />
            <LegendDot color="#ef4444" label="Cycle edge" line />
            <LegendDot color="#f97316" label="Smurfing fan-in edge" line />
            <LegendDot color="#60a5fa" label="Smurfing fan-out edge" line />
            <LegendDot color="#a78bfa" label="Shell chain edge" line />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>
            {/* Graph Box */}
            <div
              style={{
                height: 600,
                background: "#020617",
                borderRadius: 14,
                border: "1px solid #1f2933",
                overflow: "hidden",
                boxShadow: "0 0 22px rgba(20,255,110,0.06)",
              }}
            >
              {fgData ? (
                <ForceGraph2D
                  ref={fgRef}
                  graphData={fgData}

                  /* FULLY LOCKED */
                  enableZoomInteraction={false}
                  enablePanInteraction={false}
                  enableNodeDrag={false}
                  cooldownTicks={0}

                  nodeCanvasObject={(node, ctx) => {
                    const pinnedId = activeNodePinned?.id;
                    const hoverId = activeNode?.id;
                    const isActive = node.id === pinnedId || node.id === hoverId;

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, suspiciousSet.has(node.id) ? 7 : 5, 0, 2 * Math.PI);
                    ctx.fillStyle = suspiciousSet.has(node.id) ? "#ef4444" : "#14ff6e";
                    ctx.fill();

                    if (isActive) {
                      ctx.lineWidth = 2;
                      ctx.strokeStyle = "#ffffff";
                      ctx.stroke();
                    }
                  }}

                  linkColor={linkColor}
                  linkWidth={linkWidth}

                  onNodeHover={(node) => {
                    if (!node) {
                      if (!activeNodePinned) setActiveNode(null);
                      return;
                    }
                    if (activeNodePinned) return;
                    setActiveNode(getNodeDetails(node.id));
                  }}

                  onNodeClick={(node) => {
                    if (!node) return;
                    const details = getNodeDetails(node.id);
                    if (activeNodePinned?.id === node.id) {
                      setActiveNodePinned(null);
                      setActiveNode(null);
                    } else {
                      setActiveNodePinned(details);
                      setActiveNode(details);
                    }
                  }}
                />
              ) : (
                <div style={{ padding: 16, opacity: 0.7 }}>
                  Upload a CSV to render the graph.
                </div>
              )}
            </div>

            {/* Inspector */}
            <div
              style={{
                height: 600,
                background: "#111827",
                borderRadius: 14,
                border: "1px solid #1f2933",
                padding: 14,
                overflow: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <h4 style={{ margin: 0 }}>Node Inspector</h4>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                    Hover to preview • Click to pin
                  </div>
                </div>

                {activeNodePinned && (
                  <button
                    onClick={() => {
                      setActiveNodePinned(null);
                      setActiveNode(null);
                    }}
                    style={{
                      background: "rgba(239,68,68,0.9)",
                      color: "#0b0f14",
                      border: "none",
                      padding: "8px 12px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontWeight: 900,
                      height: 36,
                    }}
                  >
                    Unpin
                  </button>
                )}
              </div>

              <div style={{ height: 1, background: "#1f2933", margin: "12px 0" }} />

              {!(activeNodePinned || activeNode) ? (
                <div style={{ opacity: 0.75, fontSize: 13, lineHeight: 1.55 }}>
                  No node selected.
                  <br />
                  Hover a node in the graph to see its stats.
                </div>
              ) : (
                (() => {
                  const d = activeNodePinned || activeNode;
                  return (
                    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{d.id}</div>
                      <div style={{ opacity: 0.75 }}>
                        {activeNodePinned ? "Pinned node" : "Hover node"}
                      </div>

                      <div style={{ height: 1, background: "#1f2933", margin: "12px 0" }} />

                      <div><b>In-degree:</b> {d.inDegree}</div>
                      <div><b>Out-degree:</b> {d.outDegree}</div>
                      <div><b>Total transactions:</b> {d.totalTx}</div>
                      <div><b>First seen:</b> {d.firstTs}</div>
                      <div><b>Last seen:</b> {d.lastTs}</div>

                      <div style={{ height: 1, background: "#1f2933", margin: "12px 0" }} />

                      <div>
                        <b>Suspicion score:</b>{" "}
                        {d.suspicion === null ? (
                          <span style={{ opacity: 0.7 }}>Not flagged</span>
                        ) : (
                          <span style={{ color: "#ef4444", fontWeight: 900 }}>{d.suspicion}</span>
                        )}
                      </div>

                      {d.ringId && <div><b>Ring ID:</b> {d.ringId}</div>}

                      {d.patterns?.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <b>Detected patterns:</b>
                          <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                            {d.patterns.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* TABLE */}
        {output?.fraud_rings?.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <h3 style={{ marginBottom: 10 }}>Detected Fraud Rings</h3>

            <div
              style={{
                borderRadius: 14,
                border: "1px solid #1f2933",
                overflow: "auto",
                background: "#0b1220",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Ring ID</th>
                    <th style={th}>Pattern Type</th>
                    <th style={th}>Member Count</th>
                    <th style={th}>Risk Score</th>
                    <th style={th}>Member Account IDs</th>
                  </tr>
                </thead>
                <tbody>
                  {output.fraud_rings.map((ring) => (
                    <tr key={ring.ring_id}>
                      <td style={td}>{ring.ring_id}</td>
                      <td style={td}>{prettyPattern(ring.pattern_type)}</td>
                      <td style={td}>{ring.member_accounts.length}</td>
                      <td style={{ ...td, color: "#ef4444", fontWeight: 900 }}>
                        {ring.risk_score}
                      </td>
                      <td style={{ ...td, opacity: 0.85 }}>
                        {ring.member_accounts.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Tip: Use this table in your demo video — it matches the judge’s required “Fraud Ring Summary Table”.
            </div>
          </div>
        )}

        {/* FOOTER NOTE */}
        <div style={{ marginTop: 40, paddingBottom: 40, opacity: 0.6, fontSize: 12 }}>
          LaunderLens • Graph-based financial crime detection • CSV in → Rings out • Export JSON.
        </div>
      </div>
    </div>
  );
}
