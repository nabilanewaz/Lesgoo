import type { Metadata } from 'next';
import { Baloo_Da_2, Galada } from 'next/font/google';
import { Header } from '@/components/Header';
import { Providers } from './providers';
import './globals.css';

// Galada: hand-lettered Bangla/Latin display face, close to painted rickshaw signs.
// Baloo Da 2: friendly, very readable body face with full Bangla support.
const galada = Galada({ weight: '400', subsets: ['latin', 'bengali'], variable: '--font-galada' });
const baloo = Baloo_Da_2({ subsets: ['latin', 'bengali'], variable: '--font-baloo' });

export const metadata: Metadata = {
  title: 'Dhaka Tesla Pool',
  description: 'Share a seat. Split the fare. Survive Dhaka traffic.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${galada.variable} ${baloo.variable}`}>
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
          <footer className="site-footer">
            <div className="flower-strip" />
            <p className="container">
              Dhaka Tesla Pool · Patterns inspired by the rickshaw painters of Dhaka ·{' '}
              <span lang="bn">রিকশা চিত্র</span>
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
