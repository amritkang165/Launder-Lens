// Layered shell networks:
// chains of 3+ hops where intermediate accounts have only 2–3 total transactions
// We’ll detect 3-hop chains: A -> B -> C -> D
// where B and C are "shell-like" (totalTx in [2..3])

export function detectShellChains(graph, { minHops = 3, maxInterTx = 3, minInterTx = 2, limit = 200 } = {}) {
  const rings = [];
  const seen = new Set();

  const stats = graph.stats;
  const out = graph.out;

  const isShell = (id) => {
    const s = stats.get(id);
    if (!s) return false;
    return s.totalTx >= minInterTx && s.totalTx <= maxInterTx;
  };

  // We focus on 3-hop chains: A->B->C->D (hops = 3)
  // B and C must be shell-like.
  for (const A of out.keys()) {
    for (const B of out.get(A) || []) {
      if (!isShell(B)) continue;

      for (const C of out.get(B) || []) {
        if (C === A) continue;
        if (!isShell(C)) continue;

        for (const D of out.get(C) || []) {
          if (D === B || D === A || D === C) continue;

          const members = [A, B, C, D];
          const key = [...members].sort().join("|");
          if (seen.has(key)) continue;

          seen.add(key);
          rings.push({
            members,
            path: [A, B, C, D]
          });

          if (rings.length >= limit) return rings;
        }
      }
    }
  }

  return rings;
}
