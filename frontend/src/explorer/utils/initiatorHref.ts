import type { InitiatorRef } from "../types";

/** Ссылка для инициатора: сервис не кликается; кошелёк 0x… → страница поиска по кошельку. */
export function resolveInitiatorHref(ini: InitiatorRef): string | undefined {
  if (ini.kind === "service") return undefined;
  if (ini.href) return ini.href;
  const a = ini.display.trim();
  if (ini.kind === "wallet" && /^0x[a-fA-F0-9]{40}$/.test(a)) {
    return `/profile/user?w=${encodeURIComponent(a)}`;
  }
  return undefined;
}
