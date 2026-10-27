/**
 * Unified diff. +/- prefixes stay so colour is never the only signal.
 * @param {{ diff: string, summary: string }} props
 */
export function DiffViewer({ diff, summary }) {
  const lines = diff.replace(/\n$/, '').split('\n');
  return (
    <div>
      <p className="text-sm">{summary}</p>
      <pre className="mt-2 overflow-x-auto rounded border bg-background p-2 font-mono text-xs leading-5">
        <code>
          {lines.map((line, i) => {
            const kind = line.startsWith('+')
              ? 'add'
              : line.startsWith('-')
                ? 'del'
                : line.startsWith('@')
                  ? 'hunk'
                  : 'ctx';
            const className =
              kind === 'add'
                ? 'text-verified'
                : kind === 'del'
                  ? 'text-critical'
                  : kind === 'hunk'
                    ? 'text-muted-foreground'
                    : '';
            return (
              <span key={i} className={`block ${className}`}>
                {line || ' '}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
