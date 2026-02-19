export function detectCycles(out) {
  const rings = [];
  const seen = new Set(); // stores canonical keys like "A|B|C"

  const nodes = Array.from(out.keys());
  const hasEdge = (a, b) => out.get(a)?.has(b);

  for (const a of nodes) {
    for (const b of out.get(a) || []) {
      if (b === a) continue;

      for (const c of out.get(b) || []) {
        if (c === a || c === b) continue;

        // cycle length 3: A -> B -> C -> A
        if (hasEdge(c, a)) {
          const members = [a, b, c];

          // canonical key = sorted members (order-independent)
          const key = [...members].sort().join("|");

          if (!seen.has(key)) {
            seen.add(key);
            rings.push(members);
          }
        }
      }
    }
  }

  return rings;
}
