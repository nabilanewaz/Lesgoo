import styles from './Wheel.module.css';

// A painted rickshaw wheel: black tyre, pink rim, sixteen spokes, flower hub.
// Spins while something is loading.

type Props = { size?: number; spinning?: boolean; tyre?: string; className?: string };

export function Wheel({ size = 48, spinning = false, tyre = 'var(--ink)', className }: Props) {
  const spokes = Array.from({ length: 16 }, (_, i) => i * 22.5);
  return (
    <svg
      className={[spinning ? styles.spin : '', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      aria-hidden="true"
    >
      <circle r="46" fill="none" stroke={tyre} strokeWidth="8" />
      <circle r="40" fill="none" stroke="var(--rani)" strokeWidth="4" />
      <circle r="40" fill="none" stroke="var(--turmeric)" strokeWidth="1.5" strokeDasharray="3 5" />
      <circle r="38" fill="rgba(255, 248, 234, 0.08)" />
      <g stroke={tyre === 'var(--ink)' ? 'var(--ink-soft)' : '#d9cdea'} strokeWidth="1.6">
        {spokes.map((a) => (
          <line key={a} x1="0" y1="0" x2="0" y2="-38" transform={`rotate(${a})`} />
        ))}
      </g>
      <g fill="var(--emerald)" stroke="var(--ink)" strokeWidth="1">
        {[0, 90, 180, 270].map((a) => (
          <ellipse key={a} cy="-8" rx="4" ry="7" transform={`rotate(${a})`} />
        ))}
      </g>
      <circle r="5" fill="var(--turmeric)" stroke="var(--ink)" strokeWidth="1.5" />
    </svg>
  );
}
