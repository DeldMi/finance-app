'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { PurchaseSimItem } from '@/lib/types';

interface PurchaseSimulatorProps {
  currentMonthlyBalance: number;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export default function PurchaseSimulator({
  currentMonthlyBalance,
}: PurchaseSimulatorProps) {
  const [items, setItems] = useState<PurchaseSimItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [error, setError] = useState('');

  const totalSimulatedCost = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      ),
    [items],
  );
  const projectedBalance = currentMonthlyBalance - totalSimulatedCost;
  const fitsInBudget = projectedBalance >= 0;

  function handleAddItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = itemName.trim();
    const price = Number(itemPrice);
    const quantity = Number(itemQuantity);

    if (!name || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity < 1) {
      setError('Informe o produto, um preço positivo e uma quantidade inteira maior que zero.');
      return;
    }

    setItems((currentItems) => [
      ...currentItems,
      { id: crypto.randomUUID(), name, price, quantity },
    ]);
    setItemName('');
    setItemPrice('');
    setItemQuantity('1');
    setError('');
  }

  function handleRemoveItem(id: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== id),
    );
  }

  return (
    <section className="panel" aria-labelledby="purchase-simulator-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Planeje antes de comprar</p>
          <h2 className="panel-title" id="purchase-simulator-title">
            Simulador de compras
          </h2>
          <p className="panel-description">
            Monte uma lista e veja o impacto no saldo do perfil selecionado.
          </p>
        </div>
      </div>

      <form className="simulator-form" onSubmit={handleAddItem}>
        <label className="field">
          <span className="field-label">Produto</span>
          <input
            className="input"
            type="text"
            maxLength={100}
            placeholder="Ex.: cesta de mercado"
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Preço unitário (R$)</span>
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0,00"
            value={itemPrice}
            onChange={(event) => setItemPrice(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Quantidade</span>
          <input
            className="input"
            type="number"
            min="1"
            step="1"
            value={itemQuantity}
            onChange={(event) => setItemQuantity(event.target.value)}
            required
          />
        </label>
        <button className="button button-primary" type="submit">
          ＋ Adicionar
        </button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th className="table-number" scope="col">Quantidade</th>
              <th className="table-number" scope="col">Unitário</th>
              <th className="table-number" scope="col">Subtotal</th>
              <th scope="col">
                <span className="visually-hidden">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="empty-state" colSpan={5}>
                  Sua lista ainda está vazia. Adicione um produto para começar.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="table-number">{item.quantity}</td>
                  <td className="table-number">
                    {currencyFormatter.format(item.price)}
                  </td>
                  <td className="table-number">
                    {currencyFormatter.format(item.price * item.quantity)}
                  </td>
                  <td className="table-number">
                    <button
                      className="button button-danger"
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label={`Remover ${item.name} da lista`}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="budget-overview" aria-live="polite">
        <div className="budget-item">
          <span className="budget-label">Custo total da lista</span>
          <strong className="budget-value">
            {currencyFormatter.format(totalSimulatedCost)}
          </strong>
        </div>
        <div className="budget-item">
          <span className="budget-label">Saldo após a compra</span>
          <strong className="budget-value">
            {currencyFormatter.format(projectedBalance)}
          </strong>
        </div>
        <div className="budget-item">
          <span className="budget-label">Situação do orçamento</span>
          <span
            className={`budget-status ${fitsInBudget ? '' : 'budget-status-over'}`}
          >
            {fitsInBudget ? 'Cabe no saldo disponível' : 'Ultrapassa o saldo disponível'}
          </span>
        </div>
      </div>
    </section>
  );
}
