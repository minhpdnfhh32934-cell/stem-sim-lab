/**
 * App mark: a tilted orbit, a trajectory arc and a point mass —
 * physics, chemistry and motion in one simple outline glyph.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="logo"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="30" height="30" rx="8" className="logo__bg" />
      <ellipse
        cx="16"
        cy="16"
        rx="10.5"
        ry="4.6"
        transform="rotate(-28 16 16)"
        className="logo__stroke"
      />
      <path d="M6.5 23.5 Q 14 5.5 25.5 20" className="logo__stroke logo__stroke--thin" />
      <circle cx="16" cy="16" r="2.6" className="logo__dot" />
    </svg>
  );
}
