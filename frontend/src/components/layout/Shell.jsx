import { useEffect, useState } from 'react';
import { LogOut, Menu, Monitor, Moon, ShieldAlert, Sun, X } from 'lucide-react';
import { ApiStatus } from '@/components/ApiStatus.jsx';
import { getMe, logout } from '@/lib/api.js';
import { Link } from '@/lib/Link.jsx';
import { navigate } from '@/lib/path.js';
import { saveTheme } from '@/lib/theme.js';

const NAV = [
  { href: '/', label: 'Scan' },
  { href: '/projects', label: 'Projects' },
  { href: '/history', label: 'History' },
  { href: '/business', label: 'Business' },
];

/** A web thread around a check: the product's mark. */
export function Mark({ className = 'size-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="7" fill="var(--primary)" />
      <g fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1">
        <path d="M16 3v26M3 16h26M6.8 6.8l18.4 18.4M25.2 6.8 6.8 25.2" />
        <path d="M16 9.5 20.6 11.4 22.5 16 20.6 20.6 16 22.5 11.4 20.6 9.5 16 11.4 11.4Z" />
      </g>
      <path d="m11 16.5 3.4 3.3 6.6-7.3" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useAccount(path) {
  const [email, setEmail] = useState(null);
  useEffect(() => {
    let active = true;
    getMe()
      .then((me) => active && setEmail(me.email))
      .catch(() => active && setEmail(null));
    return () => {
      active = false;
    };
  }, [path]);
  return [email, setEmail];
}

/**
 * @param {{ healthState: string, health: object | null, path: string, bare?: boolean,
 *   children: import('react').ReactNode }} props
 */
export function Shell({ healthState, health, path, bare = false, children }) {
  const [email, setEmail] = useAccount(path);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const skip = (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
    >
      Skip to main content
    </a>
  );

  if (bare) {
    return (
      <>
        {skip}
        <main id="main">{children}</main>
      </>
    );
  }

  const signOut = () =>
    logout()
      .catch(() => {})
      .then(() => {
        setEmail(null);
        navigate('/');
      });

  return (
    <>
      {skip}
      <header className="sticky top-0 z-40 border-b bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-foreground no-underline">
            <Mark />
            <span className="text-base font-semibold tracking-tight">AccessFix</span>
          </Link>
          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} path={path} />
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {health?.limits.privateUrlsAllowed && (
              <span className="hidden items-center gap-1 rounded-md border border-moderate px-2 py-1 text-xs text-moderate lg:inline-flex">
                <ShieldAlert aria-hidden="true" className="size-3.5" />
                Private network scanning enabled (dev only)
              </span>
            )}
            <div className="hidden rounded-md border bg-background px-2.5 py-1.5 sm:block">
              <ApiStatus state={healthState} />
            </div>
            <ThemeControl />
            <div className="hidden md:block">
              <Account email={email} onSignOut={signOut} />
            </div>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-md border md:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
              <span className="sr-only">Menu</span>
            </button>
          </div>
        </div>
        {open && (
          <div id="mobile-nav" className="border-t bg-surface px-4 pb-4 md:hidden">
            <nav aria-label="Primary mobile">
              <ul className="grid gap-1 py-3">
                {NAV.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} path={path} block />
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <ApiStatus state={healthState} />
              <Account email={email} onSignOut={signOut} />
            </div>
          </div>
        )}
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        {children}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>AccessFix · WCAG 2.2 A and AA, automated checks only. A high score is not a compliance claim.</p>
          <p>
            <Link href="/business" className="text-link underline">
              Plans and limits
            </Link>
          </p>
        </div>
      </footer>
    </>
  );
}

function NavLink({ item, path, block = false }) {
  const current = item.href === '/' ? path === '/' : path.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className={`${block ? 'flex' : 'inline-flex'} min-h-10 items-center rounded-md px-3 text-sm no-underline transition-colors ${
        current ? 'bg-raised font-semibold text-foreground' : 'text-muted-foreground hover:bg-raised hover:text-foreground'
      }`}
      aria-current={current ? 'page' : undefined}
    >
      {item.label}
    </Link>
  );
}

function Account({ email, onSignOut }) {
  if (!email) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground no-underline hover:brightness-110"
      >
        Sign in
      </Link>
    );
  }
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-flex size-8 items-center justify-center rounded-full bg-raised text-xs font-semibold text-foreground"
      >
        {initials}
      </span>
      <span className="hidden max-w-[12rem] truncate text-sm lg:inline">{email}</span>
      <button
        type="button"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:bg-raised hover:text-foreground"
        onClick={onSignOut}
      >
        <LogOut aria-hidden="true" className="size-4" />
        Sign out<span className="sr-only"> {email}</span>
      </button>
    </div>
  );
}

const THEMES = [
  { id: 'system', label: 'System', Icon: Monitor },
  { id: 'light', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
];

export function ThemeControl() {
  const [mode, setMode] = useState(() => document.documentElement.dataset.theme || 'system');
  return (
    <div role="group" aria-label="Color theme" className="flex rounded-md border bg-background p-0.5">
      {THEMES.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={mode === id}
          title={label}
          className={`inline-flex size-9 items-center justify-center rounded-[5px] ${
            mode === id ? 'bg-raised text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setMode(saveTheme(id))}
        >
          <Icon aria-hidden="true" className="size-4" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
