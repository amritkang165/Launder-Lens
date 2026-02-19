import { detectSmurfing } from "./detectSmurfing";
import { detectShellChains } from "./detectShellChains";

export function runDetection(transactions, graph, cycleRings) {
  const t0 = performance.now();

  // 1) Start with cycle rings
  const fraud_rings = cycleRings.map((members, idx) => ({
    ring_id: `RING_${String(idx + 1).padStart(3, "0")}`,
    member_accounts: members,
    pattern_type: "cycle",
    risk_score: 90.0
  }));

  // 2) Add smurfing rings BEFORE building suspiciousMap
  const smurf = detectSmurfing(graph, { threshold: 10 });

  smurf.fanIn.forEach((x) => {
    fraud_rings.push({
      ring_id: `RING_${String(fraud_rings.length + 1).padStart(3, "0")}`,
      member_accounts: x.members,
      pattern_type: "smurfing_fanin",
      risk_score: Number(Math.min(99, 70 + x.uniqueCounterparties * 2).toFixed(1))
    });
  });

  smurf.fanOut.forEach((x) => {
    fraud_rings.push({
      ring_id: `RING_${String(fraud_rings.length + 1).padStart(3, "0")}`,
      member_accounts: x.members,
      pattern_type: "smurfing_fanout",
      risk_score: Number(Math.min(99, 70 + x.uniqueCounterparties * 2).toFixed(1))
    });
  });
  // ---- Shell / layering detection (3-hop chains) ----
  const shells = detectShellChains(graph, { minHops: 3, minInterTx: 2, maxInterTx: 3, limit: 200 });

  const seenShell = new Set();


  shells.forEach((x) => {
    fraud_rings.push({
      ring_id: `RING_${String(fraud_rings.length + 1).padStart(3, "0")}`,
      member_accounts: x.members,
      pattern_type: "shell_chain",
      risk_score: 92.0
    });
  });

  // 3) Now build suspicious accounts from ALL rings (cycles + smurfing)
  const suspiciousMap = new Map();

  for (const ring of fraud_rings) {
    const len = ring.member_accounts.length;

    for (const acc of ring.member_accounts) {
      const prev = suspiciousMap.get(acc) || {
        account_id: acc,
        suspicion_score: 0,
        detected_patterns: [],
        ring_id: ring.ring_id
      };

      // Keep the ring id that gives the highest suspicion_score
const beforeScore = prev.suspicion_score;


// we compute afterScore via the pattern ladder below,
// so we will set ring_id after updating suspicion_score.


      if (ring.pattern_type === "cycle") {
  prev.detected_patterns.push(`cycle_length_${len}`);
  prev.suspicion_score = Math.max(prev.suspicion_score, 80 + (5 - len) * 2);

} else if (ring.pattern_type === "smurfing_fanin") {
  prev.detected_patterns.push("fan_in_72h");
  prev.suspicion_score = Math.max(prev.suspicion_score, 88);

} else if (ring.pattern_type === "smurfing_fanout") {
  prev.detected_patterns.push("fan_out_72h");
  prev.suspicion_score = Math.max(prev.suspicion_score, 88);

} else if (ring.pattern_type === "shell_chain") {
  prev.detected_patterns.push("layering_3hop");
  prev.suspicion_score = Math.max(prev.suspicion_score, 90);
}

if (prev.suspicion_score > beforeScore) {
  prev.ring_id = ring.ring_id;
}


      suspiciousMap.set(acc, prev);
    }
  }

  const suspicious_accounts = Array.from(suspiciousMap.values())
    .map((x) => ({
      ...x,
      suspicion_score: Number(x.suspicion_score.toFixed(1)),
      detected_patterns: Array.from(new Set(x.detected_patterns))
    }))
    .sort((a, b) => b.suspicion_score - a.suspicion_score);

    // ---- False-positive guard (merchant/payroll-like accounts) ----


      // ---- False-positive guard (merchant/payroll-like accounts) ----
  // If an account has very high total transactions AND long activity span,
  // reduce score when it's only flagged by smurfing (no cycle/shell).
  const guarded = suspicious_accounts.map((acc) => {
    const s = graph.stats.get(acc.account_id);
    if (!s || !s.firstTs || !s.lastTs) return acc;

    const activeDays = (s.lastTs - s.firstTs) / (1000 * 60 * 60 * 24);
    const totalTx = s.totalTx;

    const patterns = acc.detected_patterns || [];
    const hasCycle = patterns.some((p) => p.startsWith("cycle_length_"));
    const hasShell = patterns.includes("layering_3hop");
    const hasOnlySmurf =
      !hasCycle &&
      !hasShell &&
      patterns.every((p) => p === "fan_in_72h" || p === "fan_out_72h");

    // tuneable thresholds
    if (hasOnlySmurf && totalTx >= 200 && activeDays >= 7) {
      const newScore = Math.max(0, acc.suspicion_score - 25);
      return { ...acc, suspicion_score: newScore };
    }

    return acc;
  });

  // Remove very low-confidence after guard (optional but useful)
  const suspicious_accounts_guarded = guarded
    .filter((x) => x.suspicion_score >= 60)
    .sort((a, b) => b.suspicion_score - a.suspicion_score);

  const t1 = performance.now();

  return {
    suspicious_accounts: suspicious_accounts_guarded,
    fraud_rings,
    summary: {
      total_accounts_analyzed: graph?.stats?.size ?? 0,
      suspicious_accounts_flagged: suspicious_accounts_guarded.length,

      fraud_rings_detected: fraud_rings.length,
      processing_time_seconds: Number(((t1 - t0) / 1000).toFixed(2))
    }
  };
}
