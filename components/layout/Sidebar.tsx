'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, MapPin, Activity } from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard',   label: 'Дашборд',    icon: LayoutDashboard },
  { href: '/objects',     label: 'Объекты',     icon: Building2 },
  { href: '/areas',       label: 'Площадки',    icon: MapPin },
  { href: '/monitoring',  label: 'Мониторинг',  icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="text-lg font-bold tracking-tight">Спорт Гид</span>
        <span className="block text-xs text-slate-400 mt-0.5">Admin Panel</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
