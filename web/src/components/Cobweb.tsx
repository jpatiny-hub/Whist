/** Purely decorative corner cobweb — no interaction, hidden from assistive tech. */
export default function Cobweb({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <svg
      className={`cobweb cobweb-${corner}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeWidth="0.6">
        <line x1="0" y1="0" x2="40" y2="0" />
        <line x1="0" y1="0" x2="34.6" y2="20" />
        <line x1="0" y1="0" x2="20" y2="34.6" />
        <line x1="0" y1="0" x2="0" y2="40" />
        <polyline points="14,0 12.1,7 7,12.1 0,14" />
        <polyline points="24,0 20.8,12 12,20.8 0,24" />
        <polyline points="34,0 29.4,17 17,29.4 0,34" />
      </g>
    </svg>
  );
}
