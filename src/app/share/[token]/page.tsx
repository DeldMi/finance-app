'use client';

import { useEffect, useMemo, useState } from 'react';

type SharedItem = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  checked: boolean;
};

type SharedList = { name: string; updatedAt: string; items: SharedItem[] };
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SharedShoppingListPage({ params }: { params: { token: string } }) {
  const [list, setList] = useState<SharedList | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/shared/shopping-lists/${params.token}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível abrir a lista.');
        setList(data);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a lista.'));
  }, [params.token]);

  const total = useMemo(
    () => list?.items.filter((item) => item.checked).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) ?? 0,
    [list],
  );

  return (
    <main className="page-shell shared-list-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Lista compartilhada · somente leitura</p>
          <h1>{list?.name || 'Planeje antes de comprar'}</h1>
          <p className="page-subtitle">{list ? `${list.items.length} itens` : 'Carregando lista…'}</p>
        </div>
      </header>
      {error && <section className="panel"><p className="form-error" role="alert">{error}</p></section>}
      {list && (
        <section className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Na lista</th><th>Produto</th><th className="table-number">Quantidade</th><th className="table-number">Unitário</th><th className="table-number">Subtotal</th></tr></thead>
              <tbody>{list.items.map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td>{item.checked ? '✓' : '—'}</td>
                  <td>{item.name}</td>
                  <td className="table-number">{item.quantity} {item.unit}</td>
                  <td className="table-number">{money.format(item.unitPrice)}</td>
                  <td className="table-number">{money.format(item.quantity * item.unitPrice)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="budget-overview">
            <div className="budget-item"><span className="budget-label">Total marcado</span><strong className="budget-value">{money.format(total)}</strong></div>
          </div>
        </section>
      )}
    </main>
  );
}
