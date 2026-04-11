export const DASHBOARD_REFRESH_EVENT = "blockproof:dashboard-refresh";

export function notifyDashboardRefresh(): void {
  window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT));
}
