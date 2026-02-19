// Detect directed cycles of length 3 to 5
// Returns array of rings, each ring = [A, B, C, ...] in cycle order
export function detectCycles(out, { minLen = 3, maxLen = 5, limit = 500 } = {}) {
  const rings = [];
  const seen = new Set();

  const nodes = Array.from(out.keys());
  const hasEdge = (a, b) => out.get(a)?.has(b);

  function addCycle(path) {
    // path is like [A,B,C] where last connects back to first
    const key = [...path].sort().join("|");
    if (seen.has(key)) return;
    seen.add(key);
    rings.push([...path]);
  }

  for (const start of nodes) {
    const stack = [[start, [start]]];

    while (stack.length) {
      const [cur, path] = stack.pop();

      // Stop growing beyond maxLen
      if (path.length > maxLen) continue;

      for (const nxt of out.get(cur) || []) {
        if (nxt === start) {
          // found a cycle
          const cycleLen = path.length;
          if (cycleLen >= minLen && cycleLen <= maxLen) {
            addCycle(path);
            if (rings.length >= limit) return rings;
          }
          continue;
        }

        // avoid revisiting nodes in the same path
        if (path.includes(nxt)) continue;

        // only extend if we still can reach maxLen
        if (path.length < maxLen) {
          stack.push([nxt, [...path, nxt]]);
        }
      }
    }
  }

  return rings;
}
