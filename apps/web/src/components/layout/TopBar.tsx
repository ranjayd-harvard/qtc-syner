'use client';

import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [{ label: 'Home', href: '/' }];

  const labelMap: Record<string, string> = {
    admin: 'Admin',
    connections: 'Connections',
    new: 'New Connection',
    explorer: 'Explorer',
    schema: 'Schema',
    query: 'Query',
    history: 'History',
  };

  let path = '';
  segments.forEach((seg, i) => {
    path += `/${seg}`;
    const label = labelMap[seg] || (seg.length > 20 ? seg.slice(0, 8) + '…' : seg);
    if (i < segments.length - 1) {
      crumbs.push({ label, href: path });
    } else {
      crumbs.push({ label });
    }
  });
  return crumbs;
}

export function TopBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b bg-white">
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-400">/</span>}
            <span className={i === breadcrumbs.length - 1 ? 'text-slate-900 font-medium' : 'text-slate-500'}>
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-indigo-700" />
            </div>
            <span className="text-sm font-medium hidden sm:block">
              {session?.user?.name || session?.user?.email || 'Admin'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-slate-500">
            {session?.user?.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-red-600 gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
