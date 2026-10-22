'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EntityType, TransactionType } from '@/lib/types';

type Card = {
  id: string;
  name: string;
  paymentType: 'CREDIT' | 'DEBIT';
  brand?: string | null;
  lastFour?: string | null;
  creditLimit?: number | null;
  closingDay?: number | null;
  dueDay?: number | null;
};

type Account = {
  id: string;
  name: string;
  institution: string;
  accountType: string;
  entity: EntityType;
  initialBalance: number;
};

type Category = {
  id: string;
  name: string;
  description: string;
  entity: 'ALL' | EntityType;
};

type Entry = {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  entity: EntityType;
  category: string;
  date: string;
  dueDate?: string | null;
  status: 'PAID' | 'PENDING';
  recurrence?: string | null;
  recurrenceGroup?: string | null;
  recurrenceEndDate?: string | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  cardId?: string | null;
  card?: Card | null;
  accountId?: string | null;
  purpose?: string;
  autoDebit?: boolean;
  isSubscription?: boolean;
  notes?: string | null;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER' | 'BLOCKED';
  permissions: string;
};
type ServerBackupFile = { name: string; modifiedAt: string };
type FinanceInstance = { id: string; name: string; entity: 'ALL' | EntityType; ownerId: string; owner: { name: string }; permissions: string[] };
type FinanceMemberView = { id: string; name: string; email: string; permissions: string[] };
type FinancePermission = 'view' | 'create' | 'edit' | 'delete';
type Theme = 'light' | 'dark';

type ReportModel = { name: string; html: string; css: string };
type Tab = 'overview' | 'entries' | 'cards' | 'institutions' | 'categories' | 'reports' | 'settings';
type SortKey = 'description' | 'category' | 'entity' | 'date' | 'dueDate' | 'status' | 'amount';
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : '—';
const isoToday = new Date().toISOString().slice(0, 10);

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

function renderReportModel(
  model: { html: string; css: string },
  entries: Entry[],
  entity: 'ALL' | EntityType,
  income: number,
  expenses: number,
  balance: number,
) {
  const transactionsTable = entries.map(item => `<tr><td>${escapeHtml(formatDate(item.date))}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.category)}</td><td>${item.type === 'INCOME' ? 'Entrada' : 'Despesa'}</td><td>${money.format(item.amount)}</td><td>${item.status === 'PAID' ? 'Pago' : 'Pendente'}</td></tr>`).join('');
  const values: Record<string, string> = {
    reportTitle: 'Relatório financeiro',
    generatedAt: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
    entity: entity === 'ALL' ? 'Geral' : entity === 'PHYSICAL' ? 'Pessoal (PF)' : 'Empresa (PJ)',
    totalIncome: money.format(income),
    totalExpenses: money.format(expenses),
    balance: money.format(balance),
    transactionsTable,
    styles: model.css,
  };
  const html = model.html.replace(/\{\{([a-zA-Z]+)\}\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? values[key] : placeholder,
  );
  return html;
}

async function readJson(response: Response) {
  const body = await response.text();
  if (!body) throw new Error(`O servidor retornou uma resposta vazia (HTTP ${response.status}).`);
  try { return JSON.parse(body) as any; }
  catch { throw new Error(`O servidor retornou uma resposta inválida (HTTP ${response.status}).`); }
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [tab, setTab] = useState<Tab>('overview');
  const [financeInstances, setFinanceInstances] = useState<FinanceInstance[]>([]);
  const [activeFinanceId, setActiveFinanceId] = useState('');
  const [newFinanceName, setNewFinanceName] = useState('');
  const [newFinanceEntity, setNewFinanceEntity] = useState<EntityType>('PHYSICAL');
  const [financeMembers, setFinanceMembers] = useState<FinanceMemberView[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermissions, setSharePermissions] = useState<FinancePermission[]>(['view']);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [reportModels, setReportModels] = useState<ReportModel[]>([]);
  const [reportModelName, setReportModelName] = useState('');
  const [reportPreview, setReportPreview] = useState('');
  const [filterEntity, setFilterEntity] = useState<'ALL' | EntityType>('ALL');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allCategories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [backupTypes, setBackupTypes] = useState<string[]>(['transactions', 'cards', 'accounts', 'categories', 'shoppingLists']);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [backupInterval, setBackupInterval] = useState('7');
  const [backupRetention, setBackupRetention] = useState('5');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupSettingsSaved, setBackupSettingsSaved] = useState(false);
  const [serverBackupFiles, setServerBackupFiles] = useState<ServerBackupFile[]>([]);
  const [selectedServerBackup, setSelectedServerBackup] = useState('');
  const [backupServerPath, setBackupServerPath] = useState('/bkp');
  const [editing, setEditing] = useState<Entry | null>(null);
  const [editingSeriesGroup, setEditingSeriesGroup] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [entity, setEntity] = useState<EntityType>('PHYSICAL');
  const [category, setCategory] = useState('Geral');
  const [date, setDate] = useState(isoToday);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'PAID' | 'PENDING'>('PAID');
  const [installments, setInstallments] = useState('1');
  const [recurrence, setRecurrence] = useState('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [cardId, setCardId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [purpose, setPurpose] = useState('STANDARD');
  const [autoDebit, setAutoDebit] = useState(false);
  const [isSubscription, setIsSubscription] = useState(false);
  const [notes, setNotes] = useState('');

  const [cardName, setCardName] = useState('');
  const [cardBrand, setCardBrand] = useState('');
  const [lastFour, setLastFour] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [cardDueDay, setCardDueDay] = useState('');
  const [cardPaymentType, setCardPaymentType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [accountName, setAccountName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [accountType, setAccountType] = useState('CHECKING');
  const [accountEntity, setAccountEntity] = useState<EntityType>('PHYSICAL');
  const [initialBalance, setInitialBalance] = useState('0');
  const [monthFilter, setMonthFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [categoryEntity, setCategoryEntity] = useState<'ALL' | EntityType>('ALL');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categorySearch, setCategorySearch] = useState('');
  const [categorySort, setCategorySort] = useState<'name' | 'description'>('name');
  const [categorySortDirection, setCategorySortDirection] = useState<'asc' | 'desc'>('asc');
  const [quickCategoryName, setQuickCategoryName] = useState('');
  const [quickCategoryDescription, setQuickCategoryDescription] = useState('');
  const [showQuickCategory, setShowQuickCategory] = useState(false);

  useEffect(() => {
    const updateClock = () => setCurrentTime(new Date());
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('finance-theme');
    const nextTheme: Theme = savedTheme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    localStorage.setItem('finance-theme', nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  const categories = useMemo(() => {
    const matching = allCategories.filter(item => item.entity === 'ALL' || item.entity === entity).sort((a, b) => a.entity === entity ? 1 : b.entity === entity ? -1 : 0);
    return Array.from(new Map(matching.map(item => [item.name.toLocaleLowerCase('pt-BR'), item])).values());
  }, [allCategories, entity]);
  const activeFinance = financeInstances.find((finance) => finance.id === activeFinanceId);
  const canCreate = activeFinance?.permissions.includes('create') ?? false;
  const canEdit = activeFinance?.permissions.includes('edit') ?? false;
  const canDelete = activeFinance?.permissions.includes('delete') ?? false;

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const financeResponse = await fetch('/api/finances');
      const financeResult = await readJson(financeResponse);
      const availableFinances = financeResult as FinanceInstance[];
      if (!financeResponse.ok) throw new Error(financeResult.error || 'Não foi possível carregar as instâncias financeiras.');
      if (!availableFinances.length) throw new Error('Crie uma instância financeira em Configurações para começar.');
      const savedFinanceId = localStorage.getItem('active-finance-id');
      const activeFinance = availableFinances.find((finance) => finance.id === savedFinanceId) || availableFinances[0];
      if (!activeFinance) throw new Error('Nenhuma instância financeira disponível.');
      const activation = await fetch('/api/finances/active', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ financeId: activeFinance.id }) });
      const activationResult = await readJson(activation);
      if (!activation.ok) throw new Error(activationResult.error || 'Não foi possível selecionar a instância financeira.');
      localStorage.setItem('active-finance-id', activeFinance.id);
      setFinanceInstances(availableFinances);
      setActiveFinanceId(activeFinance.id);
      setEntity(activeFinance.entity === 'LEGAL' ? 'LEGAL' : 'PHYSICAL');
      setCategoryEntity(activeFinance.entity === 'ALL' ? 'ALL' : activeFinance.entity);
      setFilterEntity('ALL');
      const responses = await Promise.all([fetch('/api/transactions'), fetch('/api/cards'), fetch('/api/categories'), fetch('/api/institutions')]);
      const data = await Promise.all(responses.map(readJson));
      const failedIndex = responses.findIndex(response => !response.ok);
      if (failedIndex >= 0) throw new Error(data[failedIndex].error || 'Não foi possível carregar os dados.');
      setEntries(data[0]); setCards(data[1]); setCategories(data[2]); setAccounts(data[3]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao carregar dados.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (activeFinance && activeFinance.ownerId === session?.user.id) void loadFinanceMembers(activeFinance.id);
    else setFinanceMembers([]);
  }, [activeFinanceId, financeInstances, session?.user.id]);

  const visibleEntries = useMemo(() => {
    const query = descriptionFilter.trim().toLocaleLowerCase('pt-BR');
    const filtered = entries.filter(item => {
      const day = item.date.slice(0, 10);
      return (filterEntity === 'ALL' || item.entity === filterEntity)
        && (!monthFilter || day.slice(0, 7) === monthFilter)
        && (!fromDate || day >= fromDate)
        && (!toDate || day <= toDate)
        && (!statusFilter || item.status === statusFilter)
        && (!categoryFilter || item.category === categoryFilter)
        && (!query || item.description.toLocaleLowerCase('pt-BR').includes(query));
    });
    const compare = (a: Entry, b: Entry) => {
      const values: Record<SortKey, [string | number, string | number]> = {
        description: [a.description.toLocaleLowerCase('pt-BR'), b.description.toLocaleLowerCase('pt-BR')],
        category: [a.category.toLocaleLowerCase('pt-BR'), b.category.toLocaleLowerCase('pt-BR')],
        entity: [a.entity, b.entity], date: [a.date, b.date], dueDate: [a.dueDate || '', b.dueDate || ''],
        status: [a.status, b.status], amount: [a.amount, b.amount],
      };
      const [left, right] = values[sortKey];
      const order = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right), 'pt-BR');
      return sortDirection === 'asc' ? order : -order;
    };
    return filtered.sort(compare);
  }, [entries, filterEntity, monthFilter, fromDate, toDate, statusFilter, categoryFilter, descriptionFilter, sortKey, sortDirection]);
  const paid = visibleEntries.filter(item => item.status === 'PAID');
  const income = paid.filter(item => item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0);
  const expenses = paid.filter(item => item.type === 'EXPENSE' && item.purpose !== 'CARD_PAYMENT').reduce((sum, item) => sum + item.amount, 0);
  const due = visibleEntries.filter(item => item.status === 'PENDING' && item.type === 'EXPENSE').reduce((sum, item) => sum + item.amount, 0);
  const incoming = visibleEntries.filter(item => item.status === 'PENDING' && item.type === 'INCOME').reduce((sum, item) => sum + item.amount, 0);
  const balance = income - expenses;
  const profileEntries = entries.filter((item) => filterEntity === 'ALL' || item.entity === filterEntity);
  const filterCategories = allCategories.filter((item) => filterEntity === 'ALL' || item.entity === 'ALL' || item.entity === filterEntity);
  const categoryOptions = useMemo(() => Array.from(new Set([...filterCategories.map((item) => item.name), ...profileEntries.map((item) => item.category).filter(Boolean)])).sort((a, b) => a.localeCompare(b, 'pt-BR')), [filterCategories, profileEntries]);
  const expenseCategories = Object.entries(paid.filter(item => item.type === 'EXPENSE' && item.purpose !== 'CARD_PAYMENT').reduce<Record<string, number>>((map, item) => { map[item.category || 'Geral'] = (map[item.category || 'Geral'] || 0) + item.amount; return map; }, {})).sort((a, b) => b[1] - a[1]);
  const visibleCategories = allCategories.filter(item => (categoryEntity === 'ALL' || item.entity === 'ALL' || item.entity === categoryEntity) && `${item.name} ${item.description}`.toLocaleLowerCase('pt-BR').includes(categorySearch.toLocaleLowerCase('pt-BR'))).sort((a, b) => {
    const order = a[categorySort].localeCompare(b[categorySort], 'pt-BR');
    return categorySortDirection === 'asc' ? order : -order;
  });

  function sortBy(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  }

  function sortCategories(key: 'name' | 'description') {
    if (categorySort === key) {
      setCategorySortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setCategorySort(key);
    setCategorySortDirection('asc');
  }

  const entryCategories = categories.filter((item) => item.entity === 'ALL' || item.entity === entity);
  const accountBalances = accounts.map((account) => {
    const movement = entries
      .filter((item) => item.accountId === account.id && item.status === 'PAID')
      .reduce((total, item) => total + (item.type === 'INCOME' ? item.amount : -item.amount), 0);
    return { ...account, balance: account.initialBalance + movement };
  });

  function resetForm() {
    setDescription('');
    setAmount('');
    setCategory('Geral');
    setDate(isoToday);
    setDueDate('');
    setStatus('PAID');
    setInstallments('1');
    setRecurrence('');
    setRecurrenceEndDate('');
    setCardId('');
    setAccountId('');
    setPurpose('STANDARD');
    setAutoDebit(false);
    setIsSubscription(false);
    setNotes('');
    setEditing(null);
    setEditingSeriesGroup(null);
    setEntryModalOpen(false);
  }

  async function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const saveGroup = submitter?.value === 'group' && Boolean(editing?.recurrenceGroup);
      const url = saveGroup
        ? `/api/transactions/series/${editing?.recurrenceGroup}`
        : editing
          ? `/api/transactions/${editing.id}`
          : '/api/transactions';
      const payload = {
        description,
        amount,
        type,
        entity,
        category: category || 'Geral',
        date,
        dueDate: dueDate || null,
        status,
        installments: editing ? 1 : installments,
        recurrence: editing ? null : recurrence || null,
        recurrenceEndDate: recurrence ? recurrenceEndDate : null,
        cardId: cardId || null,
        accountId: accountId || null,
        purpose,
        autoDebit,
        isSubscription,
        notes,
      };
      const response = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.error || 'N\u00e3o foi poss\u00edvel salvar.');

      resetForm();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar lan\u00e7amento.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(item: Entry) {
    setEditing(item);
    setEditingSeriesGroup(null);
    setEntryModalOpen(true);
    setDescription(item.description.replace(/ \(\d+\/\d+\)$/, ''));
    setAmount(String(item.amount));
    setType(item.type);
    setEntity(item.entity);
    setCategory(item.category);
    setDate(item.date.slice(0, 10));
    setDueDate(item.dueDate?.slice(0, 10) || '');
    setStatus(item.status);
    setCardId(item.cardId || '');
    setAccountId(item.accountId || '');
    setPurpose(item.purpose || 'STANDARD');
    setAutoDebit(Boolean(item.autoDebit));
    setIsSubscription(Boolean(item.isSubscription));
    setNotes(item.notes || '');
    setInstallments('1');
    setRecurrence('');
    setRecurrenceEndDate('');
    setTab('entries');
  }

  async function removeEntry(item: Entry, group = false) {
    const url = group && item.recurrenceGroup
      ? `/api/transactions/series/${item.recurrenceGroup}`
      : `/api/transactions/${item.id}`;
    const response = await fetch(url, { method: 'DELETE' });
    const result = await readJson(response);
    if (!response.ok) {
      setError(result.error || 'Erro ao excluir.');
      return;
    }
    setDeleteTarget(null);
    await refresh();
  }

  async function changeEntryStatus(item: Entry) {
    const nextStatus = item.status === 'PAID' ? 'PENDING' : 'PAID';
    const response = await fetch(`/api/transactions/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const result = await readJson(response);
    if (!response.ok) {
      setError(result.error || 'Erro ao atualizar situa\u00e7\u00e3o.');
      return;
    }
    await refresh();
  }

  async function saveCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(editingCard ? `/api/cards/${editingCard.id}` : '/api/cards', {
        method: editingCard ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cardName, paymentType: cardPaymentType, brand: cardBrand, lastFour, creditLimit, closingDay, dueDay: cardDueDay }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.error || 'Erro ao cadastrar cart\u00e3o.');
      setCardName('');
      setCardBrand('');
      setLastFour('');
      setCreditLimit('');
      setClosingDay('');
      setCardDueDay('');
      setEditingCard(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar cart\u00e3o.');
    } finally {
      setBusy(false);
    }
  }

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(editingAccount ? `/api/institutions/${editingAccount.id}` : '/api/institutions', {
        method: editingAccount ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountName, institution: institutionName, accountType, entity: accountEntity, initialBalance }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.error || 'Erro ao salvar conta.');
      setAccountName('');
      setInstitutionName('');
      setInitialBalance('0');
      setEditingAccount(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar conta.');
    } finally {
      setBusy(false);
    }
  }

  async function createQuickCategory() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: quickCategoryName, description: quickCategoryDescription, entity }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.error || 'Erro ao criar categoria.');
      setCategory(result.name);
      setQuickCategoryName('');
      setQuickCategoryDescription('');
      setShowQuickCategory(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao criar categoria.');
    } finally {
      setBusy(false);
    }
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories', {
        method: editingCategory ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName, description: categoryDescription, entity: categoryEntity }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.error || 'Erro ao salvar categoria.');
      setCategoryName('');
      setCategoryDescription('');
      setCategoryEntity('ALL');
      setEditingCategory(null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar categoria.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(item: Category) {
    if (!window.confirm(`Excluir a categoria "${item.name}"? Os lan\u00e7amentos antigos manter\u00e3o esse nome.`)) return;
    const response = await fetch(`/api/categories/${item.id}`, { method: 'DELETE' });
    const result = await readJson(response);
    if (!response.ok) {
      setError(result.error || 'Erro ao excluir categoria.');
      return;
    }
    await refresh();
  }

  async function loadAdminUsers() {
    const response = await fetch('/api/admin/users');
    const result = await readJson(response);
    if (!response.ok) {
      setError(result.error || 'Voc\u00ea n\u00e3o tem acesso \u00e0s configura\u00e7\u00f5es de usu\u00e1rios.');
      return;
    }
    setAdminUsers(result);
  }

  async function createFinance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/finances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFinanceName, entity: newFinanceEntity }) });
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.error || 'Não foi possível criar a instância financeira.');
      localStorage.setItem('active-finance-id', result.id);
      setNewFinanceName('');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao criar a instância financeira.'); }
    finally { setBusy(false); }
  }

  async function loadFinanceMembers(financeId = activeFinanceId) {
    if (!financeId) return;
    const response = await fetch(`/api/finances/${financeId}/members`);
    const result = await readJson(response);
    if (!response.ok) { setFinanceMembers([]); return; }
    setFinanceMembers(result as FinanceMemberView[]);
  }

  async function shareFinance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeFinanceId) return;
    const response = await fetch(`/api/finances/${activeFinanceId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: shareEmail, permissions: sharePermissions }) });
    const result = await readJson(response);
    if (!response.ok) { setError(result.error || 'Não foi possível compartilhar esta instância.'); return; }
    setShareEmail(''); await loadFinanceMembers(); await refresh();
  }

  async function removeFinanceMember(userId: string) {
    if (!activeFinanceId || !window.confirm('Remover o acesso desta pessoa à instância financeira?')) return;
    const response = await fetch(`/api/finances/${activeFinanceId}/members`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    const result = await readJson(response);
    if (!response.ok) { setError(result.error || 'Não foi possível remover o acesso.'); return; }
    await loadFinanceMembers();
  }

  async function saveAdminUser(user: AdminUser) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: user.role, permissions: JSON.parse(user.permissions || '[]') }),
    });
    const result = await readJson(response);
    if (!response.ok) {
      setError(result.error || 'N\u00e3o foi poss\u00edvel salvar as permiss\u00f5es.');
      return;
    }
    await loadAdminUsers();
  }

  async function createBackup(download = true) {
    const response = await fetch('/api/backup');
    const snapshot = await readJson(response);
    if (!response.ok) throw new Error(snapshot.error || 'Não foi possível criar o backup.');
    snapshot.data = Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => backupTypes.includes(key)));
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    if (download) {
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `meu-financeiro-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
    }
    return blob;
  }

  async function restoreBackup(snapshotOverride?: any) {
    if (!restoreFile && !snapshotOverride) return;
    if (!window.confirm('A restauração substituirá os dados selecionados da sua conta. Deseja continuar?')) return;
    setBusy(true); setBackupMessage('');
    try {
      const snapshot = snapshotOverride || JSON.parse(await restoreFile!.text());
      const selected = backupTypes.filter((key) => Array.isArray(snapshot?.data?.[key]));
      if (!selected.length) throw new Error('O backup não contém nenhum dos tipos de dados selecionados.');
      const response = await fetch('/api/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...snapshot, selected }) });
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.error || 'Não foi possível restaurar o backup.');
      if (result.financeId) localStorage.setItem('active-finance-id', result.financeId);
      setBackupMessage(result.financeCreated ? 'Backup restaurado e instância financeira criada.' : 'Backup restaurado.');
      setRestoreFile(null); await refresh();
    } catch (cause) { setBackupMessage(cause instanceof Error ? cause.message : 'Arquivo inválido.'); }
    finally { setBusy(false); }
  }

  async function loadServerBackupFiles() {
    setBackupMessage('');
    try {
      const response = await fetch(`/api/backup/files?directory=${encodeURIComponent(backupServerPath)}`);
      const result = await readJson(response);
      if (!response.ok) throw new Error(result.error || 'Não foi possível listar os backups.');
      const files = result as ServerBackupFile[];
      setServerBackupFiles(files);
      setSelectedServerBackup((current) => files.some((file) => file.name === current) ? current : files[0]?.name || '');
      if (!files.length) setBackupMessage('Não há backups automáticos nessa pasta para sua conta.');
    } catch (cause) { setBackupMessage(cause instanceof Error ? cause.message : 'Não foi possível listar os backups.'); }
  }

  async function restoreServerBackup() {
    if (!selectedServerBackup) return;
    try {
      const response = await fetch(`/api/backup/files/${encodeURIComponent(selectedServerBackup)}?directory=${encodeURIComponent(backupServerPath)}`);
      const snapshot = await readJson(response);
      if (!response.ok) throw new Error(snapshot.error || 'Não foi possível abrir o backup selecionado.');
      await restoreBackup(snapshot);
    } catch (cause) { setBackupMessage(cause instanceof Error ? cause.message : 'Não foi possível restaurar o backup.'); }
  }

  async function saveServerBackup() {
    const blob = await createBackup(false);
    const response = await fetch('/api/backup', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ directory: backupServerPath, retention: backupRetention, snapshot: JSON.parse(await blob.text()) }) });
    const result = await readJson(response);
    if (!response.ok) throw new Error(result.error || 'Could not write backup to server.');
    setBackupMessage(`Backup saved to ${result.directory}/${result.fileName}`);
  }

  function saveBackupSettings() {
    if (!backupTypes.length) {
      setBackupMessage('Selecione ao menos um tipo de dado para incluir no backup.');
      return;
    }
    if (!backupServerPath.trim() || !backupServerPath.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(backupServerPath)) {
      setBackupMessage('Informe um caminho absoluto, como /bkp.');
      return;
    }
    localStorage.setItem('finance-backup-settings', JSON.stringify({ interval: backupInterval, retention: Math.max(1, Math.min(100, Number(backupRetention) || 1)), path: backupServerPath.trim(), types: backupTypes }));
    setBackupServerPath(backupServerPath.trim());
    setBackupSettingsSaved(true);
    setBackupMessage('Configuração do backup automático salva.');
  }

  useEffect(() => {
    if (!backupSettingsSaved || !backupServerPath || !backupInterval) return;
    const key = 'finance-backup-last-run';
    const run = async () => {
      const previous = Number(localStorage.getItem(key) || 0);
      if (Date.now() - previous < Number(backupInterval) * 86400000) return;
      try {
        await saveServerBackup();
        localStorage.setItem(key, String(Date.now()));
      } catch (cause) { setBackupMessage(cause instanceof Error ? cause.message : 'Automatic backup failed.'); }
    };
    void run(); const timer = window.setInterval(() => void run(), 60000);
    return () => window.clearInterval(timer);
  }, [backupSettingsSaved, backupServerPath, backupInterval, backupRetention, backupTypes]);

  useEffect(() => {
    const saved = localStorage.getItem('finance-backup-settings');
    if (saved) try { const settings = JSON.parse(saved); if (['1', '7', '30'].includes(settings.interval)) setBackupInterval(settings.interval); if (Number.isInteger(settings.retention) && settings.retention >= 1 && settings.retention <= 100) setBackupRetention(String(settings.retention)); if (typeof settings.path === 'string') setBackupServerPath(settings.path); if (Array.isArray(settings.types)) setBackupTypes(settings.types.filter((item: string) => ['transactions', 'cards', 'accounts', 'categories', 'shoppingLists'].includes(item))); setBackupSettingsSaved(true); } catch { /* Ignore invalid local preferences. */ }
  }, []);

  async function loadReportModels(): Promise<ReportModel[]> {
    const response = await fetch('/api/report-templates');
    const result = await readJson(response);
    if (!response.ok) {
      setError(result.error || 'Não foi possível carregar os modelos.');
      return [];
    }

    const models = result as ReportModel[];
    setReportModels(models);
    setReportModelName((current) => current || models[0]?.name || '');
    return models;
  }

  async function openReportPreview(selectedName = reportModelName) {
    if (!selectedName) {
      setReportPreview('');
      return;
    }
    const models = reportModels.length ? reportModels : await loadReportModels();
    const model = models.find((item) => item.name === selectedName);
    if (model) {
      setReportPreview(renderReportModel(model, visibleEntries, filterEntity, income, expenses, balance));
    }
  }

  function editCard(card: Card) {
    setEditingCard(card);
    setCardName(card.name);
    setCardBrand(card.brand || '');
    setLastFour(card.lastFour || '');
    setCreditLimit(card.creditLimit == null ? '' : String(card.creditLimit));
    setClosingDay(card.closingDay == null ? '' : String(card.closingDay));
    setCardDueDay(card.dueDay == null ? '' : String(card.dueDay));
    setCardPaymentType(card.paymentType);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteCard(card: Card) {
    if (!window.confirm(`Excluir o cartão "${card.name}"? Os lançamentos antigos serão mantidos sem o vínculo com ele.`)) return;
    const response = await fetch(`/api/cards/${card.id}`, { method: 'DELETE' });
    const result = await readJson(response);
    if (!response.ok) { setError(result.error || 'Não foi possível excluir o cartão.'); return; }
    await refresh();
  }

  function editAccount(account: Account) {
    setEditingAccount(account);
    setAccountName(account.name);
    setInstitutionName(account.institution);
    setAccountType(account.accountType);
    setAccountEntity(account.entity);
    setInitialBalance(String(account.initialBalance));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteAccount(account: Account) {
    if (!window.confirm(`Excluir a conta "${account.name}"? O histórico de lançamentos será preservado.`)) return;
    const response = await fetch(`/api/institutions/${account.id}`, { method: 'DELETE' });
    const result = await readJson(response);
    if (!response.ok) { setError(result.error || 'Não foi possível excluir a conta.'); return; }
    await refresh();
  }

  const hasViewPermission = session?.user.role === 'ADMIN'
    || session?.user.permissions.includes('view')
    || financeInstances.some((finance) => finance.permissions.includes('view'));

  if (session?.user && !hasViewPermission) {
    return (
  <main className="app-shell access-blocked">
    <section className="panel">
      <h1 className="panel-title">Acesso aguardando liberação</h1>
      <p className="panel-description">Sua conta foi criada, mas ainda não recebeu permissão para visualizar o financeiro. Peça ao administrador para liberar seu acesso.</p>
      <button className="button button-secondary" type="button" onClick={() => void signOut({ callbackUrl: '/login' })}>Sair da conta</button>
      </section>
    </main>
  );
  }

  return (
  <main className="app-shell">
    <header className="page-header">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">MF</span>
        <div>
          <p className="eyebrow">Seu dinheiro, com clareza</p>
          <h1 className="page-title">Painel financeiro</h1>
          <p className="page-subtitle">Organize contas, cartões e compromissos em um só lugar.</p>
          </div>
        </div>
      <div className="header-actions">
        <div className="dashboard-clock" aria-label="Data e hora atuais">
          <span>Agora</span>
          <strong>{currentTime ? new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(currentTime) : '--'}</strong>
          <time>{currentTime ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(currentTime) : '--:--:--'}</time>
        </div>
        <label className="finance-switcher"><span>Instancia financeira</span><select className="select" value={activeFinanceId} onChange={(event) => { localStorage.setItem('active-finance-id', event.target.value); setActiveFinanceId(event.target.value); void refresh(); }}><option value="" disabled>Selecione uma instancia</option>{financeInstances.map((finance) => <option key={finance.id} value={finance.id}>{finance.name} &middot; {finance.entity === 'LEGAL' ? 'PJ' : finance.entity === 'ALL' ? 'Geral' : 'PF'}{finance.ownerId !== session?.user.id ? ` &middot; ${finance.owner.name}` : ''}</option>)}</select></label>
        <label className="theme-switcher"><span>Tema</span><select className="select" aria-label="Tema da interface" value={theme} onChange={(event) => changeTheme(event.target.value as Theme)}><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
        <button className="button button-secondary header-signout" type="button" onClick={() => void signOut({ callbackUrl: '/login' })}>Sair da conta</button>
      </div>
    </header>

  {/* Menus agrupados por área para facilitar a navegação. */}
  <nav className="section-nav" aria-label="Seções do financeiro">
    {([['overview', 'Visão geral'], ['entries', 'Lançamentos'], ['cards', 'Cartões'], ['institutions', 'Bancos e contas'], ['categories', 'Categorias'], ['reports', 'Relatórios']] as const).map(([value, label]) => (
    <button key={value} className={`section-link ${tab === value ? 'section-link-active' : ''}`} type="button"
    aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)}>{label}</button>
  ))}
  <Link className="section-link" href="/dashboard/shopping">Planeje antes de comprar</Link>
  <button className={`section-link ${tab === 'settings' ? 'section-link-active' : ''}`} type="button"
  onClick={() => { setTab('settings'); if (session?.user.role === 'ADMIN') void loadAdminUsers(); }}>Configurações</button>
  </nav>

  {error && <p className="form-error" role="alert">{error}</p>}
  {(tab === 'overview' || tab === 'entries' || tab === 'reports') && (
  <FilterPanel month={monthFilter} setMonth={setMonthFilter} from={fromDate} setFrom={setFromDate}
  to={toDate} setTo={setToDate} status={statusFilter} setStatus={setStatusFilter}
  category={categoryFilter} setCategory={setCategoryFilter} categories={categoryOptions}
  description={descriptionFilter} setDescription={setDescriptionFilter}
  onClear={() => { setMonthFilter(''); setFromDate(''); setToDate(''); setStatusFilter(''); setCategoryFilter(''); setDescriptionFilter(''); }} />
  )}

  {tab === 'overview' && <>
  <section className="summary-grid summary-grid-wide" aria-label="Resumo financeiro">
    <Summary title="Entradas pagas" value={income} />
    <Summary title="Despesas pagas" value={expenses} />
    <Summary title="Saldo realizado" value={balance} />
    <Summary title="Contas a pagar" value={due} />
    <Summary title="A receber" value={incoming} />
    </section>
  {/* A lista simulada fica acima do gráfico e não altera o extrato até a confirmação. */}
  <FinancialCharts entries={visibleEntries} />
  <div className="overview-columns">
    <section className="panel">
      <h2 className="panel-title">Despesas por categoria</h2>
      {expenseCategories.length ? expenseCategories.slice(0, 7).map(([label, value]) => <div className="category-row" key={label}>
        <span>{label}</span>
        <strong>{money.format(value)}</strong>
        </div>) : <p className="panel-description">Nenhum lançamento neste filtro.</p>}
      </section>
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2 className="panel-title">Próximos compromissos</h2>
          <p className="panel-description">Contas pendentes no período selecionado.</p>
          </div>
        <button className="button button-secondary" type="button" onClick={() => setTab('entries')}>Ver todos</button>
        </div>
      {visibleEntries.filter((item) => item.status === 'PENDING').slice(0, 5).map((item) => <div className="category-row" key={item.id}>
        <span>{item.description}<small className="muted-block">Vencimento: {formatDate(item.dueDate)}</small>
          </span>
        <strong>{money.format(item.amount)}</strong>
        </div>)}
      </section>
    </div>
  </>}

  {tab === 'entries' && <>
  <section className="panel category-shortcuts">
    <div className="panel-heading">
      <div>
        <h2 className="panel-title">Categorias do perfil selecionado</h2>
        <p className="panel-description">No modo Geral são exibidas todas; em PF ou PJ, somente as categorias daquele perfil.</p>
        </div>
      <button className="button button-secondary" type="button" onClick={() => setTab('categories')}>Gerenciar categorias</button>
      </div>
    <div className="category-chip-list">{categories.filter((item) => item.entity === 'ALL' || item.entity === entity).map((item) => <button className="category-chip" type="button" key={item.id} onClick={() => setCategoryFilter(item.name)}>{item.name}</button>)}</div>
    </section>
  <section className="panel">
    <div className="panel-heading">
      <div>
        <h2 className="panel-title">Todos os lançamentos</h2>
        <p className="panel-description">Ordene pelas colunas. Clique na situação para marcar pago ou pendente.</p>
        </div>
      <div className="panel-actions">
        <button className="button button-secondary" type="button" onClick={() => void refresh()}>Atualizar</button>
        <button className="button button-primary" type="button" onClick={() => { resetForm(); setEntryModalOpen(true); }}>+ Novo lançamento</button>
        </div>
      </div>
    <EntryTable entries={visibleEntries} onEdit={canEdit ? startEdit : undefined} onDelete={canDelete ? setDeleteTarget : undefined} onStatusChange={canEdit ? (item) => void changeEntryStatus(item) : undefined} sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} />
      </section>
    </>}

    {tab === 'cards' && <>
    <section className="panel">
      <h2 className="panel-title">Cartões cadastrados</h2>
      <div className="card-grid">
        {cards.map((card) => {
        const purchases = card.paymentType === 'CREDIT' ? entries.filter((item) => item.cardId === card.id && item.type === 'EXPENSE' && item.purpose !== 'CARD_PAYMENT').reduce((sum, item) => sum + item.amount, 0) : 0;
        const payments = entries.filter((item) => item.cardId === card.id && item.purpose === 'CARD_PAYMENT' && item.status === 'PAID').reduce((sum, item) => sum + item.amount, 0);
        const debt = Math.max(0, purchases - payments);
        return <article className="payment-card" key={card.id}>
          <span className="eyebrow">{card.paymentType === 'CREDIT' ? 'Crédito' : 'Débito'} · {card.brand || 'Cartão'}</span>
          <h3>{card.name}</h3>
          <p>{card.paymentType === 'CREDIT' ? `Fatura estimada: ${money.format(debt)}` : 'Cartão de débito'}</p>
          <strong>{card.paymentType === 'CREDIT' && card.creditLimit != null ? `Disponível: ${money.format(Math.max(0, card.creditLimit - debt))}` : '\u2212'}</strong>
          <small>{card.lastFour ? `Final ${card.lastFour}` : 'Final não informado'}</small>
          <div className="row-actions">
            {canEdit && <button className="button button-secondary button-compact" type="button" onClick={() => editCard(card)}>Editar</button>}
            {canDelete && <button className="button button-danger button-compact" type="button" onClick={() => void deleteCard(card)}>Excluir</button>}
            </div>
          </article>;
        })}
        </div>{!cards.length && <p className="panel-description">Nenhum cartão cadastrado.</p>}</section>
    {(canCreate || canEdit) && <section className="panel">
      <div className="panel-heading">
        <div>
          <h2 className="panel-title">{editingCard ? 'Editar cartão' : 'Cadastrar cartão'}</h2>
          <p className="panel-description">Use apenas os últimos quatro dígitos.</p>
          </div>{editingCard && <button className="button button-secondary" type="button" onClick={() => setEditingCard(null)}>Cancelar</button>}</div>
      <form className="form-grid form-grid-expanded" onSubmit={saveCard}>
        <Field label="Apelido">
          <input className="input" value={cardName} onChange={(event) => setCardName(event.target.value)} required />
            </Field>
          <Field label="Tipo">
            <select className="select" value={cardPaymentType} onChange={(event) => setCardPaymentType(event.target.value as 'CREDIT' | 'DEBIT')}>
              <option value="CREDIT">Crédito</option>
              <option value="DEBIT">Débito</option>
              </select>
            </Field>
          <Field label="Bandeira">
            <input className="input" value={cardBrand} onChange={(event) => setCardBrand(event.target.value)} />
              </Field>
            <Field label="Últimos 4 dígitos">
              <input className="input" value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} />
                </Field>
              {cardPaymentType === 'CREDIT' && <>
              <Field label="Limite (R$)">
                <input className="input" type="number" min="0" step="0.01" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} />
                  </Field>
                <Field label="Dia de fechamento">
                  <input className="input" type="number" min="1" max="31" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
                    </Field>
                  <Field label="Dia de vencimento">
                    <input className="input" type="number" min="1" max="31" value={cardDueDay} onChange={(event) => setCardDueDay(event.target.value)} />
                      </Field>
                    </>}
                    <button className="button button-primary" disabled={busy}>{editingCard ? 'Salvar cartão' : '+ Cadastrar cartão'}</button>
                    </form>
                  </section>}
                </>}

                {tab === 'institutions' && <>
                <section className="panel">
                  <h2 className="panel-title">Bancos e contas</h2>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Instituição</th>
                          <th>Conta</th>
                          <th>Tipo</th>
                          <th>Perfil</th>
                          <th className="table-number">Saldo</th>
                          <th>Ações</th>
                          </tr>
                        </thead>
                      <tbody>
                        {accountBalances.map((account) => <tr key={account.id}>
                          <td>{account.institution}</td>
                          <td>{account.name}</td>
                          <td>{account.accountType}</td>
                          <td>{account.entity === 'PHYSICAL' ? 'PF' : 'PJ'}</td>
                          <td className="table-number">{money.format(account.balance)}</td>
                          <td>
                            <div className="row-actions">
                              {canEdit && <button className="button button-secondary button-compact" type="button" onClick={() => editAccount(account)}>Editar</button>}
                              {canDelete && <button className="button button-danger button-compact" type="button" onClick={() => void deleteAccount(account)}>Excluir</button>}
                              </div>
                            </td>
                          </tr>)}
                        {!accountBalances.length && <tr>
                          <td className="empty-state" colSpan={6}>Nenhuma conta cadastrada.</td>
                          </tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>
                {(canCreate || canEdit) && <section className="panel">
                  <h2 className="panel-title">{editingAccount ? 'Editar conta' : 'Adicionar banco ou instituição'}</h2>{editingAccount && <button className="button button-secondary" type="button" onClick={() => setEditingAccount(null)}>Cancelar edição</button>}
                  <form className="form-grid form-grid-expanded" onSubmit={saveAccount}>
                    <Field label="Apelido da conta">
                      <input className="input" value={accountName} onChange={(event) => setAccountName(event.target.value)} required />
                        </Field>
                      <Field label="Banco / instituição">
                        <input className="input" value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} required />
                          </Field>
                        <Field label="Tipo">
                          <select className="select" value={accountType} onChange={(event) => setAccountType(event.target.value)}>
                            <option value="CHECKING">Corrente</option>
                            <option value="SAVINGS">Poupança</option>
                            <option value="CASH">Dinheiro</option>
                            <option value="WALLET">Carteira digital</option>
                            <option value="OTHER">Outro</option>
                            </select>
                          </Field>
                        <Field label="Perfil">
                          <select className="select" value={accountEntity} onChange={(event) => setAccountEntity(event.target.value as EntityType)}>
                            <option value="PHYSICAL">PF</option>
                            <option value="LEGAL">PJ</option>
                            </select>
                          </Field>
                        <Field label="Saldo inicial">
                          <input className="input" type="number" step="0.01" value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} />
                            </Field>
                          <button className="button button-primary" disabled={busy}>{editingAccount ? 'Salvar conta' : '+ Adicionar conta'}</button>
                          </form>
                        </section>}
                      </>}

                      {tab === 'categories' && <>
                      <section className="panel category-scope-panel">
                        <Field label="Categorias visíveis">
                          <select className="select" value={categoryEntity} onChange={(event) => setCategoryEntity(event.target.value as 'ALL' | EntityType)}>
                            <option value="ALL">Todos os perfis</option>
                            <option value="PHYSICAL">Somente PF</option>
                            <option value="LEGAL">Somente PJ</option>
                            </select>
                          </Field>
                        <p className="panel-description">No filtro Geral, o painel reúne categorias de todos os perfis.</p>
                        </section>
                      {(canCreate || canEdit) && <section className="panel">
                        <div className="panel-heading">
                          <div>
                            <h2 className="panel-title">{editingCategory ? 'Editar categoria' : 'Criar categoria'}</h2>
                            <p className="panel-description">Renomear também atualiza os lançamentos.</p>
                            </div>{editingCategory && <button className="button button-secondary" type="button" onClick={() => { setEditingCategory(null); setCategoryName(''); setCategoryDescription(''); }}>Cancelar</button>}</div>
                        <form className="form-grid form-grid-expanded" onSubmit={saveCategory}>
                          <Field label="Nome">
                            <input className="input" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
                              </Field>
                            <Field label="Perfil">
                              <select className="select" value={categoryEntity} onChange={(event) => setCategoryEntity(event.target.value as 'ALL' | EntityType)}>
                                <option value="ALL">Todos</option>
                                <option value="PHYSICAL">PF</option>
                                <option value="LEGAL">PJ</option>
                                </select>
                              </Field>
                            <Field label="Descrição">
                              <input className="input" value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} />
                                </Field>
                              <button className="button button-primary" disabled={busy}>{editingCategory ? 'Salvar categoria' : '+ Criar categoria'}</button>
                              </form>
                            </section>}
                          <section className="panel">
                            <div className="panel-heading">
                              <h2 className="panel-title">Categorias cadastradas</h2>
                              <input className="input category-search" placeholder="Buscar categoria" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} />
                                </div>
                              <div className="table-wrap">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Categoria</th>
                                      <th>Descrição</th>
                                      <th>Perfil</th>
                                      <th>Ações</th>
                                      </tr>
                                    </thead>
                                  <tbody>
                                    {visibleCategories.map((item) => <tr key={item.id}>
                                      <td>{item.name}</td>
                                      <td>{item.description || '\u2212'}</td>
                                      <td>{item.entity === 'ALL' ? 'Todos' : item.entity === 'PHYSICAL' ? 'PF' : 'PJ'}</td>
                                      <td>
                                        <div className="row-actions">
                                          <button className="button button-secondary button-compact" type="button" onClick={() => { setEditingCategory(item); setCategoryName(item.name); setCategoryDescription(item.description); setCategoryEntity(item.entity); }}>Editar</button>
                                          <button className="button button-danger button-compact" type="button" onClick={() => void deleteCategory(item)}>Excluir</button>
                                          </div>
                                        </td>
                                      </tr>)}
                                    </tbody>
                                  </table>
                                </div>
                              </section>
                            </>}

                            {tab === 'reports' && <section className="panel report-panel">
                              <div className="panel-heading">
                                <div>
                                  <h2 className="panel-title">Relatório financeiro</h2>
                                  <p className="panel-description">Modelos editáveis em reports/models; os filtros ativos são aplicados ao visualizar.</p>
                                  </div>
                                </div>
                              <div className="report-actions no-print">
                                <Field label="Modelo HTML">
                                  <select className="select" value={reportModelName} onChange={(event) => { const selectedName = event.target.value; setReportModelName(selectedName); void openReportPreview(selectedName); }}>
                                    <option value="">Selecione</option>{reportModels.map((model) => <option key={model.name} value={model.name}>{model.name}</option>)}</select>
                                  </Field>
                                <button className="button button-secondary" type="button" onClick={() => void loadReportModels()}>Atualizar modelos</button>
                                </div>
                              {reportPreview && <>
                              <div className="panel-actions no-print">
                                <button className="button button-primary" type="button" onClick={() => (document.getElementById('report-preview-frame') as HTMLIFrameElement | null)?.contentWindow?.print()}>Imprimir / salvar PDF</button>
                                <button className="button button-secondary" type="button" onClick={() => setReportPreview('')}>Fechar prévia</button>
                                </div>
                              <iframe id="report-preview-frame" className="report-preview-frame" title="Pré-visualização do relatório" sandbox="allow-same-origin allow-modals" srcDoc={reportPreview} />
                              </>}
                              <div className="report-heading">
                                <h2>Relatório ? {filterEntity === 'ALL' ? 'Geral' : filterEntity === 'PHYSICAL' ? 'Pessoal (PF)' : 'Empresa (PJ)'}</h2>
                                </div>
                              <EntryTable entries={visibleEntries} readOnly sortKey={sortKey} sortDirection={sortDirection} onSort={sortBy} />
                              </section>}

                            {tab === 'settings' && <div className="settings-layout">
                            <section className="panel settings-panel">
                              <h2 className="panel-title">Instâncias financeiras</h2>
                              <p className="panel-description">Crie um conjunto separado para cada finança. Os dados só ficam visíveis para quem tiver acesso a essa instância.</p>
                              <form className="finance-create-grid" onSubmit={createFinance}><Field label="Nome da instância"><input className="input" maxLength={80} value={newFinanceName} onChange={(event) => setNewFinanceName(event.target.value)} placeholder="Ex.: Casa, Loja Centro" required /></Field><Field label="Tipo"><select className="select" value={newFinanceEntity} onChange={(event) => setNewFinanceEntity(event.target.value as EntityType)}><option value="PHYSICAL">Pessoal (PF)</option><option value="LEGAL">Empresa (PJ)</option></select></Field><button className="button button-primary" type="submit" disabled={busy}>Criar instância</button></form>
                              {activeFinance && activeFinance.ownerId === session?.user.id && <div className="finance-sharing"><h3 className="settings-section-title">Compartilhar “{activeFinance.name}”</h3><p className="panel-description">Informe o e-mail de uma conta liberada e marque as ações que ela poderá fazer nesta instância.</p><form className="finance-share-grid" onSubmit={shareFinance}><Field label="E-mail do usuário"><input className="input" type="email" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} required /></Field><div className="finance-share-permissions">{(['view', 'create', 'edit', 'delete'] as const).map((permission) => <label className="check-field" key={permission}><input type="checkbox" checked={sharePermissions.includes(permission)} disabled={permission === 'view'} onChange={(event) => setSharePermissions((current) => event.target.checked ? [...current, permission] : current.filter((item) => item !== permission))} />{permission === 'view' ? 'Visualizar' : permission === 'create' ? 'Criar' : permission === 'edit' ? 'Editar' : 'Excluir'}</label>)}</div><button className="button button-secondary" type="submit">Salvar compartilhamento</button></form><div className="finance-member-list">{financeMembers.map((member) => <div className="finance-member-row" key={member.id}><div><strong>{member.name}</strong><small className="muted-block">{member.email} · {member.permissions.map((permission) => permission === 'view' ? 'visualizar' : permission === 'create' ? 'criar' : permission === 'edit' ? 'editar' : 'excluir').join(', ')}</small></div>{member.id !== activeFinance.ownerId && <button className="button button-danger button-compact" type="button" onClick={() => void removeFinanceMember(member.id)}>Remover acesso</button>}</div>)}</div></div>}
                            </section>
                            <section className="panel settings-panel">
                              <div className="settings-heading"><div><h2 className="panel-title">Backup e restauração</h2><p className="panel-description">Escolha os dados que deseja salvar ou recuperar. Se ainda não existir uma instância, a restauração criará uma com os dados do backup.</p></div></div>
                              <div className="settings-section"><h3 className="settings-section-title">Dados incluídos</h3><div className="backup-data-grid">{([['transactions', 'Lançamentos'], ['cards', 'Cartões'], ['accounts', 'Bancos e contas'], ['categories', 'Categorias'], ['shoppingLists', 'Listas de compras']] as const).map(([key, label]) => <label className="backup-option" key={key}><input type="checkbox" checked={backupTypes.includes(key)} onChange={(event) => { setBackupTypes((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key)); setBackupSettingsSaved(false); }} /><span>{label}</span></label>)}</div></div>
                              <div className="settings-section"><h3 className="settings-section-title">Criar ou restaurar backup</h3><div className="backup-action-grid"><button className="button button-primary" type="button" disabled={!backupTypes.length || busy} onClick={() => void createBackup().catch((cause) => setBackupMessage(cause.message))}>Baixar backup no computador</button><Field label="Arquivo para restauracao"><input className="input backup-file-input" type="file" accept="application/json,.json" onChange={(event) => { setRestoreFile(event.target.files?.[0] || null); setSelectedServerBackup(''); }} /></Field><button className="button button-secondary" type="button" disabled={(!restoreFile && !selectedServerBackup) || !backupTypes.length || busy} onClick={() => void (selectedServerBackup ? restoreServerBackup() : restoreBackup())}>Restaurar dados selecionados</button></div>{session?.user.role === 'ADMIN' && <div className="backup-server-picker"><Field label="Backup automatico salvo no servidor"><select className="select" value={selectedServerBackup} onChange={(event) => { setSelectedServerBackup(event.target.value); if (event.target.value) setRestoreFile(null); }}><option value="">Selecione um backup salvo...</option>{serverBackupFiles.map((file) => <option key={file.name} value={file.name}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(file.modifiedAt))} - {file.name}</option>)}</select></Field><button className="button button-secondary" type="button" onClick={() => void loadServerBackupFiles()}>Atualizar lista de backups</button></div>}</div>
                              {session?.user.role === 'ADMIN' ? <div className="settings-section"><h3 className="settings-section-title">Backup automatico no servidor</h3><p className="panel-description settings-help">Informe um caminho absoluto no servidor ou container, como /bkp ou /var/bkp. O processo precisa ter permissao para gravar.</p><div className="backup-schedule-grid"><Field label="Criar backup a cada"><select className="select" value={backupInterval} onChange={(event) => { setBackupInterval(event.target.value); setBackupSettingsSaved(false); }}><option value="1">1 dia</option><option value="7">7 dias</option><option value="30">30 dias</option></select></Field><Field label="Manter ate"><input className="input" type="number" min="1" max="100" value={backupRetention} onChange={(event) => { setBackupRetention(event.target.value); setBackupSettingsSaved(false); }} /></Field><Field label="Caminho absoluto no servidor"><input className="input" type="text" value={backupServerPath} placeholder="/bkp" onChange={(event) => { setBackupServerPath(event.target.value); setBackupSettingsSaved(false); setSelectedServerBackup(''); setServerBackupFiles([]); }} /></Field></div><div className="backup-config-actions"><button className="button button-primary" type="button" onClick={saveBackupSettings}>Salvar configuracao</button><button className="button button-secondary" type="button" disabled={!backupSettingsSaved} onClick={() => void saveServerBackup().catch((cause) => setBackupMessage(cause.message))}>Gravar backup agora</button></div>{backupMessage && <p className="backup-status" role="status">{backupMessage}</p>}<p className="backup-path-help">No Docker Compose, /bkp usa volume persistente. O backup automatico roda conforme a frequencia salva enquanto o painel estiver aberto.</p></div> : <div className="settings-section"><h3 className="settings-section-title">Backup automatico no servidor</h3><p className="panel-description">A gravacao em caminhos do servidor fica disponivel para administradores. Voce ainda pode baixar backups manualmente.</p></div>}
                              {backupMessage && <p className="backup-status" role="status">{backupMessage}</p>}
                            </section>
                            {session?.user.role === 'ADMIN' && <section className="panel">
                              <h2 className="panel-title">Usuários e permissões</h2>
                              <p className="panel-description">Novas contas começam bloqueadas. Libere somente as ações necessárias.</p>{adminUsers.map((user) => <div className="user-permission-row" key={user.id}>
                                <div>
                                  <strong>{user.name}</strong>
                                  <small className="muted-block">{user.email}</small>
                                  </div>
                                <Field label="Acesso">
                                  <select className="select" value={user.role} onChange={(event) => setAdminUsers((current) => current.map((item) => item.id === user.id ? { ...item, role: event.target.value as AdminUser['role'] } : item))}>
                                    <option value="BLOCKED">Bloqueado</option>
                                    <option value="USER">Personalizado</option>
                                    <option value="ADMIN">Administrador</option>
                                    </select>
                                  </Field>{(['view', 'create', 'edit', 'delete'] as const).map((permission) => <label className="check-field" key={permission}>
                                  <input type="checkbox" checked={JSON.parse(user.permissions || '[]').includes(permission)} disabled={user.role !== 'USER'} onChange={(event) => { const old = JSON.parse(user.permissions || '[]') as string[]; const next = event.target.checked ? [...old, permission] : old.filter((item) => item !== permission); setAdminUsers((current) => current.map((item) => item.id === user.id ? { ...item, permissions: JSON.stringify(next) } : item)); }} />{permission === 'view' ? 'Visualizar' : permission === 'create' ? 'Criar' : permission === 'edit' ? 'Editar' : 'Excluir'}</label>)}<button className="button button-secondary" type="button" onClick={() => void saveAdminUser(user)}>Salvar acesso</button>
                                  </div>)}<p className="panel-description">Admin pelo terminal: <code>npm run admin:grant -- email@exemplo.com</code>
                                  </p>
                                </section>}
                            </div>}

                              {entryModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setEntryModalOpen(false); resetForm(); } }}>
                                <section className="modal-card entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-modal-title">
                                  <div className="panel-heading">
                                    <div>
                                      <h2 className="panel-title" id="entry-modal-title">{editing ? 'Editar lançamento' : 'Novo lançamento'}</h2>
                                      <p className="panel-description">Lançamento, origem e finalidade no mesmo formulário.</p>
                                      </div>
                                    <button className="button button-secondary" type="button" onClick={() => { setEntryModalOpen(false); resetForm(); }}>Fechar</button>
                                    </div>
                                  <form className="form-grid form-grid-expanded" onSubmit={saveEntry}>
                                    <Field label="Descrição">
                                      <input className="input" maxLength={120} value={description} onChange={(event) => setDescription(event.target.value)} required />
                                        </Field>
                                      <Field label="Valor (R$)">
                                        <input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
                                          </Field>
                                        <Field label="Tipo">
                                          <select className="select" value={type} onChange={(event) => setType(event.target.value as TransactionType)}>
                                            <option value="EXPENSE">Despesa</option>
                                            <option value="INCOME">Entrada</option>
                                            </select>
                                          </Field>
                                        <Field label="Perfil">
                                          <select className="select" value={entity} onChange={(event) => { setEntity(event.target.value as EntityType); setCategory('Geral'); }}>
                                            <option value="PHYSICAL">PF</option>
                                            <option value="LEGAL">PJ</option>
                                            </select>
                                          </Field>
                                        <Field label="Categoria">
                                          <select className="select" value={category} onChange={(event) => { setCategory(event.target.value); setShowQuickCategory(event.target.value === '__new__'); }}>
                                            <option value="Geral">Geral</option>{entryCategories.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}<option value="__new__">+ Criar categoria</option>
                                          </select>
                                          </Field>
                                        <Field label="Situação">
                                          <select className="select" value={status} onChange={(event) => setStatus(event.target.value as 'PAID' | 'PENDING')}>
                                            <option value="PAID">Pago / recebido</option>
                                            <option value="PENDING">Pendente</option>
                                            </select>
                                          </Field>
                                        <Field label="Data">
                                          <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
                                            </Field>
                                          <Field label="Vencimento">
                                            <input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                                              </Field>
                                            <Field label="Cartão">
                                              <select className="select" value={cardId} onChange={(event) => setCardId(event.target.value)}>
                                                <option value="">Sem cartão</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select>
                                              </Field>
                                            {!editing && <>
                                            <Field label="Parcelas">
                                              <select className="select" value={installments} onChange={(event) => setInstallments(event.target.value)}>{Array.from({ length: 60 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}x</option>)}</select>
                                              </Field>
                                            <Field label="Repetição">
                                              <select className="select" value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>
                                                <option value="">Não se repete</option>
                                                <option value="WEEKLY">Semanal</option>
                                                <option value="MONTHLY">Mensal</option>
                                                <option value="YEARLY">Anual</option>
                                                </select>
                                              </Field>{recurrence && <Field label="Repetir até">
                                              <input className="input" type="date" min={date} value={recurrenceEndDate} onChange={(event) => setRecurrenceEndDate(event.target.value)} required />
                                                </Field>}</>}
                                              {showQuickCategory && <div className="form-section form-section-wide">
                                                <h3>Nova categoria</h3>
                                                <div className="form-grid">
                                                  <Field label="Nome">
                                                    <input className="input" value={quickCategoryName} onChange={(event) => setQuickCategoryName(event.target.value)} maxLength={60} required />
                                                    </Field>
                                                    <Field label="Descrição">
                                                      <input className="input" value={quickCategoryDescription} onChange={(event) => setQuickCategoryDescription(event.target.value)} maxLength={180} />
                                                      </Field>
                                                      <button className="button button-secondary" type="button" onClick={() => setShowQuickCategory(false)}>Cancelar categoria</button>
                                                      <button className="button button-secondary" type="button" onClick={() => void createQuickCategory()} disabled={busy}>Criar categoria</button>
                                                    </div>
                                                  </div>}
                                                  <div className="form-section form-section-wide">
                                                    <h3>Origem e finalidade</h3>
                                                    <div className="form-grid form-grid-expanded">
                                                      <Field label="Finalidade">
                                                        <select className="select" value={purpose} onChange={(event) => setPurpose(event.target.value)}>
                                                          <option value="STANDARD">Movimentação comum</option>
                                                          <option value="CARD_PAYMENT">Pagamento de fatura</option>
                                                          <option value="LOAN">Empréstimo</option>
                                                          <option value="DONATION">Doação</option>
                                                          <option value="SUBSCRIPTION">Assinatura</option>
                                                          </select>
                                                        </Field>
                                                      <Field label="Conta / instituição">
                                                        <select className="select" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                                                          <option value="">Sem conta vinculada</option>{accounts.filter((account) => account.entity === entity).map((account) => <option key={account.id} value={account.id}>{account.institution} · {account.name}</option>)}</select>
                                                        </Field>
                                                      <Field label="Observações">
                                                        <input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={300} />
                                                          </Field>
                                                        <label className="check-field">
                                                          <input type="checkbox" checked={autoDebit} onChange={(event) => setAutoDebit(event.target.checked)} />Débito automático</label>
                                                          <label className="check-field">
                                                            <input type="checkbox" checked={isSubscription} onChange={(event) => setIsSubscription(event.target.checked)} />Assinatura</label>
                                                            </div>
                                                          </div>
                                                        <div className="modal-actions form-section-wide">
                                                          <button className="button button-secondary" type="button" onClick={() => { setEntryModalOpen(false); resetForm(); }}>Cancelar</button>
                                                          <button className="button button-primary" type="submit" name="saveScope" value="single" disabled={busy}>{editing ? 'Salvar' : 'Adicionar lançamento'}</button>{editing?.recurrenceGroup && <button className="button button-primary" type="submit" name="saveScope" value="group" disabled={busy}>Salvar em grupo</button>}</div>
                                                        </form>
                                                      </section>
                                                    </div>}

                                                  {deleteTarget && <div className="modal-backdrop" role="presentation">
                                                    <section className="modal-card confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
                                                      <h2 className="panel-title" id="delete-title">O que deseja excluir?</h2>
                                                      <p>{deleteTarget.description} ? {money.format(deleteTarget.amount)} ? {formatDate(deleteTarget.date)}</p>
                                                      <p>Você pode remover apenas este item ou todas as ocorrências deste grupo.</p>
                                                      <div className="modal-actions">
                                                        <button className="button button-secondary" type="button" onClick={() => setDeleteTarget(null)}>Cancelar</button>
                                                        <button className="button button-danger" type="button" onClick={() => void removeEntry(deleteTarget)}>Excluir somente este</button>{deleteTarget.recurrenceGroup && <button className="button button-danger" type="button" onClick={() => void removeEntry(deleteTarget, true)}>Excluir grupo ({entries.filter((item) => item.recurrenceGroup === deleteTarget.recurrenceGroup).length})</button>}</div>
                                                      </section>
                                                    </div>}
                                                  </main>
                                                );
}

function FinancialCharts({ entries }: { entries: Entry[] }) {
  const current = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthlyEntries = entries.filter((item) => item.status === 'PAID' && item.date.slice(0, 7) === key);
    const income = monthlyEntries
      .filter((item) => item.type === 'INCOME')
      .reduce((total, item) => total + item.amount, 0);
    const expenses = monthlyEntries
      .filter((item) => item.type === 'EXPENSE' && item.purpose !== 'CARD_PAYMENT')
      .reduce((total, item) => total + item.amount, 0);

    return {
      key,
      label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date),
      income,
      expenses,
    };
  });
  const maxValue = Math.max(1, ...months.flatMap((month) => [month.income, month.expenses]));

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2 className="panel-title">Visão financeira</h2>
          <p className="panel-description">Entradas e despesas confirmadas nos Últimos seis meses.</p>
        </div>
      </div>
      <div className="chart-legend" aria-hidden="true">
        <span><i className="chart-dot chart-income" />Entradas</span>
        <span><i className="chart-dot chart-expense" />Despesas</span>
      </div>
      <div className="financial-chart-grid" role="img" aria-label="Gráfico mensal de entradas e despesas">
        <div className="chart-axis"><span>{money.format(maxValue)}</span><span>{money.format(maxValue / 2)}</span><span>R$ 0</span></div>
        {months.map((month) => (
          <div className="chart-column" key={month.key}>
            <div className="chart-bars">
              <span className="chart-bar chart-income" style={{ height: `${month.income ? Math.max(3, month.income / maxValue * 100) : 0}%` }} title={`Entradas: ${money.format(month.income)}`} />
              <span className="chart-bar chart-expense" style={{ height: `${month.expenses ? Math.max(3, month.expenses / maxValue * 100) : 0}%` }} title={`Despesas: ${money.format(month.expenses)}`} />
            </div>
            <span className="chart-month">{month.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Summary({ title, value }: { title: string; value: number }) {
  return (
    <article className="summary-card">
      <span className="summary-label">{title}</span>
      <strong className="summary-value">{money.format(value)}</strong>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function FilterPanel({
  month, setMonth, from, setFrom, to, setTo, status, setStatus,
  category, setCategory, categories, description, setDescription, onClear,
}: {
  month: string; setMonth: (value: string) => void;
  from: string; setFrom: (value: string) => void;
  to: string; setTo: (value: string) => void;
  status: string; setStatus: (value: string) => void;
  category: string; setCategory: (value: string) => void;
  categories: string[]; description: string; setDescription: (value: string) => void;
  onClear: () => void;
}) {
  const [monthText, setMonthText] = useState(month ? `${month.slice(5, 7)}/${month.slice(2, 4)}` : '');

  useEffect(() => {
    setMonthText(month ? `${month.slice(5, 7)}/${month.slice(2, 4)}` : '');
  }, [month]);

  return (
    <section className="panel filter-panel" aria-label="Filtros dos lançamentos">
      <div className="panel-heading">
        <div>
          <h2 className="panel-title">Filtros</h2>
          <p className="panel-description">Período, situação, categoria e descrição.</p>
        </div>
        <button type="button" className="button button-secondary" onClick={onClear}>Limpar filtros</button>
      </div>
      <div className="filter-grid">
        <Field label="Mês (MM/AA)"><input className="input" type="text" inputMode="numeric" autoComplete="off" maxLength={5} placeholder="10/26" value={monthText} onChange={(event) => { const value = event.target.value.replace(/[^\d/]/g, '').slice(0, 5); setMonthText(value); const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value); if (match) setMonth(`20${match[2]}-${match[1]}`); else if (!value) setMonth(''); }} /></Field>
        <Field label="Data inicial"><input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
        <Field label="Data final"><input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></Field>
        <Field label="Situação"><select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todas</option><option value="PAID">Pago / recebido</option><option value="PENDING">Pendente</option></select></Field>
        <Field label="Categoria"><select className="select" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas</option>{categories.map((name) => <option key={name} value={name}>{name}</option>)}</select></Field>
        <Field label="Descrição"><input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Buscar texto..." /></Field>
      </div>
    </section>
  );
}

function EntryTable({
  entries, onEdit, onDelete, onStatusChange, readOnly = false,
  sortKey, sortDirection, onSort,
}: {
  entries: Entry[];
  onEdit?: (entry: Entry) => void;
  onDelete?: (entry: Entry) => void;
  onStatusChange?: (entry: Entry) => void;
  readOnly?: boolean;
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  function heading(key: SortKey, label: string, numeric = false) {
    return (
      <th className={numeric ? 'table-number' : ''} scope="col">
        <button className="sort-button" type="button" onClick={() => onSort(key)}>
          {label}{sortKey === key ? (sortDirection === 'asc' ? ' \u2191' : ' \u2193') : ''}
        </button>
      </th>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>
          {heading('description', 'Descrição')}
          {heading('category', 'Categoria / cartão')}
          {heading('entity', 'Setor')}
          {heading('date', 'Data / vencimento')}
          {heading('status', 'Situação')}
          {heading('amount', 'Valor', true)}
          {!readOnly && <th scope="col">Ações</th>}
        </tr></thead>
        <tbody>
          {entries.map((item) => (
            <tr key={item.id}>
              <td>
                {item.description}
                {item.installmentNumber && <small className="muted-block">Parcela {item.installmentNumber}/{item.installmentTotal}</small>}
                {item.recurrenceGroup && <small className="muted-block">Repetição {item.recurrence === 'WEEKLY' ? 'semanal' : item.recurrence === 'YEARLY' ? 'anual' : 'mensal'} até {formatDate(item.recurrenceEndDate)}</small>}
                {item.isSubscription && <small className="muted-block">Assinatura{item.autoDebit ? ' ? débito automático' : ''}</small>}
              </td>
              <td>{item.category || 'Geral'}{item.card && <small className="muted-block">{item.card.name}</small>}</td>
              <td>{item.entity === 'PHYSICAL' ? 'Pessoal' : 'Empresa'}</td>
              <td>{formatDate(item.date)}<small className="muted-block">Vence: {formatDate(item.dueDate)}</small></td>
          <td>{onStatusChange ? <button className={`status-pill ${item.status === 'PAID' ? 'status-paid' : 'status-pending'} status-toggle`} type="button" onClick={() => onStatusChange(item)} aria-label={`Alterar situação de ${item.description}`}>{item.status === 'PAID' ? 'Pago' : 'Pendente'}</button> : <span className={`status-pill ${item.status === 'PAID' ? 'status-paid' : 'status-pending'}`}>{item.status === 'PAID' ? 'Pago' : 'Pendente'}</span>}</td>
              <td className={`table-number ${item.type === 'INCOME' ? 'type-income' : 'type-expense'}`}>{item.type === 'INCOME' ? '+' : '\u2212'}{money.format(item.amount)}</td>
              {!readOnly && (onEdit || onDelete) && <td><div className="row-actions">{onEdit && <button className="button button-secondary button-compact" type="button" onClick={() => onEdit(item)}>Editar</button>}{onDelete && <button className="button button-danger button-compact" type="button" onClick={() => onDelete(item)}>Excluir</button>}</div></td>}
            </tr>
          ))}
          {!entries.length && <tr><td className="empty-state" colSpan={readOnly || (!onEdit && !onDelete) ? 6 : 7}>Nenhum lançamento para este filtro.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
