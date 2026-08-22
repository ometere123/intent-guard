/**
 * The obelus beside a marked passage.
 *
 * The obelus is the sign an editor puts in the margin against a passage judged
 * not to belong, which is the entire output of this contract: a mandate, marked
 * where its calldata diverges from it. Decorative, and named by the wordmark it
 * sits beside, so it is hidden from assistive technology rather than described
 * twice.
 *
 * Colours are CSS variables here and literal hex in `src/app/icon.svg`; the
 * favicon is served as a static file and cannot read the stylesheet. Keep the two
 * geometries in step, and keep every coordinate even: the figure has to halve onto
 * whole pixels at 16px.
 */
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className="inline-block shrink-0 align-[-0.15em]"
    >
      <rect width="32" height="32" fill="var(--verso)" />
      <path d="M4 8h12M4 16h12M4 24h8" stroke="var(--ink)" strokeWidth="4" />
      <path d="M24 4v24M18 12h12" stroke="var(--rubric)" strokeWidth="4" />
    </svg>
  );
}
