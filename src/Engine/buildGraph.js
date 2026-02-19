export function buildGraph(transactions) {
  const out = new Map();       // sender -> Set(receivers)
  const inMap = new Map();     // receiver -> Set(senders)
  const outTx = new Map();     // sender -> [transactions]
  const inTx = new Map();      // receiver -> [transactions]
  const stats = new Map();     // id -> {in, out, totalTx, firstTs, lastTs}

  function ensure(id) {
    if (!out.has(id)) out.set(id, new Set());
    if (!inMap.has(id)) inMap.set(id, new Set());
    if (!outTx.has(id)) outTx.set(id, []);
    if (!inTx.has(id)) inTx.set(id, []);
    if (!stats.has(id)) {
      stats.set(id, {
        in: 0,
        out: 0,
        totalTx: 0,
        firstTs: null,
        lastTs: null
      });
    }
  }

  for (const t of transactions) {
    ensure(t.sender_id);
    ensure(t.receiver_id);

    // structure
    out.get(t.sender_id).add(t.receiver_id);
    inMap.get(t.receiver_id).add(t.sender_id);

    // store transactions
    outTx.get(t.sender_id).push(t);
    inTx.get(t.receiver_id).push(t);

    // update stats
    const s = stats.get(t.sender_id);
    s.out++;
    s.totalTx++;
    s.firstTs = s.firstTs ? new Date(Math.min(s.firstTs, t.timestamp)) : t.timestamp;
    s.lastTs  = s.lastTs  ? new Date(Math.max(s.lastTs, t.timestamp))  : t.timestamp;

    const r = stats.get(t.receiver_id);
    r.in++;
    r.totalTx++;
    r.firstTs = r.firstTs ? new Date(Math.min(r.firstTs, t.timestamp)) : t.timestamp;
    r.lastTs  = r.lastTs  ? new Date(Math.max(r.lastTs, t.timestamp))  : t.timestamp;
  }

  // sort transactions by time (needed for sliding window)
  for (const arr of outTx.values()) {
    arr.sort((a, b) => a.timestamp - b.timestamp);
  }
  for (const arr of inTx.values()) {
    arr.sort((a, b) => a.timestamp - b.timestamp);
  }

  return { out, in: inMap, outTx, inTx, stats };
}
