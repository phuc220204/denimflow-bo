import {
  ClipboardList,
  Factory,
  FileSpreadsheet,
  GitFork,
  History,
  Home,
  LogOut,
  Package,
  ShieldCheck,
  User,
} from 'lucide-react';
import React from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { useAuth } from '../lib/auth-context';
import { i18n } from '../lib/i18n/dictionary';

// Permissions matrix: maps each Role to the routes they are allowed to access (PRD.md §4)
const ROLE_ALLOWED_ROUTES: Record<string, string[]> = {
  ADMIN: ['/', '/catalog', '/audit'],
  PROCESS_ENGINEER: ['/', '/workflow', '/catalog'],
  PRODUCTION_PLANNER: ['/', '/orders', '/worklist'],
  WAREHOUSE_KEEPER: ['/', '/inventory'],
  STATION_OPERATOR: ['/', '/worklist'],
  QC_INSPECTOR: ['/', '/qc', '/worklist'],
  MANAGER: ['/', '/orders', '/audit'],
};

export const ProtectedLayout: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-text-muted">{i18n.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const roleLabel = i18n.roles[user.role] || user.role;

  const allNavItems = [
    { label: i18n.nav.home, href: '/', icon: Home, disabled: false },
    { label: i18n.nav.orders, href: '/orders', icon: ClipboardList, disabled: true },
    { label: i18n.nav.workflow, href: '/workflow', icon: GitFork, disabled: true },
    { label: i18n.nav.worklist, href: '/worklist', icon: Factory, disabled: true },
    { label: i18n.nav.qc, href: '/qc', icon: ShieldCheck, disabled: true },
    { label: i18n.nav.inventory, href: '/inventory', icon: Package, disabled: true },
    { label: i18n.nav.catalog, href: '/catalog', icon: FileSpreadsheet, disabled: true },
    { label: i18n.nav.audit, href: '/audit', icon: History, disabled: true },
  ];

  // Filter navigation items strictly for the active user's role (RBAC)
  const allowedHrefs = ROLE_ALLOWED_ROUTES[user.role] || ['/'];
  const navItems = allNavItems.filter((item) => allowedHrefs.includes(item.href));

  return (
    <div className="flex min-h-screen bg-background text-text">
      {/* Sidebar: 240px wide, white, border-right */}
      <aside className="w-[240px] shrink-0 border-r border-border bg-surface flex flex-col justify-between">
        <div>
          {/* Brand header */}
          <div className="flex h-14 items-center px-4 border-b border-border gap-2">
            <div className="h-7 w-7 rounded bg-primary flex items-center justify-center text-white font-bold text-sm">
              DF
            </div>
            <div>
              <span className="font-semibold text-sm text-text block leading-tight">
                {i18n.app.title}
              </span>
              <span className="text-[11px] text-text-muted block leading-none">
                Hệ thống Quản lý Xưởng
              </span>
            </div>
          </div>

          {/* Navigation Links according to role permissions */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Chức năng của bạn
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              return item.disabled ? (
                <div
                  key={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded text-sm text-text-muted opacity-50 cursor-not-allowed"
                  title="Tính năng của phân xưởng sẽ mở trong giai đoạn tiếp theo"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-tint text-primary font-semibold'
                      : 'text-text hover:bg-background'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar footer info */}
        <div className="p-4 border-t border-border text-xs text-text-muted">
          <p className="font-medium text-text">{i18n.app.version}</p>
          <p className="text-[11px]">DenimFlow &bull; Quản lý Xưởng May</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar: 56px high */}
        <header className="h-14 border-b border-border bg-surface px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Link to="/" className="hover:text-primary transition-colors">
              {i18n.nav.home}
            </Link>
            <span>/</span>
            <span className="text-text font-medium">
              {location.pathname === '/' ? 'Bàn làm việc' : location.pathname}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary-tint text-primary flex items-center justify-center font-semibold text-xs">
                <User className="h-4 w-4" />
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-text block leading-tight">
                  {user.fullName}
                </span>
                <span className="text-xs text-text-muted block leading-none">{user.email}</span>
              </div>
            </div>

            <Badge tone="info">{roleLabel}</Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-danger"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{i18n.auth.logoutButton}</span>
            </Button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
