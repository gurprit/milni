import type { Metadata, Viewport } from 'next';
import './globals.scss';

export const metadata: Metadata = {
  title: 'MILNI | People. Traditions. Together.',
  description: 'A private social space for your wedding weekend.',
  applicationName: 'MILNI',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'MILNI',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/milni-icon.svg',
    apple: '/milni-icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#00483e',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
