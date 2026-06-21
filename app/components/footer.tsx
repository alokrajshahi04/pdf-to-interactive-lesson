import { Github } from "lucide-react";
import { XGlyph } from "./brand-icons";
import Link from "next/link";

function Footer() {
  return (
    <div className="w-full py-12 border-t border-border dark:border-neutral-800 bg-white dark:bg-neutral-950 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
          <div className="md:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-neutral-950 dark:text-white mb-4"
            >
              <span className="font-sans text-lg font-bold leading-none tracking-normal whitespace-nowrap">
                PDF to Lesson
              </span>
            </Link>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm leading-relaxed">
              Transform any PDF into an interactive, AI-powered learning experience.
              Built for students, educators, and lifelong learners.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Features", href: "/#features" },
                { label: "Pricing", href: "/#pricing" },
                { label: "Dashboard", href: "/courses" },
              ].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              {[
                {
                  label: "GitHub",
                  href: "https://github.com/Nutlope/pdf-to-interactive-lesson",
                },
                { label: "Twitter / X", href: "https://x.com/nutlope" },
                { label: "Powered by Together AI", href: "https://together.ai" },
              ].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <a
            href="https://together.ai"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Powered by together.ai"
            className="interactive inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white dark:bg-neutral-900 border border-border dark:border-neutral-700"
          >
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Powered by
            </span>
            <img
              src="/together-logo-light.png"
              alt="Together AI"
              className="h-3.5 w-auto"
            />
          </a>
          <div className="flex items-center gap-4">
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              &copy; {new Date().getFullYear()} PDF to Lesson
            </span>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/Nutlope/pdf-to-interactive-lesson"
                target="_blank"
                rel="noopener noreferrer"
                className="interactive w-8 h-8 rounded-full bg-surface-muted dark:bg-neutral-800 border border-border dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://x.com/nutlope"
                target="_blank"
                rel="noopener noreferrer"
                className="interactive w-8 h-8 rounded-full bg-surface-muted dark:bg-neutral-800 border border-border dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                aria-label="X (Twitter)"
              >
                <XGlyph className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Footer };
