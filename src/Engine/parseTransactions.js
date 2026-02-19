export function parseTransactions(rows) {
  return rows.map((r) => ({
    transaction_id: String(r.transaction_id).trim(),
    sender_id: String(r.sender_id).trim(),
    receiver_id: String(r.receiver_id).trim(),
    amount: Number(r.amount),
    timestamp: new Date(String(r.timestamp).replace(" ", "T")),
  }));
}
