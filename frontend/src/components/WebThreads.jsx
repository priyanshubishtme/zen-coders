/**
 * Radial web threads drawn in code. Purely decorative, so hidden from assistive tech.
 * @param {{ className?: string, cx?: number, cy?: number, rings?: number }} props
 */
export function WebThreads({ className = '', cx = 520, cy = 80, rings = 7 }) {
  const spokes = 14;
  const lines = Array.from({ length: spokes }, (_, i) => {
    const a = (i / spokes) * Math.PI * 2;
    return { x: cx + Math.cos(a) * 900, y: cy + Math.sin(a) * 900 };
  });
  const ringPaths = Array.from({ length: rings }, (_, r) => {
    const radius = 70 + r * 70;
    const points = Array.from({ length: spokes }, (_, i) => {
      const a = (i / spokes) * Math.PI * 2;
      const sag = i % 2 ? 0.94 : 1;
      return `${(cx + Math.cos(a) * radius * sag).toFixed(1)},${(cy + Math.sin(a) * radius * sag).toFixed(1)}`;
    });
    return `M${points.join('L')}Z`;
  });
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 640 360"
      preserveAspectRatio="xMaxYMin slice"
    >
      <g fill="none" stroke="var(--thread)" strokeWidth="1.2">
        {lines.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} />
        ))}
        {ringPaths.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
