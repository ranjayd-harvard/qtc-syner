import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-200">404</h1>
        <p className="text-slate-600 mt-2">Page not found</p>
        <Link href="/">
          <Button className="mt-4">Go home</Button>
        </Link>
      </div>
    </div>
  );
}
