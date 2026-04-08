import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'giti Observatory',
  description: 'Watch a living codebase evolve',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;700&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-terrarium-surface text-terrarium-text min-h-screen font-body">
        {children}
      </body>
    </html>
  );
}
