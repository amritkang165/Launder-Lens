export function buildGraph(transactions) {
  const out = new Map(); // who sends to whom
  const stats = new Map(); // transaction counts

  function ensure(id) {
    if (!out.has(id)) out.set(id, new Set());
    if (!stats.has(id)) stats.set(id, { in: 0, out: 0 });
  }

  for (const t of transactions) {
    ensure(t.sender_id);
    ensure(t.receiver_id);

    out.get(t.sender_id).add(t.receiver_id);

    stats.get(t.sender_id).out++;
    stats.get(t.receiver_id).in++;
  }

  return { out, stats };
}
