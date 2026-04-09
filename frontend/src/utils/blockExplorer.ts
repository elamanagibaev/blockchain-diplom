/** База URL блокчейн-обозревателя (например https://sepolia.etherscan.io). Без завершающего /. */
export function getBlockExplorerBase(): string {
  const raw = (import.meta.env.VITE_BLOCK_EXPLORER_URL || "https://explorer.local").trim();
  return raw.replace(/\/+$/, "");
}

/** Ссылка на tx (для страниц с локальным fallback). */
export function getExplorerTxUrl(txHash: string): string {
  const base = getBlockExplorerBase();
  const h = (txHash || "").trim();
  if (!h) return base;
  return `${base}/tx/${h}`;
}

/**
 * Fallback после поля tx_explorer_url из API: только если задан VITE_BLOCK_EXPLORER_URL.
 * Иначе пустая строка — кнопка «Открыть в обозревателе» остаётся неактивной.
 */
export function getExplorerTxUrlOptional(txHash: string): string {
  const raw = (import.meta.env.VITE_BLOCK_EXPLORER_URL || "").trim().replace(/\/+$/, "");
  const h = (txHash || "").trim();
  if (!h || !raw) return "";
  return `${raw}/tx/${h}`;
}
