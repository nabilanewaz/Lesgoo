import { FanFlowerShape, FrondShape, PALETTES, PeacockShape } from './motifs';

// A mirrored rickshaw-panel scene: two peacocks facing each other beneath a crowning
// fan-lotus, flanked by flowers and fern fronds. Symmetry is a hallmark of the style.
export function HeroArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 330" role="img" aria-label="Two painted peacocks among lotus flowers">
      {/* fronds */}
      <g transform="translate(40 300) rotate(-35)">
        <FrondShape length={110} />
      </g>
      <g transform="translate(360 300) rotate(35)">
        <FrondShape length={110} />
      </g>
      <g transform="translate(70 120) rotate(-70)">
        <FrondShape length={70} color="#2c8a48" />
      </g>
      <g transform="translate(330 120) rotate(70)">
        <FrondShape length={70} color="#2c8a48" />
      </g>

      {/* central stem with white fronds */}
      <path d="M200 285 L200 105" stroke="#e9fff2" strokeWidth="4" strokeLinecap="round" />
      <g transform="translate(200 230)">
        <FrondShape length={110} color="#e9fff2" />
      </g>

      {/* crowning flower and side flowers */}
      <g transform="translate(200 98) scale(1.35)">
        <FanFlowerShape palette={PALETTES.gold} />
      </g>
      <g transform="translate(78 92) rotate(-24) scale(0.95)">
        <FanFlowerShape palette={PALETTES.pink} />
      </g>
      <g transform="translate(322 92) rotate(24) scale(0.95)">
        <FanFlowerShape palette={PALETTES.pink} />
      </g>

      {/* peacocks facing each other */}
      <g transform="translate(128 250) scale(1.35)">
        <PeacockShape />
      </g>
      <g transform="translate(272 250) scale(-1.35 1.35)">
        <PeacockShape />
      </g>

      {/* flower at the foot */}
      <g transform="translate(200 312) scale(1.05)">
        <FanFlowerShape palette={PALETTES.blue} />
      </g>
    </svg>
  );
}
