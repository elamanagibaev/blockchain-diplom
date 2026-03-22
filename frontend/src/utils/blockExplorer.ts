/** База URL блокчейн-обозревателя (например https://sepolia.etherscan.io). Без завершающего /. */
export function getBlockExplorerBase(): string {
  const raw = (import.meta.env.VITE_BLOCK_EXPLORER_URL || "https://explorer.local").trim();
  return raw.replace(/\/+$/, "");
}

export function getExplorerTxUrl(txHash: string): string {
  const base = getBlockExplorerBase();
  const h = (txHash || "").trim();
  if (!h) return base;
  return `${base}/tx/${h}`;
}
