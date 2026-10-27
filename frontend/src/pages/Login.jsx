import { useId, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Mark, ThemeControl } from '@/components/layout/Shell.jsx';
import { WebThreads } from '@/components/WebThreads.jsx';
import { Button } from '@/components/ui/button.jsx';
import { SampleFinding } from '@/pages/LandingIntro.jsx';
import { login, signup } from '@/lib/api.js';
import { Link } from '@/lib/Link.jsx';
import { navigate } from '@/lib/path.js';

const MIN_PASSWORD = 10;

/**
 * @param {{ mode?: 'login' | 'signup' }} props
 */
export function Login({ mode = 'login' }) {
  const uid = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const signupMode = mode === 'signup';

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter an email address like name@example.com.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Passwords are at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    try {
      await (signupMode ? signup : login)({ email: email.trim(), password });
      navigate('/projects');
    } catch (err) {
      setError(
        err.retryAfterSec ? `${err.message} Try again in ${err.retryAfterSec} s.` : err.message,
      );
    } finally {
      setBusy(false);
    }
  };

  const errorId = `${uid}-error`;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 text-foreground no-underline">
            <Mark />
            <span className="text-base font-semibold tracking-tight">AccessFix</span>
          </Link>
          <ThemeControl />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-3xl font-semibold tracking-tight">
            {signupMode ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {signupMode
              ? 'An account keeps your scans in Projects, unlocks crawls and login-state scans, and lets you share reports.'
              : 'Sign in to see your projects, crawl a site and share reports.'}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-5" noValidate aria-describedby={error ? errorId : undefined}>
            <div>
              <label htmlFor="account-email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="account-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(error) || undefined}
                className="mt-2 min-h-11 w-full rounded-md border border-input bg-surface px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="account-password" className="block text-sm font-medium">
                Password
              </label>
              <div className="relative mt-2">
                <input
                  id="account-password"
                  type={show ? 'text' : 'password'}
                  autoComplete={signupMode ? 'new-password' : 'current-password'}
                  required
                  minLength={MIN_PASSWORD}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={`${uid}-hint`}
                  className="min-h-11 w-full rounded-md border border-input bg-surface pl-3 pr-20 text-sm"
                />
                <button
                  type="button"
                  className="absolute inset-y-1 right-1 inline-flex items-center gap-1.5 rounded px-2.5 text-sm text-link hover:bg-raised"
                  aria-pressed={show}
                  onClick={() => setShow((v) => !v)}
                >
                  {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                  {show ? 'Hide' : 'Show'}
                  <span className="sr-only"> password</span>
                </button>
              </div>
              <p id={`${uid}-hint`} className="mt-2 text-sm text-muted-foreground">
                At least {MIN_PASSWORD} characters. There is no password reset yet, so keep it somewhere safe.
              </p>
            </div>
            {error && (
              <p id={errorId} role="alert" className="text-sm font-medium text-critical">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full min-h-11">
              {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
              {busy ? 'Working…' : signupMode ? 'Create account' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-6 text-sm">
            {signupMode ? (
              <>
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-link underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{' '}
                <Link href="/signup" className="font-medium text-link underline">
                  Create an account
                </Link>
              </>
            )}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border bg-surface px-4 text-sm font-medium no-underline hover:bg-raised"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Scan a page without an account
          </Link>
        </div>
      </div>
      <aside
        aria-label="What AccessFix does"
        className="dark relative hidden overflow-hidden bg-background text-foreground lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <WebThreads cx={560} cy={40} rings={9} />
        <div className="relative">
          <p className="max-w-[16ch] text-4xl font-semibold leading-tight tracking-tight">
            Find it. Understand it. Fix it.
          </p>
          <p className="mt-4 max-w-[44ch] text-base leading-7 text-muted-foreground">
            Plain-language WCAG findings, reviewable code changes, and a sandboxed re-scan that proves every fix.
          </p>
        </div>
        <div className="relative max-w-md">
          <SampleFinding />
        </div>
      </aside>
    </div>
  );
}
