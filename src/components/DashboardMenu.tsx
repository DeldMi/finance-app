
'use client';

import Link from 'next/link';

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

const menuItems: { value: DashboardTab; label: string }[] = [
  { value: 'overview', label: 'Visão geral' },
  { value: 'entries', label: 'Lançamentos' },
  { value: 'cards', label: 'Cartões' },
  { value: 'institutions', label: 'Bancos e contas' },
  { value: 'categories', label: 'Categorias' },
  { value: 'reports', label: 'Relatórios' },
];

export default function DashboardMenu({
  tab,
  setTab,
  onSettingsClick,
}: DashboardMenuProps) {
  return (
    <nav className="section-nav" aria-label="Seções do financeiro">
      {menuItems.map(({ value, label }) => (
        <button
          key={value}
          className={`section-link ${
            tab === value ? 'section-link-active' : ''
          }`}
          type="button"
          aria-current={tab === value ? 'page' : undefined}
          onClick={() => setTab(value)}
        >
          {label}
        </button>
      ))}

      <Link className="section-link" href="/dashboard/shopping">
        Planeje antes de comprar
      </Link>

      <button
        className={`section-link ${
          tab === 'settings' ? 'section-link-active' : ''
        }`}
        type="button"
        aria-current={tab === 'settings' ? 'page' : undefined}
        onClick={() => {
          setTab('settings');
          onSettingsClick?.();
        }}
      >
        Configurações
      </button>
    </nav>
  );
}
