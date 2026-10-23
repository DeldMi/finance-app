'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PurchaseSimulator from '@/components/PurchaseSimulator';


import DashboardMenu, {
  type DashboardTab,
} from '@/components/DashboardMenu';


type Account = { id: string; entity: string; initialBalance: number };
type Transaction = {
  accountId: string | null;
  amount: number;
  entity: string;
  status: string;
  type: string;
};

type Tab = DashboardTab;

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) throw new Error(`Resposta vazia do servidor (HTTP ${response.status}).`);
  const data = JSON.parse(text);
  if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o saldo.');
  return data;
}

export default function ShoppingPlannerPage() {

  const [tab, setTab] = useState<DashboardTab>('overview');

  const [balances, setBalances] = useState({ physical: 0, legal: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/institutions').then(readResponse) as Promise<Account[]>,
      fetch('/api/transactions').then(readResponse) as Promise<Transaction[]>,
    ]).then(([accounts, transactions]) => {
      const calculate = (entity: string) => accounts
        .filter((account) => account.entity === entity)
        .reduce((total, account) => {
          const movements = transactions
            .filter((item) => item.accountId === account.id && item.status === 'PAID')
            .reduce((sum, item) => sum + (item.type === 'INCOME' ? item.amount : -item.amount), 0);
          return total + account.initialBalance + movements;
        }, 0);
      setBalances({ physical: calculate('PHYSICAL'), legal: calculate('LEGAL') });
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Não foi possível calcular o saldo das contas.');
    });
  }, []);

  return (
    <main className="page-shell">
      <header className="page-header shopping-page-header">
        <div>
          <p className="eyebrow">Meu Financeiro</p>
          <h1>Planeje antes de comprar</h1>
          <p className="page-subtitle">Organize listas, compare com o saldo das contas e registre somente os itens marcados.</p>
        </div>
        <Link className="button button-secondary" href="/dashboard">Voltar ao painel</Link>
      </header>


      {/* <DashboardMenu
        tab={tab}
        setTab={setTab}
        onSettingsClick={() => {
          if (session?.user.role === 'ADMIN') {
            void loadAdminUsers();
          }
        }}
      /> */}


      {error && <p className="form-error" role="alert">{error}</p>}
      <PurchaseSimulator physicalBalance={balances.physical} legalBalance={balances.legal} />
    </main>
  );
}
