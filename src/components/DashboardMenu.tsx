'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  House,
  Landmark,
  Menu,
  Settings,
  ShoppingCart,
  Tags,
  X,
} from 'lucide-react';

export type DashboardTab =
  | 'overview'
  | 'entries'
  | 'cards'
  | 'institutions'
  | 'categories'
  | 'reports'
  | 'settings';

type DashboardMenuProps = {
  tab: DashboardTab;
  setTab: (tab: DashboardTab) => void;
  onSettingsClick?: () => void;
};

const menuItems = [
  { value: 'overview' as const, label: 'Visão geral', Icon: House },
  { value: 'entries' as const, label: 'Lançamentos', Icon: ArrowLeftRight },
  { value: 'cards' as const, label: 'Cartões', Icon: CreditCard },
  { value: 'institutions' as const, label: 'Bancos e contas', Icon: Landmark },
  { value: 'categories' as const, label: 'Categorias', Icon: Tags },
  { value: 'reports' as const, label: 'Relatórios', Icon: ChartNoAxesCombined },
];

export default function DashboardMenu({
  tab,
  setTab,
  onSettingsClick,
}: DashboardMenuProps) {
  const pathname = usePathname();
  const isShoppingPage = pathname === '/dashboard/shopping';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const dashboardHref = (value: DashboardTab) => `/dashboard?tab=${value}`;

  return (
    <>
      <button
        type="button"
        className="sidebar-mobile-toggle"
        aria-label={mobileOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
        aria-expanded={mobileOpen}
        aria-controls="dashboard-sidebar"
        onClick={() => setMobileOpen((open) => !open)}
      >
        {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fechar menu de navegação"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <nav
        id="dashboard-sidebar"
        className={`section-nav${collapsed ? ' section-nav-collapsed' : ''}${mobileOpen ? ' section-nav-mobile-open' : ''}`}
        aria-label="Navegação principal"
      >
        <div className="sidebar-heading">
          {!collapsed && <span className="sidebar-heading-label">Meu Financeiro</span>}
          <button
            type="button"
            className="sidebar-collapse-toggle"
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}
          </button>
        </div>

        {menuItems.map(({ value, label, Icon }) => (
          isShoppingPage ? (
            <Link
              key={value}
              href={dashboardHref(value)}
              className={`section-link ${tab === value ? 'section-link-active' : ''}`}
              title={collapsed ? label : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <Icon aria-hidden="true" />
              <span className="section-link-label">{label}</span>
            </Link>
          ) : (
            <button
              key={value}
              className={`section-link ${tab === value ? 'section-link-active' : ''}`}
              type="button"
              aria-current={tab === value ? 'page' : undefined}
              title={collapsed ? label : undefined}
              onClick={() => {
                setTab(value);
                setMobileOpen(false);
              }}
            >
              <Icon aria-hidden="true" />
              <span className="section-link-label">{label}</span>
            </button>
          )
        ))}

        <Link
          className={`section-link ${isShoppingPage ? 'section-link-active' : ''}`}
          href="/dashboard/shopping"
          title={collapsed ? 'Planeje antes de comprar' : undefined}
          onClick={() => setMobileOpen(false)}
        >
          <ShoppingCart aria-hidden="true" />
          <span className="section-link-label">Planeje antes de comprar</span>
        </Link>

        {isShoppingPage ? (
          <Link
            className="section-link"
            href={dashboardHref('settings')}
            title={collapsed ? 'Configurações' : undefined}
            onClick={() => setMobileOpen(false)}
          >
            <Settings aria-hidden="true" />
            <span className="section-link-label">Configurações</span>
          </Link>
        ) : (
          <button
            className={`section-link ${tab === 'settings' ? 'section-link-active' : ''}`}
            type="button"
            aria-current={tab === 'settings' ? 'page' : undefined}
            title={collapsed ? 'Configurações' : undefined}
            onClick={() => {
              setTab('settings');
              setMobileOpen(false);
              onSettingsClick?.();
            }}
          >
            <Settings aria-hidden="true" />
            <span className="section-link-label">Configurações</span>
          </button>
        )}
      </nav>
    </>
  );
}
