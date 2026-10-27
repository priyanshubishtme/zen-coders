import { ShieldCheck } from 'lucide-react';
import { ApiStatus } from '@/components/ApiStatus.jsx';

export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
            AccessFix
          </p>
          <ApiStatus />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          Find accessibility issues. Ship verified fixes.
        </h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Paste HTML, get WCAG 2.2 AA issues in plain language, apply source fixes in an isolated
          preview, and see a verified before/after score. The scanner arrives in Phase 1.
        </p>
      </main>
    </>
  );
}
