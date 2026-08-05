"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Wordmark } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/#terminal", label: "Terminal" },
  { href: "/track-record", label: "Track record" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/methodology", label: "Methodology" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={cn(
          "flex w-full max-w-6xl items-center justify-between gap-4 rounded-2xl border px-4 py-2.5 transition-all duration-300",
          scrolled
            ? "border-white/[0.08] bg-panel/70 backdrop-blur-xl shadow-panel"
            : "border-transparent bg-transparent",
        )}
      >
        <Link href="/" className="cursor-pointer" aria-label="Candor home">
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm text-fg-dim transition-colors duration-200 hover:bg-white/[0.05] hover:text-fg cursor-pointer"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden lg:inline-flex chip !text-[0.6rem] text-fg-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-amber animate-pulse-soft" />
            Not investment advice
          </span>
          <Link href="/#terminal" className="btn-primary hidden px-4 py-2 text-sm sm:inline-flex">
            Run analysis
            <ArrowUpRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost h-9 w-9 !px-0 md:hidden"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute inset-x-4 top-20 z-50 rounded-2xl border border-white/[0.08] bg-panel/95 p-2 backdrop-blur-xl md:hidden"
          >
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 text-sm text-fg-dim hover:bg-white/[0.05] hover:text-fg cursor-pointer"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/#terminal"
              onClick={() => setOpen(false)}
              className="btn-primary mt-1 w-full py-3 text-sm"
            >
              Run analysis <ArrowUpRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
