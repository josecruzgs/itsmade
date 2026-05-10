import Link from "next/link";

export function AuthBrand() {
  return (
    <Link
      href="/"
      className="mb-6 flex items-center justify-center gap-2 text-base font-semibold text-slate-900 hover:opacity-80 dark:text-white"
    >
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-600 text-white shadow-sm">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Sparkle limpieza */}
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <span className="text-lg">itsMade</span>
    </Link>
  );
}
