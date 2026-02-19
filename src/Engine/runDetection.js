export function runDetection(transactions, graph, cycleRings) {
  const t0 = performance.now();

  const fraud_rings = cycleRings.map((members, idx) => ({
    ring_id: `RING_${String(idx + 1).padStart(3, "0")}`,
    member_accounts: members,
    pattern_type: "cycle",
    risk_score: 90.0
  }));

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

      prev.ring_id = ring.ring_id;
      prev.detected_patterns.push(`cycle_length_${len}`);
      prev.suspicion_score = Math.max(prev.suspicion_score, 80 + (5 - len) * 2); // deterministic
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

  const t1 = performance.now();

  return {
    suspicious_accounts,
    fraud_rings,
    summary: {
      total_accounts_analyzed: graph?.stats?.size ?? 0,
      suspicious_accounts_flagged: suspicious_accounts.length,
      fraud_rings_detected: fraud_rings.length,
      processing_time_seconds: Number(((t1 - t0) / 1000).toFixed(2))
    }
  };
}
