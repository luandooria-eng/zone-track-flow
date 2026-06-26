import { Link, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/useSidebar';
import {
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Repeat,
  BarChart3,
  Menu,
  Megaphone,
  MessageCircle,
  Target,
  Send,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWhatsAppConversations } from '@/hooks/useWhatsApp';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: MessageCircle, label: 'WhatsApp', path: '/whatsapp' },
  { icon: Target, label: 'CRM Funil', path: '/crm' },
  { icon: Send, label: 'Mensagens Auto', path: '/crm/mensagens' },
  { icon: BarChart3, label: 'CRM Métricas', path: '/crm/metricas' },
  { icon: Repeat, label: 'Reativação Auto', path: '/crm/reativacao' },
  { icon: Megaphone, label: 'CRM Campanhas', path: '/crm/campanhas' },
];

interface MenuSectionProps {
  title: string;
  items: typeof menuItems;
  isCollapsed: boolean;
  currentPath: string;
  badges?: Record<string, number>;
}

function MenuSection({ title, items, isCollapsed, currentPath, badges = {} }: MenuSectionProps) {
  const activeItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentPath]);

  return (
    <div className="mb-4">
      {!isCollapsed && (
        <div className="px-3 py-2 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-text-muted/70">
            {title}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const isActive = currentPath === item.path;
          const badge = badges[item.path] ?? 0;
          return (
            <Link
              key={item.path}
              to={item.path}
              ref={isActive ? activeItemRef : null}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                'text-sidebar-text/80 hover:text-sidebar-text hover:bg-sidebar-hover/40',
                isActive && 'bg-primary/15 text-primary border-l-2 border-primary ml-2 mr-2'
              )}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
              {!isCollapsed && (
                <>
                  <span className="truncate flex-1">{item.label}</span>
                  {badge > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-semibold text-white">
                      {badge}
                    </span>
                  )}
                </>
              )}
              {isCollapsed && badge > 0 && (
                <span className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-green-500 text-[8px] text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();
  const { isCollapsed, toggle } = useSidebar();
  const { data: conversations = [] } = useWhatsAppConversations();
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const mainBadges = totalUnread > 0 ? { '/whatsapp': totalUnread } : {};

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/50 lg:hidden transition-opacity duration-300',
          isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
        )}
        onClick={toggle}
      />

      {/* Mobile toggle button */}
      <button
        onClick={toggle}
        className="fixed top-4 left-4 z-50 lg:hidden flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar text-sidebar-text shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen bg-sidebar flex flex-col transition-all duration-300 ease-in-out',
          'lg:translate-x-0',
          isCollapsed ? 'w-[68px] -translate-x-full lg:translate-x-0' : 'w-[240px] translate-x-0'
        )}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 flex h-14 items-center justify-between px-3 border-b border-sidebar-hover/20">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shrink-0">
              <Droplets className="h-5 w-5 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-white truncate leading-tight">
                  Seu Geraldo
                </span>
                <span className="text-[10px] text-sidebar-text-muted truncate">
                  Gás e Água
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={toggle}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md text-sidebar-text/60 hover:text-sidebar-text hover:bg-sidebar-hover/40 transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Scrollable Navigation */}
        <ScrollArea className="flex-1 py-3">
          <nav className="px-1">
            <MenuSection
              title="Menu Principal"
              items={menuItems}
              isCollapsed={isCollapsed}
              currentPath={location.pathname}
              badges={mainBadges}
            />
          </nav>
        </ScrollArea>

        {/* Fixed Footer - User Info */}
        <div className="flex-shrink-0 border-t border-sidebar-hover/20 p-3">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-hover/30 p-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shrink-0">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">Admin</p>
                <p className="text-[10px] text-sidebar-text-muted truncate">admin@seugeraldo.com</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                A
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
