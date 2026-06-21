"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoSvg } from "./svg-icons";
import { Menu, X, Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";

function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    const next = !html.classList.contains("dark");
    if (next) {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    setIsDark(next);
  };

  // Only show marketing navbar on home page
  if (pathname !== "/") return null;

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "/courses", label: "Dashboard" },
  ];

  const scrollToUpload = () => {
    const el = document.getElementById("upload-zone");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <header className="sticky top-0 z-50 h-16 border-b-[0.5px] border-border dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md transition-colors duration-300">
      <div className="h-full max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Go to PDF to Lesson home page"
          className="flex items-center gap-2.5 text-neutral-950 dark:text-white"
        >
          <LogoSvg className="h-6 w-auto" aria-hidden="true" />
          <span className="font-sans text-lg font-bold leading-none tracking-normal whitespace-nowrap">
            PDF to Lesson
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors link-underline"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="interactive inline-flex h-9 w-9 items-center justify-center rounded-full border border-border dark:border-neutral-700 bg-surface-muted dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Button variant="ghost" size="sm" className="text-neutral-600 dark:text-neutral-300">
            Sign In
          </Button>
          <Button size="sm" onClick={scrollToUpload} className="dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">
            Get Started
          </Button>
        </div>

        {/* Mobile toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border dark:border-neutral-700 bg-surface-muted dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border dark:border-neutral-700 bg-surface-muted dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border dark:border-neutral-800 bg-white dark:bg-neutral-950 px-6 py-4 space-y-3 shadow-lg">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 border-t border-border dark:border-neutral-800 flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-neutral-600 dark:text-neutral-300"
            >
              Sign In
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setMobileOpen(false);
                scrollToUpload();
              }}
              className="w-full justify-center dark:bg-white dark:text-neutral-950"
            >
              Get Started
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

export { Navbar };
