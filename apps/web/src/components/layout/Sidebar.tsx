'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Settings,
  Database,
  Plug2,
  ChevronLeft,
  ChevronRight,
  Zap,
  GitCompare,
  Workflow,
  GitMerge,
  PackagePlus,
  Users,
  BrainCircuit,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/explorer', label: 'Explorer', icon: Database },
  { href: '/compare', label: 'Schema Compare', icon: GitCompare },
  { href: '/mapper', label: 'Schema Mapper', icon: Workflow },
  { href: '/multi-mapper', label: 'Multi-level Mapping', icon: GitMerge },
  { href: '/entity-syncer', label: 'Entity Syncer', icon: PackagePlus },
  { href: '/admin/connections', label: 'Connections', icon: Plug2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/settings', label: 'AI Settings', icon: BrainCircuit },
  { href: '/admin/connections/new', label: 'New Connection', icon: Settings, hidden: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-slate-900 text-slate-100 transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-slate-700', collapsed && 'justify-center px-2')}>
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-sm font-bold tracking-tight">QTC Syncer</span>
            <p className="text-xs text-slate-400">Data Connector</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems
          .filter((i) => !i.hidden)
          .map((item) => {
            const isActive =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 border border-slate-600 text-slate-300 hover:bg-slate-600 transition-colors z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
