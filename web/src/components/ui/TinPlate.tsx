import type { ReactNode } from 'react';
import { FanFlower, PALETTES } from '../art/motifs';
import styles from './TinPlate.module.css';

// A content card painted like a cream tin plate on a rickshaw: thick enamel frame, a thin
// inner line, and a fan-lotus crest on top. Cream keeps forms and fares easy to read on
// the dark painted ground.

type Frame = 'rani' | 'emerald' | 'cobalt' | 'vermilion';

// Crest colour per frame, chosen to contrast with the frame and to vary across neighbouring cards.
const crestPalette = { rani: PALETTES.gold, emerald: PALETTES.pink, cobalt: PALETTES.pink, vermilion: PALETTES.blue };

type Props = {
  title?: string;
  bnTitle?: string; // small Bangla subtitle
  frame?: Frame;
  crest?: boolean;
  as?: 'section' | 'article' | 'div';
  className?: string;
  children: ReactNode;
};

export function TinPlate({ title, bnTitle, frame = 'rani', crest = true, as: Tag = 'section', className, children }: Props) {
  return (
    <Tag className={[styles.plate, styles[frame], crest ? styles.withCrest : '', className].filter(Boolean).join(' ')}>
      {crest && <FanFlower size={78} palette={crestPalette[frame]} className={styles.crest} />}
      {title && (
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          {bnTitle && (
            <span className="bn" lang="bn">
              {bnTitle}
            </span>
          )}
        </header>
      )}
      {children}
    </Tag>
  );
}
