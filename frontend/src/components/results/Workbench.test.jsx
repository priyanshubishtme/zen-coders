import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pins } from './Pins.jsx';
import { Workbench } from './Workbench.jsx';

describe('pins', () => {
  it('exposes each pin as a button named like its issue', () => {
    render(
      <div className="relative">
        <Pins
          marks={[{ violationId: 'v1', n: 1, x: 0.2, y: 0.3 }]}
          titles={{ v1: 'Images must have alternative text' }}
          activeId={null}
          onSelect={() => {}}
        />
      </div>,
    );
    expect(
      screen.getByRole('button', { name: 'Issue 1: Images must have alternative text' }),
    ).toBeInTheDocument();
  });
});

describe('workbench', () => {
  it('keeps the code editor unloaded until it is opened', () => {
    render(
      <Workbench
        scan={{
          id: 's_test',
          shots: { before: false, after: false },
          marks: [],
          events: [],
          violations: [],
          advisory: [],
          manualReview: [],
        }}
        verification={null}
        activeId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Show original and patched code' })).toBeInTheDocument();
    expect(screen.getByText('No screenshot for this scan. The issue list below still works.')).toBeInTheDocument();
    expect(screen.queryByText('Loading the editor…')).not.toBeInTheDocument();
  });
});
