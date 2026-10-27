import { TriangleAlert } from 'lucide-react';

/** The page's heading outline, indented by level, with skipped levels called out in text. */
export function HeadingOutline({ outline }) {
  if (!outline.length) {
    return <p className="text-sm text-muted-foreground">This page has no headings.</p>;
  }
  return (
    <ol aria-label="Heading outline" className="space-y-1 text-sm">
      {outline.map((h, i) => {
        const prev = outline[i - 1];
        const skipped = prev && h.level > prev.level + 1;
        return (
          <li key={`${i}-${h.text}`} style={{ paddingLeft: `${(h.level - 1) * 1.25}rem` }}>
            <span className="mr-2 inline-block min-w-8 rounded border px-1 text-center font-mono text-xs">
              H{h.level}
            </span>
            {h.text || <em className="text-muted-foreground">(empty heading)</em>}
            {skipped && (
              <span className="ml-2 inline-flex items-center gap-1 text-moderate">
                <TriangleAlert aria-hidden="true" className="size-3.5" />
                skips from H{prev.level}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
