import React, { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Blocks,
  ClipboardCheck,
  FileText,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Upload,
  User,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Footer } from "./Footer";
import { BRAND_NAME } from "../constants/brand";
import { cn } from "../lib/utils";
import { getRoleLabel } from "../utils/roleLabels";

type NavItem = { title: string; path: string; icon: LucideIcon };

function useIsMd() {
  const [isMd, setIsMd] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 768px)").matches : true
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const fn = () => setIsMd(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return isMd;
}

export const Layout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMd = useIsMd();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navItems = useMemo((): NavItem[] => {
    const items: NavItem[] = [{ title: "Панель", path: "/dashboard", icon: LayoutDashboard }];
    if (user?.role === "department") {
      items.push({ title: "Загрузка", path: "/upload", icon: Upload });
    }
    items.push(
      { title: "Мои документы", path: "/files", icon: FileText },
      { title: "Реестр", path: "/global", icon: Globe },
      { title: "Верификация", path: "/verify", icon: ShieldCheck },
      { title: "Профиль", path: "/profile", icon: User }
    );
    if (user?.role === "dean") {
      items.push({ title: "На согласование", path: "/dean-queue", icon: ClipboardCheck });
    }
    if (user?.role === "admin") {
      items.push(
        { title: "Журнал", path: "/explorer", icon: Activity },
        { title: "Админ", path: "/admin", icon: Settings }
      );
    }
    return items;
  }, [user?.role]);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const onLogout = () => {
    logout();
    navigate("/");
  };

  const sidebarWidth = collapsed ? 72 : 260;
  const displayName = user?.email?.split("@")[0] || user?.email || "Пользователь";
  const email = user?.email || "—";
  const roleLabel = user?.role ? getRoleLabel(user.role) : "";

  const NavLinks = ({ expanded, layoutIdPrefix, onNavigate }: { expanded: boolean; layoutIdPrefix: string; onNavigate?: () => void }) => (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
              active
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            {active && (
              <motion.div
                layoutId={`${layoutIdPrefix}-nav`}
                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <item.icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
            <AnimatePresence>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap text-sm font-medium"
                >
                  {item.title}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        );
      })}
    </nav>
  );

  const SidebarFooter = ({ expanded }: { expanded: boolean }) => (
    <div className="border-t border-border px-3 py-4">
      <div className={cn("flex items-center gap-3 px-2", !expanded && "justify-center")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <User className="h-4 w-4 text-primary" />
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-w-0 flex-1 overflow-hidden"
            >
              <p className="truncate text-sm font-medium text-foreground" title={email}>
                {displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground" title={email}>
                {email}
              </p>
              {roleLabel && (
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{roleLabel}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className={cn("mt-3 flex gap-2 px-2", !expanded && "flex-col items-center")}>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-secondary/50 px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {expanded && <span>{theme === "dark" ? "Светлая" : "Тёмная"}</span>}
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-secondary/50 px-2 py-2 text-xs text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {expanded && <span>Выйти</span>}
        </button>
      </div>
    </div>
  );

  if (authLoading && location.pathname === "/verify") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  const guestVerifyPage = !user && location.pathname === "/verify";

  if (guestVerifyPage) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md md:px-8">
          <Link to="/" className="flex items-center gap-2 text-foreground no-underline">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
              <Blocks className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">{BRAND_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-accent, #0d9488)" }}
            >
              Войти
            </Link>
            <Link
              to="/register"
              className="rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              Регистрация
            </Link>
          </div>
        </header>
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="fixed left-0 top-0 z-40 hidden h-screen flex-col overflow-hidden border-r border-border bg-sidebar md:flex"
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
            <Blocks className="h-5 w-5 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap font-semibold text-foreground"
              >
                {BRAND_NAME}
              </motion.span>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </button>
        </div>
        <NavLinks expanded={!collapsed} layoutIdPrefix="desk" />
        <SidebarFooter expanded={!collapsed} />
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Закрыть меню"
              className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col overflow-hidden border-r border-border bg-sidebar md:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
            >
              <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
                  <Blocks className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">{BRAND_NAME}</span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  aria-label="Закрыть"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks expanded layoutIdPrefix="mob" onNavigate={() => setMobileOpen(false)} />
              <SidebarFooter expanded />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main
        className="min-h-screen"
        style={{ paddingLeft: isMd ? sidebarWidth : 0 }}
      >
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md md:hidden">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary/60 text-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Открыть меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">{BRAND_NAME}</span>
        </div>

        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>

        <Footer />
      </main>
    </div>
  );
};
