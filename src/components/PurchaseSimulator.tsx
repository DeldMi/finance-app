'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type MeasureUnit = 'un' | 'kg' | 'g' | 'L' | 'mL' | 'm³';
type ShoppingItem = {
  id: string;
  name: string;
  quantity: number;
  unit: MeasureUnit;
  unitPrice: number;
  checked: boolean;
};
type ShoppingList = {
  id: string;
  name: string;
  shareToken: string | null;
  items: ShoppingItem[];
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const units: MeasureUnit[] = ['un', 'kg', 'g', 'L', 'mL', 'm³'];

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) throw new Error(`Resposta vazia do servidor (HTTP ${response.status}).`);
  const data = JSON.parse(text);
  if (!response.ok) throw new Error(data.error || 'Não foi possível salvar os dados.');
  return data;
}

export default function PurchaseSimulator({ physicalBalance, legalBalance }: { physicalBalance: number; legalBalance: number }) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeListId, setActiveListId] = useState('');
  const [name, setName] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState<MeasureUnit>('un');
  const [unitPrice, setUnitPrice] = useState('');
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [entity, setEntity] = useState<'PHYSICAL' | 'LEGAL'>('PHYSICAL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const activeList = lists.find((list) => list.id === activeListId) ?? null;
  const currentMonthlyBalance = entity === 'PHYSICAL' ? physicalBalance : legalBalance;

  useEffect(() => {
    fetch('/api/shopping-lists')
      .then(readJson)
      .then((data: ShoppingList[]) => {
        setLists(data);
        setActiveListId(data[0]?.id || '');
        setName(data[0]?.name || '');
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Falha ao carregar listas.'));
  }, []);

  useEffect(() => {
    if (activeList) setName(activeList.name);
    setShareUrl(activeList?.shareToken ? `${window.location.origin}/share/${activeList.shareToken}` : '');
    setEditingItem(null);
  }, [activeListId, activeList?.shareToken]);

  const allTotal = useMemo(
    () => activeList?.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) ?? 0,
    [activeList],
  );
  const checkedItems = activeList?.items.filter((item) => item.checked) ?? [];
  const checkedTotal = checkedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const remainingBalance = currentMonthlyBalance - checkedTotal;
  const unitCounts = units.map((measure) => ({
    unit: measure,
    quantity: activeList?.items.filter((item) => item.unit === measure).reduce((sum, item) => sum + item.quantity, 0) ?? 0,
  })).filter((entry) => entry.quantity > 0);
  const volumeLiters = activeList?.items.reduce((sum, item) => {
    if (item.unit === 'L') return sum + item.quantity;
    if (item.unit === 'mL') return sum + item.quantity / 1000;
    if (item.unit === 'm³') return sum + item.quantity * 1000;
    return sum;
  }, 0) ?? 0;
  const massKilograms = activeList?.items.reduce((sum, item) => {
    if (item.unit === 'kg') return sum + item.quantity;
    if (item.unit === 'g') return sum + item.quantity / 1000;
    return sum;
  }, 0) ?? 0;

  function updateLocalList(listId: string, updater: (list: ShoppingList) => ShoppingList) {
    setLists((current) => current.map((list) => list.id === listId ? updater(list) : list));
  }

  async function createList() {
    setBusy(true);
    setError('');
    try {
      const list = await readJson(await fetch('/api/shopping-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Lista ${lists.length + 1}` }),
      }));
      setLists((current) => [list, ...current]);
      setActiveListId(list.id);
      setNotice('Lista criada e salva.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao criar lista.');
    } finally {
      setBusy(false);
    }
  }

  async function saveList() {
    if (!activeList) return;
    setBusy(true);
    setError('');
    try {
      const updated = await readJson(await fetch(`/api/shopping-lists/${activeList.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, shareEnabled: Boolean(activeList.shareToken) }),
      }));
      updateLocalList(activeList.id, (list) => ({ ...list, name: updated.name }));
      setNotice('Nome da lista salvo.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar lista.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteList() {
    if (!activeList || !window.confirm(`Excluir “${activeList.name}” e todos os itens dela?`)) return;
    setBusy(true);
    try {
      await readJson(await fetch(`/api/shopping-lists/${activeList.id}`, { method: 'DELETE' }));
      const remaining = lists.filter((list) => list.id !== activeList.id);
      setLists(remaining);
      setActiveListId(remaining[0]?.id || '');
      setNotice('Lista excluída.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao excluir lista.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleSharing() {
    if (!activeList) return;
    setBusy(true);
    setError('');
    try {
      const updated = await readJson(await fetch(`/api/shopping-lists/${activeList.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: activeList.name, shareEnabled: !activeList.shareToken }),
      }));
      updateLocalList(activeList.id, (list) => ({ ...list, shareToken: updated.shareToken }));
      if (updated.shareToken) {
        const link = `${window.location.origin}/share/${updated.shareToken}`;
        setShareUrl(link);
        try {
          await navigator.clipboard.writeText(link);
          setNotice('Link de leitura copiado. Qualquer pessoa com o link pode ver esta lista.');
        } catch {
          setNotice('Link criado. Copie o endereço exibido abaixo para compartilhar.');
        }
      } else {
        setShareUrl('');
        setNotice('Compartilhamento desativado. O link antigo não funciona mais.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao compartilhar a lista.');
    } finally {
      setBusy(false);
    }
  }

  function startEditing(item: ShoppingItem) {
    setEditingItem(item);
    setItemName(item.name);
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setUnitPrice(String(item.unitPrice));
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeList) return;
    const payload = {
      name: itemName.trim(),
      quantity: Number(quantity),
      unit,
      unitPrice: Number(unitPrice),
      checked: editingItem?.checked ?? true,
    };
    if (!payload.name || payload.quantity <= 0 || payload.unitPrice < 0) {
      setError('Informe um nome, quantidade e preço válidos.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (editingItem) {
        await readJson(await fetch(`/api/shopping-lists/${activeList.id}/items/${editingItem.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        }));
        updateLocalList(activeList.id, (list) => ({
          ...list,
          items: list.items.map((item) => item.id === editingItem.id ? { ...item, ...payload } : item),
        }));
      } else {
        const item = await readJson(await fetch(`/api/shopping-lists/${activeList.id}/items`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        }));
        updateLocalList(activeList.id, (list) => ({ ...list, items: [...list.items, item] }));
      }
      setItemName('');
      setQuantity('1');
      setUnit('un');
      setUnitPrice('');
      setEditingItem(null);
      setNotice('Item salvo na lista.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar item.');
    } finally {
      setBusy(false);
    }
  }

  async function updateItem(item: ShoppingItem, updates: Partial<ShoppingItem>) {
    if (!activeList) return;
    const changed = { ...item, ...updates };
    updateLocalList(activeList.id, (list) => ({
      ...list,
      items: list.items.map((current) => current.id === item.id ? changed : current),
    }));
    try {
      await readJson(await fetch(`/api/shopping-lists/${activeList.id}/items/${item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changed),
      }));
    } catch (cause) {
      updateLocalList(activeList.id, (list) => ({
        ...list,
        items: list.items.map((current) => current.id === item.id ? item : current),
      }));
      setError(cause instanceof Error ? cause.message : 'Falha ao atualizar item.');
    }
  }

  async function deleteItem(item: ShoppingItem) {
    if (!activeList || !window.confirm(`Excluir “${item.name}” da lista?`)) return;
    try {
      await readJson(await fetch(`/api/shopping-lists/${activeList.id}/items/${item.id}`, { method: 'DELETE' }));
      updateLocalList(activeList.id, (list) => ({ ...list, items: list.items.filter((current) => current.id !== item.id) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao excluir item.');
    }
  }

  async function addSelectedToTransactions() {
    if (!activeList || !checkedItems.length || checkedTotal <= 0) return;
    setBusy(true);
    setError('');
    try {
      const descriptions = checkedItems.map((item) => item.name).join(', ');
      const description = `Lista: ${activeList.name} (${descriptions})`.slice(0, 120);
      await readJson(await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: checkedTotal,
          type: 'EXPENSE',
          entity,
          category: 'Compras',
          date: new Date().toISOString().slice(0, 10),
          status: 'PENDING',
          installments: 1,
        }),
      }));
      setNotice(`Lançamento pendente criado com ${checkedItems.length} item(ns) marcado(s), total de ${money.format(checkedTotal)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao criar lançamento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel shopping-planner" aria-labelledby="shopping-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Planeje antes de comprar</p>
          <h2 className="panel-title" id="shopping-title">Simulador de compras</h2>
          <p className="panel-description">Suas listas são salvas na conta e ficam disponíveis após atualizar a página.</p>
        </div>
      </div>

      <div className="shopping-list-controls">
        <label className="field shopping-list-select">
          <span className="field-label">Lista</span>
          <select className="select" value={activeList?.id || ''} onChange={(event) => setActiveListId(event.target.value)}>
            {!lists.length && <option value="">Nenhuma lista</option>}
            {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
        </label>
        <div className="shopping-list-actions">
          <button className="button button-secondary" type="button" onClick={() => void createList()} disabled={busy}>+ Nova lista</button>
          <button className="button button-secondary" type="button" onClick={() => void saveList()} disabled={busy || !activeList}>Salvar nome</button>
          <button className="button button-secondary" type="button" onClick={() => void toggleSharing()} disabled={busy || !activeList}>{activeList?.shareToken ? 'Copiar link' : 'Compartilhar'}</button>
          <button className="button button-danger" type="button" onClick={() => void deleteList()} disabled={busy || !activeList}>Excluir lista</button>
        </div>
      </div>
      {shareUrl && <label className="field share-link-field"><span className="field-label">Link compartilhado (somente leitura)</span><input className="input" value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} /></label>}

      {activeList && (
        <>
          <label className="field shopping-list-name">
            <span className="field-label">Nome da lista</span>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} />
          </label>

          <div className="shopping-summary-grid" aria-live="polite">
            <div className="budget-item"><span className="budget-label">Valor de toda a lista</span><strong className="budget-value">{money.format(allTotal)}</strong></div>
            <div className="budget-item"><span className="budget-label">Valor dos itens marcados</span><strong className="budget-value">{money.format(checkedTotal)}</strong></div>
            <div className="budget-item"><span className="budget-label">Itens</span><strong className="budget-value">{activeList.items.length}</strong></div>
            <div className="budget-item"><span className="budget-label">Quantidades</span><strong className="budget-value">{unitCounts.length ? unitCounts.map((entry) => `${entry.quantity} ${entry.unit}`).join(' · ') : '—'}</strong></div>
            <div className="budget-item"><span className="budget-label">Volume e peso</span><strong className="budget-value">{volumeLiters.toLocaleString('pt-BR')} L · {massKilograms.toLocaleString('pt-BR')} kg</strong></div>
            <div className="budget-item"><span className="budget-label">Saldo registrado</span><strong className="budget-value">{money.format(currentMonthlyBalance)}</strong></div>
            <div className="budget-item"><span className="budget-label">Saldo após os itens marcados</span><strong className={`budget-value ${remainingBalance < 0 ? 'type-expense' : 'type-income'}`}>{money.format(remainingBalance)}</strong></div>
          </div>

          <form className="simulator-form" onSubmit={(event) => void saveItem(event)}>
            <label className="field"><span className="field-label">Produto</span><input className="input" value={itemName} onChange={(event) => setItemName(event.target.value)} maxLength={100} required /></label>
            <label className="field"><span className="field-label">Quantidade</span><input className="input" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
            <label className="field"><span className="field-label">Unidade de medida</span><select className="select" value={unit} onChange={(event) => setUnit(event.target.value as MeasureUnit)}>{units.map((measure) => <option key={measure} value={measure}>{measure === 'un' ? 'Unidade' : measure}</option>)}</select></label>
            <label className="field"><span className="field-label">Valor por unidade (R$)</span><input className="input" type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} required /></label>
            <button className="button button-primary" type="submit" disabled={busy}>{editingItem ? 'Salvar item' : '+ Adicionar item'}</button>
            {editingItem && <button className="button button-secondary" type="button" onClick={() => { setEditingItem(null); setItemName(''); setQuantity('1'); setUnit('un'); setUnitPrice(''); }}>Cancelar</button>}
          </form>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Incluir</th><th>Produto</th><th className="table-number">Quantidade</th><th>Unidade</th><th className="table-number">Valor unitário</th><th className="table-number">Subtotal</th><th>Ações</th></tr></thead>
              <tbody>
                {activeList.items.map((item) => (
                  <tr key={item.id}>
                    <td><input type="checkbox" checked={item.checked} onChange={(event) => void updateItem(item, { checked: event.target.checked })} aria-label={`Incluir ${item.name} no lançamento`} /></td>
                    <td>{item.name}</td>
                    <td className="table-number">{item.quantity}</td>
                    <td>{item.unit}</td>
                    <td className="table-number">{money.format(item.unitPrice)}</td>
                    <td className="table-number">{money.format(item.unitPrice * item.quantity)}</td>
                    <td><div className="row-actions"><button className="button button-secondary button-compact" type="button" onClick={() => startEditing(item)}>Editar</button><button className="button button-danger button-compact" type="button" onClick={() => void deleteItem(item)}>Excluir</button></div></td>
                  </tr>
                ))}
                {!activeList.items.length && <tr><td className="empty-state" colSpan={7}>Sua lista está vazia. Adicione um item para começar.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="shopping-list-footer">
            <label className="field">
              <span className="field-label">Setor do lançamento</span>
              <select className="select" value={entity} onChange={(event) => setEntity(event.target.value as 'PHYSICAL' | 'LEGAL')}>
                <option value="PHYSICAL">Pessoal (PF)</option>
                <option value="LEGAL">Empresa (PJ)</option>
              </select>
            </label>
            <button className="button button-primary" type="button" onClick={() => void addSelectedToTransactions()} disabled={busy || !checkedItems.length || checkedTotal <= 0}>
              Adicionar itens marcados ao lançamento · {money.format(checkedTotal)}
            </button>
          </div>
        </>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
    </section>
  );
}
