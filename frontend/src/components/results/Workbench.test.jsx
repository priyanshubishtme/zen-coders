import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Marks } from './Marks.jsx';
import { CodeDisclosure, Workbench } from './Workbench.jsx';

describe('marks', () => {
  it('names each mark with its number, severity, and what is broken', () => {
    const onSelect = vi.fn();
    render(
      <div className="relative h-40">
        <Marks
          items={[
            {
              n: 1,
              manual: false,
              violation: {
                id: 'v1',
                impact: 'serious',
                title: 'Text is too light to read',
                explanation: 'The grey text fails contrast.',
              },
              mark: { x: 0.2, y: 0.3, w: 0.1, h: 0.08 },
            },
          ]}
          onSelect={onSelect}
        />
      </div>,
    );
    const mark = screen.getByRole('button', { name: 'Issue 1, serious: Text is too light to read' });
    fireEvent.click(mark);
    expect(onSelect).toHaveBeenCalledWith('v1');
  });
});

describe('workbench', () => {
  it('keeps the code editor unloaded until it is opened', () => {
    render(<CodeDisclosure scanId="s_test" patchedHtml={null} />);
    expect(screen.getByRole('button', { name: 'Show original and patched code' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Loading the editor…')).not.toBeInTheDocument();
  });

  it('says when the screenshot is missing', () => {
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
        highlightIds={[]}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText('No screenshot for this scan. The issue list below still works.')).toBeInTheDocument();
  });
});
