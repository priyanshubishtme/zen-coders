import { useEffect, useState } from 'react';
import { Clock, OctagonAlert, ShieldOff } from 'lucide-react';
import { Alert } from '@/components/ui/alert.jsx';
import { Button } from '@/components/ui/button.jsx';

const TITLES = {
  RATE_LIMITED: 'Too many scans',
  URL_BLOCKED: 'That URL cannot be scanned',
  FETCH_FAILED: 'The page could not be loaded',
  UNSUPPORTED_INPUT: 'That input cannot be scanned',
  PAYLOAD_TOO_LARGE: 'That HTML is too large',
  SCAN_TIMEOUT: 'The scan took too long',
  SCANNER_BUSY: 'The scanner is busy',
  BROWSER_UNAVAILABLE: 'The scanner is offline',
  VALIDATION_ERROR: 'Please check your input',
  NETWORK: 'Cannot reach the AccessFix API',
};

const HINTS = {
  SCAN_TIMEOUT: 'Try a smaller page, or paste just the part you want to check.',
  NETWORK: 'Check that the API is running on port 4000.',
  FETCH_FAILED: 'Check the address, or paste the page HTML instead.',
};

/**
 * @param {{ error: { code: string, message: string, requestId?: string | null, retryAfterSec?: number | null },
 *   onRetry: () => void }} props
 */
export function ErrorPanel({ error, onRetry }) {
  const [until] = useState(() => Date.now() + (error.retryAfterSec ?? 0) * 1000);
  const [remaining, setRemaining] = useState(error.retryAfterSec ?? 0);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const t = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(t);
  }, [remaining, until]);

  const rateLimited = error.code === 'RATE_LIMITED';
  const Icon = rateLimited ? Clock : error.code === 'URL_BLOCKED' ? ShieldOff : OctagonAlert;

  return (
    <Alert
      tone={rateLimited ? 'warning' : 'error'}
      icon={Icon}
      title={TITLES[error.code] ?? 'Something went wrong'}
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={rateLimited && remaining > 0}
        >
          Try again
        </Button>
      }
    >
      <p>{error.message}</p>
      {rateLimited && remaining > 0 && (
        <p className="mt-1" aria-live="off">
          You can scan again in {remaining} s.
        </p>
      )}
      {HINTS[error.code] && <p className="mt-1">{HINTS[error.code]}</p>}
      {error.requestId && <p className="mt-1 font-mono text-xs">Request ID: {error.requestId}</p>}
    </Alert>
  );
}
