const WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours

// returns the max unique counterparties in any 72h window + the best window range
function maxUniqueWithinWindow(txArr, keyFn) {
  let bestCount = 0;
  let bestI = 0;
  let bestJ = 0;

  let i = 0;
  const freq = new Map();

  for (let j = 0; j < txArr.length; j++) {
    const k = keyFn(txArr[j]);
    freq.set(k, (freq.get(k) || 0) + 1);

    while (txArr[j].timestamp - txArr[i].timestamp > WINDOW_MS) {
      const ki = keyFn(txArr[i]);
      freq.set(ki, freq.get(ki) - 1);
      if (freq.get(ki) === 0) freq.delete(ki);
      i++;
    }

    if (freq.size > bestCount) {
      bestCount = freq.size;
      bestI = i;
      bestJ = j;
    }
  }

  return { bestCount, bestI, bestJ };
}

export function detectSmurfing(graph, { threshold = 10 } = {}) {
  const fanIn = [];  // many senders -> one receiver (aggregator)
  const fanOut = []; // one sender -> many receivers (disperser)

  // FAN-IN: for each receiver account, check its inbound tx list
  for (const [acc, arr] of graph.inTx.entries()) {
    if (!arr || arr.length < threshold) continue;

    const { bestCount, bestI, bestJ } = maxUniqueWithinWindow(arr, (t) => t.sender_id);
    if (bestCount >= threshold) {
      const windowTx = arr.slice(bestI, bestJ + 1);
      const senders = Array.from(new Set(windowTx.map((t) => t.sender_id)));
      fanIn.push({
        hub: acc,
        members: [acc, ...senders],
        uniqueCounterparties: bestCount
      });
    }
  }

  // FAN-OUT: for each sender account, check its outbound tx list
  for (const [acc, arr] of graph.outTx.entries()) {
    if (!arr || arr.length < threshold) continue;

    const { bestCount, bestI, bestJ } = maxUniqueWithinWindow(arr, (t) => t.receiver_id);
    if (bestCount >= threshold) {
      const windowTx = arr.slice(bestI, bestJ + 1);
      const receivers = Array.from(new Set(windowTx.map((t) => t.receiver_id)));
      fanOut.push({
        hub: acc,
        members: [acc, ...receivers],
        uniqueCounterparties: bestCount
      });
    }
  }

  return { fanIn, fanOut };
}
