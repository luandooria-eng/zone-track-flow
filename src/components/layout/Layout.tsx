import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useSidebar } from '@/hooks/useSidebar';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          'ml-0 lg:ml-[68px]',
          !isCollapsed && 'lg:ml-[240px]'
        )}
      >
        <Topbar />
        <main className="p-4 lg:p-6 pt-16 lg:pt-6">{children}</main>
      </div>
    </div>
  );
}
