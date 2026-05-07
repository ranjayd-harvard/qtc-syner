import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from '@/components/ui/toaster';
import { SessionWrapper } from '@/providers/SessionWrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'QTC Syncer',
  description: 'Multi-source data connector platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionWrapper>
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
