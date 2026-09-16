import type { Metadata } from 'next';
import './globals.scss';

export const metadata: Metadata = {
  title: 'MILNI | People. Traditions. Together.',
  description: 'A private social space for your wedding weekend.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
