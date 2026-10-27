import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';
import { completedScan, health, mockApi, reply } from './test/fixtures.js';

const renderApp = () => render(<App pollMs={5} />);

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => vi.unstubAllGlobals());

async function pasteAndScan(html = '<p>hi</p>') {
  await screen.findByText('API online');
  fireEvent.change(screen.getByLabelText('HTML to scan'), { target: { value: html } });
  fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
}

describe('App shell', () => {
  it('has one h1, a main landmark and a skip link to it', async () => {
    vi.stubGlobal('fetch', mockApi({ healthBody: new Error('offline') }));
    renderApp();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
  });
});

describe('input', () => {
  it('validates empty HTML inline without calling the API', async () => {
    const fetch = mockApi();
    vi.stubGlobal('fetch', fetch);
    renderApp();
    await pasteAndScan('   ');
    expect(screen.getByText('Paste some HTML first.')).toBeInTheDocument();
    expect(screen.getByLabelText('HTML to scan')).toHaveAttribute('aria-invalid', 'true');
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('validates URLs and switches tabs with the arrow keys', async () => {
    vi.stubGlobal('fetch', mockApi());
    renderApp();
    await screen.findByText('API online');
    const htmlTab = screen.getByRole('tab', { name: 'Paste HTML' });
    fireEvent.keyDown(htmlTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Scan a URL' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.change(screen.getByLabelText('Page URL'), { target: { value: 'ftp://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
    expect(screen.getByText('Only http and https URLs can be scanned.')).toBeInTheDocument();
  });

  it('"Try the broken sample" scans the bundled sample page', async () => {
    const fetch = mockApi();
    vi.stubGlobal('fetch', fetch);
    renderApp();
    await screen.findByText('API online');
    fireEvent.click(screen.getByRole('button', { name: /try the broken sample/i }));
    await screen.findByText('Bakery · Pasted HTML (2.0 KB)');
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post[1].body).input.html).toContain('Weekly specials');
  });
});

describe('scan flow', () => {
  it('shows the real server stage while scanning', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({ scans: [{ ...completedScan(), status: 'scanning', stage: 'checking' }] }),
    );
    renderApp();
    await pasteAndScan();
    expect(await screen.findByRole('heading', { name: 'Scanning' })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText('Running accessibility checks', { selector: 'li > span' }).closest('li'),
      ).toHaveAttribute('aria-current', 'step'),
    );
    expect(screen.getAllByText('(done)')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Scanning…' })).toBeDisabled();
  });

  it('shows grouped results when the scan completes', async () => {
    vi.stubGlobal('fetch', mockApi());
    renderApp();
    await pasteAndScan();

    await screen.findByText('2 WCAG issues');
    const issues = screen.getByRole('region', { name: 'Issues' });
    const groups = within(issues).getAllByRole('article');
    expect(groups.map((g) => within(g).getByRole('heading').textContent)).toEqual([
      'image-alt title',
      'color-contrast title',
    ]);
    expect(within(groups[0]).getByText('2 elements')).toBeInTheDocument();
    expect(within(groups[0]).getByText('Critical')).toBeInTheDocument();
    expect(within(groups[0]).getByText(/Who it affects:/)).toBeInTheDocument();
    expect(
      within(groups[0]).getByRole('link', { name: /1\.1\.1 Non-text Content · A/ }),
    ).toHaveAttribute('href', 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html');
    expect(within(groups[0]).getAllByText('<img id="v1">')[0]).toBeInTheDocument();
  });

  it('keeps manual review and advisory in their own sections, with the heading outline', async () => {
    vi.stubGlobal('fetch', mockApi());
    renderApp();
    await pasteAndScan();
    const manual = await screen.findByRole('region', { name: 'Needs manual review (1)' });
    expect(within(manual).getByText('Contrast unclear')).toBeInTheDocument();
    expect(within(manual).getByText('Needs manual review')).toBeInTheDocument();
    const advisory = screen.getByRole('region', { name: 'Advisory (1)' });
    expect(within(advisory).getByRole('list', { name: 'Heading outline' })).toBeInTheDocument();
    expect(within(advisory).getByText('skips from H1')).toBeInTheDocument();
    expect(screen.getByText(/1 resource on the page could not be loaded/)).toBeInTheDocument();
  });

  it('filters by severity and keeps the filter in the URL', async () => {
    vi.stubGlobal('fetch', mockApi());
    renderApp();
    await pasteAndScan();
    const serious = await screen.findByRole('button', { name: /Serious \(1\)/ });
    fireEvent.click(serious);
    expect(serious).toHaveAttribute('aria-pressed', 'true');
    expect(window.location.search).toBe('?severity=serious');
    const issues = screen.getByRole('region', { name: 'Issues' });
    expect(within(issues).getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Showing 1 issue of 2.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(window.location.search).toBe('');
  });

  it('shows a clean state that still points to manual checks', async () => {
    vi.stubGlobal('fetch', mockApi({ scans: [completedScan({ violations: [] })] }));
    renderApp();
    await pasteAndScan();
    expect(await screen.findByText('No automated WCAG issues found')).toBeInTheDocument();
  });

  it('can be cancelled while scanning', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({ scans: [{ ...completedScan(), status: 'scanning', stage: 'loading' }] }),
    );
    renderApp();
    await pasteAndScan();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Scanning' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan' })).toBeEnabled();
  });
});

describe('error states', () => {
  it('shows a failed scan with its typed error and keeps the input', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        scans: [
          completedScan({
            status: 'failed',
            stage: 'failed',
            error: { code: 'SCAN_TIMEOUT', message: 'Scan exceeded 30000 ms.' },
          }),
        ],
      }),
    );
    renderApp();
    await pasteAndScan('<p>keep me</p>');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('The scan took too long')).toBeInTheDocument();
    expect(screen.getByLabelText('HTML to scan')).toHaveValue('<p>keep me</p>');
  });

  it('counts down when rate-limited and only then allows a retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.stubGlobal(
        'fetch',
        mockApi({
          create: reply(
            429,
            { error: { code: 'RATE_LIMITED', message: 'Too many requests.', requestId: 'r1' } },
            { ratelimit: '"scans";r=0;t=2' },
          ),
        }),
      );
      renderApp();
      await pasteAndScan();
      expect(await screen.findByText('You can scan again in 2 s.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
      expect(screen.getByText('Request ID: r1')).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(2_500));
      expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows URL_BLOCKED from the API in plain language', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        create: reply(422, {
          error: {
            code: 'URL_BLOCKED',
            message: 'localhost points to a private or reserved network address.',
          },
        }),
      }),
    );
    renderApp();
    await pasteAndScan();
    expect(await screen.findByText('That URL cannot be scanned')).toBeInTheDocument();
  });

  it('disables scanning with a reason when the scanner is offline', async () => {
    vi.stubGlobal('fetch', mockApi({ healthBody: health({ status: 'degraded' }) }));
    renderApp();
    expect(await screen.findByText('Scanning is unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan' })).toBeDisabled();
  });

  it('flags private-network scanning when the API allows it', async () => {
    vi.stubGlobal(
      'fetch',
      mockApi({
        healthBody: health({ limits: { maxHtmlBytes: 512_000, privateUrlsAllowed: true } }),
      }),
    );
    renderApp();
    expect(
      await screen.findByText('Private network scanning enabled (dev only)'),
    ).toBeInTheDocument();
  });
});
