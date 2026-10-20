'use client';

import { signOut } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PurchaseSimulator from '@/components/PurchaseSimulator';
import type { EntityType, Transaction, TransactionType } from '@/lib/types';

type EntityFilter = 'ALL' | EntityType;

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export default function DashboardPage() {
  const [filterEntity, setFilterEntity] = useState<EntityFilter>('ALL');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [entity, setEntity] = useState<EntityType>('PHYSICAL');
  const [category, setCategory] = useState('');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/transactions');
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === 'object' && data !== null && 'error' in data
            ? String(data.error)
            : 'Não foi possível carregar as transações.',
        );
      }
      if (!Array.isArray(data)) {
        throw new Error('A resposta da API de transações é inválida.');
      }
      setTransactions(data as Transaction[]);
    } catch (fetchError) {
      console.error('Falha ao carregar transações:', fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Não foi possível carregar as transações.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          filterEntity === 'ALL' || transaction.entity === filterEntity,
      ),
    [filterEntity, transactions],
  );

  const totalIncome = filteredTransactions
    .filter((transaction) => transaction.type === 'INCOME')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const totalExpense = filteredTransactions
    .filter((transaction) => transaction.type === 'EXPENSE')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const currentBalance = totalIncome - totalExpense;

  async function handleAddTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount,
          type,
          entity,
          category: category || 'Geral',
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof result === 'object' && result !== null && 'error' in result
            ? String(result.error)
            : 'Não foi possível salvar a transação.',
        );
      }

      setDescription('');
      setAmount('');
      setCategory('');
      await fetchTransactions();
    } catch (saveError) {
      console.error('Falha ao salvar transação:', saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Não foi possível salvar a transação.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            ◒
          </span>
          <div>
            <p className="eyebrow">Seu dinheiro, com clareza</p>
            <h1 className="page-title">Painel financeiro</h1>
            <p className="page-subtitle">
              Acompanhe as finanças da família e da empresa em um só lugar.
            </p>
          </div>
        </div>
        <div className="header-actions">
          <div className="segmented-control" aria-label="Filtrar por perfil">
            {(
              [
                ['ALL', 'Visão geral'],
                ['PHYSICAL', 'Família'],
                ['LEGAL', 'Empresa'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className="segment-button"
                aria-pressed={filterEntity === mode}
                onClick={() => setFilterEntity(mode)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void signOut({ callbackUrl: '/login' })}
          >
            Sair da conta
          </button>
        </div>
      </header>

      <section className="summary-grid" aria-label="Resumo financeiro">
        <article className="summary-card summary-card-income">
          <span className="summary-label">Entradas</span>
          <strong className="summary-value summary-value-income">
            {currencyFormatter.format(totalIncome)}
          </strong>
        </article>
        <article className="summary-card summary-card-expense">
          <span className="summary-label">Saídas</span>
          <strong className="summary-value summary-value-expense">
            {currencyFormatter.format(totalExpense)}
          </strong>
        </article>
        <article className="summary-card summary-card-balance">
          <span className="summary-label">Saldo disponível</span>
          <strong className="summary-value summary-value-balance">
            {currencyFormatter.format(currentBalance)}
          </strong>
        </article>
      </section>

      <section className="panel" aria-labelledby="transaction-form-title">
        <div className="panel-heading">
          <div>
            <h2 className="panel-title" id="transaction-form-title">
              Nova movimentação
            </h2>
            <p className="panel-description">
              Registre uma entrada ou saída no perfil correspondente.
            </p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleAddTransaction}>
          <label className="field">
            <span className="field-label">Descrição</span>
            <input
              className="input"
              type="text"
              maxLength={120}
              placeholder="Ex.: mercado, salário..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Valor (R$)</span>
            <input
              className="input"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Movimentação</span>
            <select
              className="select"
              value={type}
              onChange={(event) =>
                setType(event.target.value as TransactionType)
              }
            >
              <option value="EXPENSE">Saída</option>
              <option value="INCOME">Entrada</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Perfil</span>
            <select
              className="select"
              value={entity}
              onChange={(event) => setEntity(event.target.value as EntityType)}
            >
              <option value="PHYSICAL">Família (PF)</option>
              <option value="LEGAL">Empresa (PJ)</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Categoria</span>
            <input
              className="input"
              type="text"
              maxLength={60}
              placeholder="Geral"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </label>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : '＋ Lançar'}
          </button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>

      <PurchaseSimulator currentMonthlyBalance={currentBalance} />

      <section className="panel" aria-labelledby="statement-title">
        <div className="panel-heading">
          <div>
            <h2 className="panel-title" id="statement-title">
              Extrato
            </h2>
            <p className="panel-description">
              Movimentações registradas na sua conta.
            </p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void fetchTransactions()}
            disabled={loading}
          >
            Atualizar
          </button>
        </div>
        {loading ? (
          <p className="panel-description" role="status">
            Carregando movimentações...
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Descrição</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Perfil</th>
                  <th scope="col">Data</th>
                  <th scope="col">Tipo</th>
                  <th className="table-number" scope="col">Valor</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td className="empty-state" colSpan={6}>
                      Nenhuma movimentação registrada para este perfil.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.description}</td>
                      <td>{transaction.category || 'Geral'}</td>
                      <td>
                        <span
                          className={`profile-badge ${
                            transaction.entity === 'PHYSICAL'
                              ? 'profile-badge-family'
                              : 'profile-badge-business'
                          }`}
                        >
                          {transaction.entity === 'PHYSICAL' ? 'Família' : 'Empresa'}
                        </span>
                      </td>
                      <td>
                        {dateFormatter.format(new Date(transaction.date))}
                      </td>
                      <td>
                        {transaction.type === 'INCOME' ? 'Entrada' : 'Saída'}
                      </td>
                      <td
                        className={`table-number ${
                          transaction.type === 'INCOME'
                            ? 'type-income'
                            : 'type-expense'
                        }`}
                      >
                        {transaction.type === 'INCOME' ? '+' : '−'}
                        {currencyFormatter.format(transaction.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
