/**
 * История входивших аккаунтов (email) — только для UI, пароли не хранятся.
 */
const STORAGE_KEY = "blockproof_login_history";
const MAX_ITEMS = 10;

export type LoginHistoryItem = {
  email: string;
  lastUsed: string; // ISO string
};

export function getLoginHistory(): LoginHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addToLoginHistory(email: string): void {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  const items = getLoginHistory().filter((i) => i.email.toLowerCase() !== normalized);
  items.unshift({ email: normalized, lastUsed: new Date().toISOString() });
  const trimmed = items.slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function selectFromHistory(email: string): void {
  addToLoginHistory(email);
}
