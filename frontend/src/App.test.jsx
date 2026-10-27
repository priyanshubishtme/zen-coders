import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

afterEach(() => vi.unstubAllGlobals());

describe('App shell', () => {
  it('has one h1, a main landmark and a skip link to it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<App />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
  });

  it('shows API status as text, not color alone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'degraded' }) }),
    );
    render(<App />);
    expect(await screen.findByText('API online, scanner offline')).toBeInTheDocument();
  });
});
