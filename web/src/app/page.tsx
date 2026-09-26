import { HeroArt } from '@/components/art/HeroArt';
import { FareStory } from '@/components/FareStory';
import { TinPlate } from '@/components/ui/TinPlate';
import { bnNumber } from '@/lib/format';
import styles from './page.module.css';

const steps = [
  {
    title: 'Book your seat',
    bn: 'আসন বুক করুন',
    text: 'Pick where you start and where you’re going. You see the price before you book.',
  },
  {
    title: 'Share the Tesla',
    bn: 'একসাথে চলুন',
    text: 'If someone nearby is heading your way, you ride together. Only your driver knows who’s on board.',
  },
  {
    title: 'Pay your part',
    bn: 'আপনার ভাড়া',
    text: 'Your own fare, 25% off when you actually shared. Cash or TeslaPay.',
  },
];

export default function Home() {
  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={`flower-frame ${styles.panel}`}>
            <HeroArt className={styles.art} />
            <h1 className={`painted ${styles.title}`}>Dhaka Tesla Pool</h1>
            <p className={styles.bnTitle} lang="bn">
              ঢাকা টেসলা পুল
            </p>
            <p className={styles.tagline}>Share a seat. Split the fare. Survive Dhaka traffic.</p>
          </div>
          <FareStory />
        </div>
      </section>

      <section className="container" aria-labelledby="how">
        <h2 id="how" className={`painted ${styles.sectionTitle}`}>
          How pooling works
        </h2>
        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li key={s.title}>
              <TinPlate frame={(['rani', 'cobalt', 'vermilion'] as const)[i]} as="article">
                <span className={styles.number} lang="bn" aria-hidden="true">
                  {bnNumber(i + 1)}
                </span>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className="bn" lang="bn">
                  {s.bn}
                </p>
                <p>{s.text}</p>
              </TinPlate>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
