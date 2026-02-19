export function detectCycles(out, { minLen = 3, maxLen = 5 } = {}) {
  const rings = [];
  const seen = new Set();
  const nodes = Array.from(out.keys());

  const canon = (members) => [...members].sort().join("|");

  for (const start of nodes) {
    const path = [start];

    function dfs(curr) {
      if (path.length > maxLen) return;

      for (const nxt of out.get(curr) || []) {
        if (nxt === start) {
          if (path.length >= minLen) {
            const members = [...path];
            const key = canon(members);
            if (!seen.has(key)) {
              seen.add(key);
              rings.push(members);
            }
          }
          continue;
        }
        if (path.includes(nxt)) continue;
        path.push(nxt);
        dfs(nxt);
        path.pop();
      }
    }

    dfs(start);
  }

  return rings;
}
