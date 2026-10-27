import { useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { ApiStatus } from '@/components/ApiStatus.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Link } from '@/lib/Link.jsx';
import { saveTheme } from '@/lib/theme.js';

const NAV = [
  { href: '/', label: 'Scan' },
  { href: '/history', label: 'History' },
  { href: '/business', label: 'Business' },
];

/**
 * @param {{ healthState: string, health: object | null, path: string, children: import('react').ReactNode }} props
 */
export function Shell({ healthState, health, path, children }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
            <Link href="/" className="text-foreground no-underline hover:underline">
              AccessFix
            </Link>
          </p>
          <nav aria-label="Primary">
            <ul className="flex flex-wrap items-center gap-3">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`min-h-10 inline-flex items-center px-1 text-sm ${
                      path === item.href ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    aria-current={path === item.href ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            {health?.limits.privateUrlsAllowed && (
              <Badge className="border-moderate text-moderate">
                <ShieldAlert aria-hidden="true" className="size-3.5" />
                Private network scanning enabled (dev only)
              </Badge>
            )}
            <ThemeControl />
            <ApiStatus state={healthState} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </>
  );
}

const THEMES = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

function ThemeControl() {
  const [mode, setMode] = useState(() => document.documentElement.dataset.theme || 'system');
  return (
    <div role="group" aria-label="Color theme" className="flex rounded-md border">
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          aria-pressed={mode === theme.id}
          className={`min-h-10 px-2 text-sm ${
            mode === theme.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-background'
          }`}
          onClick={() => setMode(saveTheme(theme.id))}
        >
          {theme.label}
        </button>
      ))}
    </div>
  );
}
