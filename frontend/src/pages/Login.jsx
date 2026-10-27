import { useState } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { login, signup } from '@/lib/api.js';
import { Link } from '@/lib/Link.jsx';
import { navigate } from '@/lib/path.js';

/**
 * @param {{ mode?: 'login' | 'signup' }} props
 */
export function Login({ mode = 'login' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const signupMode = mode === 'signup';

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await (signupMode ? signup : login)({ email, password });
      navigate('/projects');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold">{signupMode ? 'Create an account' : 'Sign in'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A crawl, a saved login, and projects need an account. Pasting one page still works without one. There is no
        password reset and no email verification.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
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
            className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label htmlFor="account-password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="account-password"
            type="password"
            autoComplete={signupMode ? 'new-password' : 'current-password'}
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <p className="mt-1 text-sm text-muted-foreground">At least 10 characters.</p>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-critical">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? 'Working…' : signupMode ? 'Create account' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-4 text-sm">
        {signupMode ? (
          <Link href="/login" className="text-primary underline">
            Already have an account? Sign in
          </Link>
        ) : (
          <Link href="/signup" className="text-primary underline">
            Create an account
          </Link>
        )}
      </p>
    </article>
  );
}
