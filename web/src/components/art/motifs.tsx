// Original SVG motifs in the vocabulary of Dhaka rickshaw painting: the fringed fan-lotus,
// the peacock, fern fronds. Each *Shape returns an SVG <g> so motifs can be composed into
// larger scenes (see HeroArt). Colours are enamel-bright with white "gloss" strokes.

const OUTLINE = '#0a1f1c';

export type Palette = { dome: string; light: string; base: string };

export const PALETTES = {
  pink: { dome: '#ff4f9a', light: '#ffd0e4', base: '#d90f5c' },
  blue: { dome: '#4fb3ff', light: '#d8f0ff', base: '#1c56d6' },
  gold: { dome: '#ffc21a', light: '#fff2b3', base: '#ff7a00' },
  red: { dome: '#ff5a4a', light: '#ffe0cf', base: '#d4141c' },
} satisfies Record<string, Palette>;

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: +(r * Math.cos(a)).toFixed(2), y: +(r * Math.sin(a)).toFixed(2) };
};

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

// The fan-lotus: fringed dome, white hatching, teardrop heart, glossy lobed base petals.
// Origin = base centre; it grows upward to about y = -48.
export function FanFlowerShape({ palette }: { palette: Palette }) {
  const { dome, light, base } = palette;
  return (
    <g strokeLinecap="round">
      {range(184, 356, 6).map((a) => {
        const p1 = polar(18, a);
        const p2 = polar(47, a);
        return <line key={`s${a}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={dome} strokeWidth="2.4" />;
      })}
      <path d="M-36 0 A36 36 0 0 1 36 0 Z" fill={dome} stroke={OUTLINE} strokeWidth="1.5" />
      {range(192, 348, 8).map((a) => {
        const p1 = polar(23, a);
        const p2 = polar(33, a);
        return <line key={`h${a}`} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#fff" strokeWidth="1.4" opacity="0.9" />;
      })}
      <path d="M-20 0 A20 20 0 0 1 20 0 Z" fill={light} stroke={OUTLINE} strokeWidth="1.2" />
      <path d="M0 -17 C 6 -10, 6 -3, 0 0 C -6 -3, -6 -10, 0 -17 Z" fill={base} />
      <path d="M-1.5 -12 C 0 -9, 0 -6, -1 -3" stroke="#fff" strokeWidth="1.2" fill="none" />
      {[1, -1].map((side) => (
        <g key={side} transform={`scale(${side} 1)`}>
          <path d="M0 -1 C -10 -10, -34 -11, -46 2 C -34 13, -12 13, 0 5 Z" fill={base} stroke={OUTLINE} strokeWidth="1.5" />
          <path d="M-9 3 C -19 -2, -31 -2, -39 3" stroke="#fff" strokeWidth="1.8" fill="none" />
          <path d="M-14 7 C -20 5, -27 5, -32 7" stroke="#fff" strokeWidth="1" fill="none" opacity="0.8" />
        </g>
      ))}
      <path d="M0 -5 C 11 -1, 12 10, 0 15 C -12 10, -11 -1, 0 -5 Z" fill={dome} stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M-4 0 C 0 -2, 4 1, 4 7" stroke="#fff" strokeWidth="1.5" fill="none" />
    </g>
  );
}

// Peacock facing right, painted-style: orange-red tail, royal blue body, glossy wing.
// Origin roughly at its feet; about 110 wide and 90 tall.
export function PeacockShape() {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {/* tail: long swept fan behind the body */}
      <path d="M-4 -34 C -34 -58, -62 -44, -66 -18 C -48 -26, -30 -22, -12 -16 Z" fill="#ff8a00" stroke={OUTLINE} strokeWidth="1.5" />
      <path d="M-8 -30 C -30 -46, -50 -40, -56 -24 C -42 -28, -26 -24, -12 -20 Z" fill="#ff3b30" />
      {/* gloss stripes, kept inside the tail's outline */}
      <path d="M-20 -21 C -30 -27, -42 -29, -54 -25" stroke="#fff" strokeWidth="1.4" fill="none" />
      <path d="M-20 -27 C -31 -35, -44 -38, -56 -32" stroke="#fff" strokeWidth="1.4" fill="none" />
      <path d="M-18 -33 C -28 -42, -40 -46, -52 -42" stroke="#fff" strokeWidth="1.4" fill="none" />
      {/* body */}
      <path d="M-14 -20 C -18 -44, 4 -56, 18 -50 C 30 -44, 30 -20, 14 -10 C 2 -4, -10 -8, -14 -20 Z" fill="#1c56d6" stroke={OUTLINE} strokeWidth="1.6" />
      <path d="M-4 -14 C 6 -10, 16 -14, 20 -22" stroke="#7cc8ff" strokeWidth="5" fill="none" />
      {/* neck and head */}
      <path d="M14 -48 C 12 -62, 16 -74, 26 -77 C 34 -79, 39 -72, 35 -67 C 30 -64, 26 -58, 27 -46 Z" fill="#1c56d6" stroke={OUTLINE} strokeWidth="1.6" />
      <path d="M18 -52 C 17 -60, 19 -68, 25 -72" stroke="#7cc8ff" strokeWidth="2" fill="none" />
      <path d="M36 -72 L 46 -69 L 36 -66 Z" fill="#ff8a00" stroke={OUTLINE} strokeWidth="1.2" />
      <circle cx="30" cy="-71" r="3.2" fill="#fff" stroke={OUTLINE} strokeWidth="1" />
      <circle cx="31" cy="-71" r="1.4" fill={OUTLINE} />
      {/* crest */}
      {[-18, 0, 18].map((a) => (
        <g key={a} transform={`translate(26 -77) rotate(${a})`}>
          <line x1="0" y1="0" x2="0" y2="-10" stroke="#fff" strokeWidth="1.2" />
          <circle cy="-11" r="1.8" fill="#ffc21a" />
        </g>
      ))}
      {/* wing */}
      <path d="M-8 -30 C 0 -44, 22 -44, 26 -30 C 18 -22, 4 -20, -8 -30 Z" fill="#ff2e63" stroke={OUTLINE} strokeWidth="1.5" />
      {range(0, 3, 1).map((i) => (
        <path key={i} d={`M${-2 + i * 7} ${-30 + i} C ${2 + i * 7} ${-36}, ${8 + i * 7} ${-37}, ${12 + i * 7} ${-34 + i}`} stroke="#fff" strokeWidth="1.3" fill="none" />
      ))}
      {/* legs */}
      <path d="M2 -10 L 0 0 M 10 -11 L 12 0 M -3 0 L 4 0 M 9 0 L 16 0" stroke="#fff" strokeWidth="1.6" />
    </g>
  );
}

// A fern frond pointing up from its origin.
export function FrondShape({ color = '#3fae5a', length = 80 }: { color?: string; length?: number }) {
  const n = Math.floor(length / 8);
  return (
    <g stroke={color} strokeLinecap="round" fill="none">
      <path d={`M0 0 L0 ${-length}`} strokeWidth="2.5" />
      {range(1, n, 1).map((i) => {
        const y = -i * 8;
        const reach = Math.max(4, 20 - i * 1.4);
        return (
          <g key={i} strokeWidth="3">
            <path d={`M0 ${y} Q ${-reach * 0.5} ${y - 2}, ${-reach} ${y - 9}`} />
            <path d={`M0 ${y} Q ${reach * 0.5} ${y - 2}, ${reach} ${y - 9}`} />
          </g>
        );
      })}
    </g>
  );
}

type SvgProps = { size?: number; className?: string };

export function FanFlower({ size = 64, palette = PALETTES.pink, className }: SvgProps & { palette?: Palette }) {
  return (
    <svg className={className} width={size} height={size * 0.8} viewBox="-50 -50 100 80" aria-hidden="true">
      <FanFlowerShape palette={palette} />
    </svg>
  );
}
