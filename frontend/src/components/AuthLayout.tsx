import React from "react";
import { motion } from "framer-motion";
import { Blocks, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { Footer } from "./Footer";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative flex min-h-screen flex-col bg-background bg-grid-pattern">
      <div className="pointer-events-none absolute inset-0 gradient-glow opacity-90" aria-hidden />
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary/60 text-muted-foreground transition-colors hover:text-foreground md:right-8 md:top-6"
        aria-label={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <div className="relative z-10 flex flex-1 flex-col">
        <main className="flex flex-1 items-center justify-center px-4 pb-12 pt-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative z-10 w-full max-w-md"
          >
            <div className="gradient-card rounded-2xl border border-border p-8 shadow-elevated">
              <div className="mb-8 flex justify-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-primary">
                  <Blocks className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <h1 className="mb-2 text-center text-2xl font-bold text-foreground">{title}</h1>
              {subtitle ? <p className="mb-8 text-center text-sm text-muted-foreground">{subtitle}</p> : <div className="mb-6" />}
              {children}
            </div>
          </motion.div>
        </main>

        <Footer />
      </div>
    </div>
  );
};
