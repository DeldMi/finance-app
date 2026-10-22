'use client';

import { signOut } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PurchaseSimulator from '@/components/PurchaseSimulator';
import type { EntityType, TransactionType } from '@/lib/types';

type Card = { id: string; name: string; brand?: string | null; lastFour?: string | null; creditLimit?: number | null; closingDay?: number | null; dueDay?: number | null };
type Entry = { id: string; description: string; amount: number; type: TransactionType; entity: EntityType; category: string; date: string; dueDate?: string | null; status: 'PAID' | 'PENDING'; recurrence?: string | null; installmentNumber?: number | null; installmentTotal?: number | null; cardId?: string | null; card?: Card | null };
type Tab = 'overview' | 'entries' | 'cards' | 'reports';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : '—';
const isoToday = new Date().toISOString().slice(0, 10);

async function readJson(response: Response) {
  const body = await response.text();
  if (!body) throw new Error(`O servidor retornou uma resposta vazia (HTTP ${response.status}).`);
  try { return JSON.parse(body) as any; }
  catch { throw new Error(`O servidor retornou uma resposta inválida (HTTP ${response.status}).`); }
}

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [filterEntity, setFilterEntity] = useState<'ALL' | EntityType>('ALL');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [entity, setEntity] = useState<EntityType>('PHYSICAL');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(isoToday);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [installments, setInstallments] = useState('1');
  const [recurrence, setRecurrence] = useState('');
  const [cardId, setCardId] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardBrand, setCardBrand] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [cardDueDay, setCardDueDay] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [entriesResponse, cardsResponse] = await Promise.all([fetch('/api/transactions'), fetch('/api/cards')]);
      const [entryData, cardData] = await Promise.all([readJson(entriesResponse), readJson(cardsResponse)]);
      if (!entriesResponse.ok) throw new Error(entryData.error || 'Não foi possível carregar os lançamentos.');
      if (!cardsResponse.ok) throw new Error(cardData.error || 'Não foi possível carregar os cartões.');
      setEntries(entryData); setCards(cardData);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar dados.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => entries.filter(item => filterEntity === 'ALL' || item.entity === filterEntity), [entries, filterEntity]);
  const paid = filtered.filter(item => item.status === 'PAID');
  const income = paid.filter(item => item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0);
  const expenses = paid.filter(item => item.type === 'EXPENSE').reduce((sum, item) => sum + item.amount, 0);
  const due = filtered.filter(item => item.status === 'PENDING' && item.type === 'EXPENSE').reduce((sum, item) => sum + item.amount, 0);
  const incoming = filtered.filter(item => item.status === 'PENDING' && item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0);
  const balance = income - expenses;
  const categories = Object.entries(paid.filter(item => item.type === 'EXPENSE').reduce<Record<string, number>>((map, item) => { map[item.category || 'Geral'] = (map[item.category || 'Geral'] || 0) + item.amount; return map; }, {})).sort((a, b) => b[1] - a[1]);

  function resetForm() { setDescription(''); setAmount(''); setCategory(''); setDate(isoToday); setDueDate(''); setStatus('PAID'); setInstallments('1'); setRecurrence(''); setCardId(''); setEditing(null); }
  async function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(editing ? `/api/transactions/${editing.id}` : '/api/transactions', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description, amount, type, entity, category: category || 'Geral', date, dueDate: dueDate || null, status, installments: editing ? 1 : installments, recurrence: editing ? null : recurrence || null, cardId: cardId || null }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
      resetForm(); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao salvar lançamento.'); }
    finally { setBusy(false); }
  }
  function startEdit(item: Entry) { setEditing(item); setDescription(item.description); setAmount(String(item.amount)); setType(item.type); setEntity(item.entity); setCategory(item.category); setDate(item.date.slice(0, 10)); setDueDate(item.dueDate?.slice(0, 10) || ''); setStatus(item.status); setCardId(item.cardId || ''); setInstallments('1'); setRecurrence(''); setTab('entries'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  async function removeEntry(item: Entry) { if (!window.confirm(`Excluir “${item.description}”?`)) return; const response = await fetch(`/api/transactions/${item.id}`, { method: 'DELETE' }); if (!response.ok) { const result = await response.json(); setError(result.error || 'Erro ao excluir.'); return; } await refresh(); }
  async function saveCard(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); try { const response = await fetch('/api/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cardName, brand: cardBrand, lastFour, creditLimit, closingDay, dueDay: cardDueDay }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Erro ao cadastrar cartão.'); setCardName(''); setCardBrand(''); setLastFour(''); setCreditLimit(''); setClosingDay(''); setCardDueDay(''); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao cadastrar cartão.'); } finally { setBusy(false); } }

  return <main className="app-shell">
    <header className="page-header"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">◒</span><div><p className="eyebrow">Seu dinheiro, com clareza</p><h1 className="page-title">Painel financeiro</h1><p className="page-subtitle">Organize contas, cartões e compromissos em um só lugar.</p></div></div><div className="header-actions"><div className="segmented-control" aria-label="Filtrar por perfil">{([['ALL','Geral'],['PHYSICAL','Pessoal · PF'],['LEGAL','Empresa · PJ']] as const).map(([value,label])=><button key={value} type="button" className="segment-button" aria-pressed={filterEntity===value} onClick={()=>setFilterEntity(value)}>{label}</button>)}</div><button className="button button-secondary" type="button" onClick={()=>void signOut({callbackUrl:'/login'})}>Sair da conta</button></div></header>
    <nav className="section-nav" aria-label="Seções do financeiro">{([['overview','Visão geral'],['entries','Lançamentos'],['cards','Cartões'],['reports','Relatórios']] as const).map(([value,label])=><button key={value} className={`section-link ${tab===value?'section-link-active':''}`} type="button" aria-current={tab===value?'page':undefined} onClick={()=>setTab(value)}>{label}</button>)}</nav>
    {error && <p className="form-error" role="alert">{error}</p>}
    {tab==='overview' && <>
      <section className="summary-grid summary-grid-wide" aria-label="Resumo financeiro"><Summary title="Entradas pagas" value={income}/><Summary title="Despesas pagas" value={expenses}/><Summary title="Saldo realizado" value={balance}/><Summary title="Contas a pagar" value={due}/><Summary title="A receber" value={incoming}/></section>
      <div className="overview-columns"><section className="panel"><div className="panel-heading"><div><h2 className="panel-title">Despesas por categoria</h2><p className="panel-description">Distribuição dos lançamentos pagos.</p></div></div>{categories.length ? <div className="category-list">{categories.slice(0,7).map(([label,value])=><div className="category-row" key={label}><span>{label}</span><strong>{money.format(value)}</strong></div>)}</div> : <p className="panel-description">Adicione lançamentos para ver a distribuição.</p>}</section><section className="panel"><div className="panel-heading"><div><h2 className="panel-title">Próximos compromissos</h2><p className="panel-description">Contas em aberto e vencimentos.</p></div><button type="button" className="button button-secondary" onClick={()=>setTab('entries')}>Ver todos</button></div>{entries.filter(item=>item.status==='PENDING').slice(0,5).map(item=><div className="category-row" key={item.id}><span>{item.description}<small className="muted-block">Vencimento: {formatDate(item.dueDate)}</small></span><strong className={item.type==='EXPENSE'?'type-expense':'type-income'}>{money.format(item.amount)}</strong></div>)}{!entries.some(item=>item.status==='PENDING')&&<p className="panel-description">Nenhuma conta pendente.</p>}</section></div>
      <PurchaseSimulator currentMonthlyBalance={balance}/>
    </>}
    {tab==='entries' && <>
      <section className="panel" aria-labelledby="entry-form-title"><div className="panel-heading"><div><h2 className="panel-title" id="entry-form-title">{editing?'Editar lançamento':'Novo lançamento'}</h2><p className="panel-description">Registre entradas, despesas, vencimentos e pagamentos futuros.</p></div>{editing&&<button className="button button-secondary" type="button" onClick={resetForm}>Cancelar edição</button>}</div>
        <form className="form-grid form-grid-expanded" onSubmit={saveEntry}><Field label="Descrição"><input className="input" maxLength={120} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: aluguel, salário..." required/></Field><Field label="Valor total (R$)"><input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/></Field><Field label="Tipo"><select className="select" value={type} onChange={e=>setType(e.target.value as TransactionType)}><option value="EXPENSE">Despesa</option><option value="INCOME">Entrada</option></select></Field><Field label="Setor / perfil"><select className="select" value={entity} onChange={e=>setEntity(e.target.value as EntityType)}><option value="PHYSICAL">Pessoal · PF</option><option value="LEGAL">Empresa · PJ</option></select></Field><Field label="Categoria"><input className="input" maxLength={60} value={category} onChange={e=>setCategory(e.target.value)} placeholder="Moradia, saúde..."/></Field><Field label="Data do lançamento"><input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} required/></Field><Field label="Vencimento"><input className="input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></Field><Field label="Situação"><select className="select" value={status} onChange={e=>setStatus(e.target.value as 'PAID'|'PENDING')}><option value="PAID">Pago / recebido</option><option value="PENDING">Pendente</option></select></Field><Field label="Cartão"><select className="select" value={cardId} onChange={e=>setCardId(e.target.value)}><option value="">Sem cartão</option>{cards.map(card=><option key={card.id} value={card.id}>{card.name}{card.lastFour?` ···· ${card.lastFour}`:''}</option>)}</select></Field>{!editing&&<><Field label="Parcelas"><select className="select" value={installments} onChange={e=>setInstallments(e.target.value)}>{Array.from({length:60},(_,i)=><option key={i+1} value={i+1}>{i+1}x</option>)}</select></Field><Field label="Repetição"><select className="select" value={recurrence} onChange={e=>setRecurrence(e.target.value)}><option value="">Não se repete</option><option value="WEEKLY">Semanal · 12 ocorrências</option><option value="MONTHLY">Mensal · 12 ocorrências</option><option value="YEARLY">Anual · 12 ocorrências</option></select></Field></>}<button className="button button-primary" type="submit" disabled={busy}>{busy?'Salvando…':editing?'Salvar alterações':'＋ Adicionar'}</button></form>
      </section>
      <section className="panel"><div className="panel-heading"><div><h2 className="panel-title">Todos os lançamentos</h2><p className="panel-description">Edite, marque e acompanhe pagamentos e recebimentos.</p></div><button className="button button-secondary" onClick={()=>void refresh()} disabled={loading}>Atualizar</button></div>{loading?<p className="panel-description">Carregando…</p>:<EntryTable entries={filtered} onEdit={startEdit} onDelete={item=>void removeEntry(item)}/>}</section>
    </>}
    {tab==='cards'&&<><section className="panel"><div className="panel-heading"><div><h2 className="panel-title">Cadastrar cartão</h2><p className="panel-description">Informe apenas os últimos quatro dígitos. Não armazene dados de segurança.</p></div></div><form className="form-grid form-grid-expanded" onSubmit={saveCard}><Field label="Apelido"><input className="input" value={cardName} onChange={e=>setCardName(e.target.value)} placeholder="Ex.: Cartão principal" maxLength={60} required/></Field><Field label="Bandeira"><input className="input" value={cardBrand} onChange={e=>setCardBrand(e.target.value)} placeholder="Visa, Mastercard..." maxLength={30}/></Field><Field label="Últimos 4 dígitos"><input className="input" value={lastFour} onChange={e=>setLastFour(e.target.value.replace(/\D/g,'').slice(0,4))} inputMode="numeric" maxLength={4} placeholder="0000"/></Field><Field label="Limite (R$)"><input className="input" type="number" min="0" step="0.01" value={creditLimit} onChange={e=>setCreditLimit(e.target.value)}/></Field><Field label="Dia de fechamento"><input className="input" type="number" min="1" max="31" value={closingDay} onChange={e=>setClosingDay(e.target.value)}/></Field><Field label="Dia de vencimento"><input className="input" type="number" min="1" max="31" value={cardDueDay} onChange={e=>setCardDueDay(e.target.value)}/></Field><button className="button button-primary" disabled={busy}>＋ Cadastrar cartão</button></form></section><section className="panel"><h2 className="panel-title">Meus cartões</h2>{cards.length?<div className="card-grid">{cards.map(card=><article className="payment-card" key={card.id}><span className="eyebrow">{card.brand||'Cartão'}</span><h3>{card.name}</h3><p>{card.lastFour?`Final ${card.lastFour}`:'Final não informado'}</p><strong>{card.creditLimit?money.format(card.creditLimit):'Limite não informado'}</strong><small>Fecha dia {card.closingDay||'—'} · vence dia {card.dueDay||'—'}</small></article>)}</div>:<p className="panel-description">Nenhum cartão cadastrado.</p>}</section></>}
    {tab==='reports'&&<section className="panel report-panel"><div className="panel-heading"><div><h2 className="panel-title">Relatório financeiro</h2><p className="panel-description">Resumo e movimentações do perfil selecionado para conferência.</p></div><button className="button button-primary no-print" type="button" onClick={()=>window.print()}>Imprimir / salvar PDF</button></div><div className="report-heading"><h1>Relatório financeiro · {filterEntity==='ALL'?'Geral':filterEntity==='PHYSICAL'?'Pessoal (PF)':'Empresa (PJ)'}</h1><p>Gerado em {new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date())}</p></div><div className="summary-grid"><Summary title="Entradas pagas" value={income}/><Summary title="Despesas pagas" value={expenses}/><Summary title="Saldo realizado" value={balance}/></div><h3>Movimentações detalhadas</h3><EntryTable entries={filtered} onEdit={()=>{}} onDelete={()=>{}} readOnly/></section>}
  </main>;
}

function Summary({title,value}:{title:string;value:number}) { return <article className="summary-card"><span className="summary-label">{title}</span><strong className="summary-value">{money.format(value)}</strong></article>; }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="field"><span className="field-label">{label}</span>{children}</label>; }
function EntryTable({entries,onEdit,onDelete,readOnly=false}:{entries:Entry[];onEdit:(entry:Entry)=>void;onDelete:(entry:Entry)=>void;readOnly?:boolean}) { return <div className="table-wrap"><table className="data-table"><thead><tr><th>Descrição</th><th>Categoria / cartão</th><th>Setor</th><th>Data / vencimento</th><th>Situação</th><th className="table-number">Valor</th>{!readOnly&&<th>Ações</th>}</tr></thead><tbody>{entries.length?entries.map(item=><tr key={item.id}><td>{item.description}{item.installmentNumber&&<small className="muted-block">Parcela {item.installmentNumber}/{item.installmentTotal}</small>}{item.recurrence&&<small className="muted-block">Recorrente</small>}</td><td>{item.category||'Geral'}{item.card&&<small className="muted-block">{item.card.name}</small>}</td><td>{item.entity==='PHYSICAL'?'Pessoal':'Empresa'}</td><td>{formatDate(item.date)}<small className="muted-block">Vence: {formatDate(item.dueDate)}</small></td><td><span className={`status-pill ${item.status==='PAID'?'status-paid':'status-pending'}`}>{item.status==='PAID'?'Pago':'Pendente'}</span></td><td className={`table-number ${item.type==='INCOME'?'type-income':'type-expense'}`}>{item.type==='INCOME'?'+':'−'}{money.format(item.amount)}</td>{!readOnly&&<td><div className="row-actions"><button className="button button-secondary button-compact" type="button" onClick={()=>onEdit(item)}>Editar</button><button className="button button-danger button-compact" type="button" onClick={()=>onDelete(item)}>Excluir</button></div></td>}</tr>):<tr><td className="empty-state" colSpan={readOnly?6:7}>Nenhum lançamento para este filtro.</td></tr>}</tbody></table></div>; }
