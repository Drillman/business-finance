import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useRecurringExpenses,
} from '../hooks/useExpenses'
import type { Expense, CreateExpenseInput, ExpenseCategory, RecurrencePeriod } from '@shared/types'
import { ArrowUpDown, Check, ChevronDown, ChevronUp, Pencil, Plus, Repeat2, Trash2, Wallet, X } from 'lucide-react'
import { useSnackbar } from '../contexts/SnackbarContext'
import { Badge, Button, Checkbox, ConfirmDialog, DataTable, MonthSwitch, PageTabs, Radio, Select, Spinner, StatCard, Switch, type DataTableColumn } from '@drillman/dashboard-ui'

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatMonth(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
  })
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num)
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
}

const categoryLabels: Record<ExpenseCategory, string> = {
  fixed: 'Fixe mensuelle',
  'one-time': 'Ponctuelle',
  recurring: 'Récurrente',
  professional: 'Professionnelle',
  other: 'Autre',
}

const recurrenceLabels: Record<RecurrencePeriod, string> = {
  monthly: 'Mensuelle',
  quarterly: 'Trimestrielle',
  yearly: 'Annuelle',
}

const categoryOptions = Object.entries(categoryLabels).map(([value, label]) => ({
  value,
  label,
}))

const recurrenceOptions = Object.entries(recurrenceLabels).map(([value, label]) => ({
  value,
  label,
}))

const taxRateOptions = [
  { value: '0', label: '0% (Exonere)' },
  { value: '5.5', label: '5.5%' },
  { value: '10', label: '10%' },
  { value: '20', label: '20%' },
]

const taxRecoveryRateOptions = [
  { value: '100', label: '100% (Recuperation totale)' },
  { value: '80', label: '80% (Recuperation partielle)' },
  { value: '0', label: '0% (Non recuperable)' },
]

const fixedExpenseColumns: DataTableColumn<Expense>[] = [
  { key: 'description', header: 'Description', className: 'font-medium', cell: (expense) => expense.description },
  { key: 'payment-day', header: 'Jour', align: 'center', numeric: true, width: 'w-24', cell: (expense) => expense.paymentDay },
  { key: 'amount-ht', header: 'Montant HT', align: 'right', width: 'w-40', cell: (expense) => formatCurrency(expense.amountHt) },
  {
    key: 'amount-ttc',
    header: 'Montant TTC',
    align: 'right',
    width: 'w-40',
    cell: (expense) => formatCurrency(parseFloat(expense.amountHt) + parseFloat(expense.taxAmount)),
  },
]

type FixedExpenseStatus = 'termine' | 'en-cours' | 'a-venir'
type FixedSortKey = 'description' | 'amountTtc' | 'paymentDay' | 'status' | 'recurrence'
type SortDirection = 'asc' | 'desc'

const fixedStatusOrder: Record<FixedExpenseStatus, number> = {
  'a-venir': 0,
  'en-cours': 1,
  termine: 2,
}

function getFixedExpenseStatus(expense: Expense, currentMonth: string): FixedExpenseStatus {
  const startMonth = expense.startMonth?.slice(0, 7) ?? ''
  const endMonth = expense.endMonth?.slice(0, 7) ?? ''

  if (startMonth && startMonth > currentMonth) {
    return 'a-venir'
  }

  if (endMonth && endMonth < currentMonth) {
    return 'termine'
  }

  return 'en-cours'
}

function getFixedExpenseStatusTooltip(expense: Expense): string {
  const startLabel = expense.startMonth ? formatMonth(expense.startMonth) : 'Non defini'
  const endLabel = expense.endMonth ? formatMonth(expense.endMonth) : 'En cours'
  return `Debut: ${startLabel} | Fin: ${endLabel}`
}

interface ExpenseFormData {
  description: string
  date: string
  amountHt: string
  taxAmount: string
  taxRecoveryRate: string
  category: ExpenseCategory
  isRecurring: boolean
  isIntraEu: boolean
  recurrencePeriod: RecurrencePeriod | ''
  startMonth: string
  endMonth: string
  paymentDay: string
  note: string
  inputMode: 'ht' | 'ttc'
  amountTtc: string
  taxRate: string
}

const defaultFormData: ExpenseFormData = {
  description: '',
  date: new Date().toISOString().split('T')[0],
  amountHt: '',
  taxAmount: '0',
  taxRecoveryRate: '100',
  category: 'one-time',
  isRecurring: false,
  isIntraEu: false,
  recurrencePeriod: 'monthly',
  startMonth: `${new Date().getFullYear()}-01`,
  endMonth: '',
  paymentDay: '1',
  note: '',
  inputMode: 'ttc',
  amountTtc: '',
  taxRate: '20',
}

export default function Expenses() {
  const [activeTab, setActiveTab] = useState<'monthly' | 'fixed'>('monthly')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [formData, setFormData] = useState<ExpenseFormData>(defaultFormData)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [fixedSort, setFixedSort] = useState<{ key: FixedSortKey; direction: SortDirection }>({
    key: 'status',
    direction: 'asc',
  })

  const { showSuccess, showError } = useSnackbar()

  // Fetch non-recurring expenses for the selected month
  const { data: expensesData, isLoading: isLoadingExpenses } = useExpenses({
    month: selectedMonth,
    isRecurring: false,
  })

  // Fetch active fixed expenses for the selected month
  const { data: activeFixedData, isLoading: isLoadingActiveFixed } = useRecurringExpenses(selectedMonth)

  // Fetch all fixed expenses (for the fixed expenses tab)
  const { data: allFixedData, isLoading: isLoadingAllFixed } = useRecurringExpenses()

  const createMutation = useCreateExpense()
  const updateMutation = useUpdateExpense()
  const deleteMutation = useDeleteExpense()
  const currentMonthKey = getCurrentMonth()

  const nonFixedExpenses = useMemo(
    () => expensesData?.data.filter((expense) => expense.category !== 'fixed') ?? [],
    [expensesData],
  )

  // Calculate variable expenses summary for the selected month (excluding fixed category)
  const variableExpensesSummary = useMemo(() => {
    if (!expensesData?.data) return { totalHt: 0, totalTax: 0, totalTtc: 0, totalRecoverable: 0 }

    const filtered = expensesData.data.filter(e => e.category !== 'fixed')
    let totalHt = 0
    let totalTax = 0
    let totalRecoverable = 0

    filtered.forEach((expense) => {
      const tax = parseFloat(expense.taxAmount)
      const recoveryRate = parseFloat(expense.taxRecoveryRate) / 100
      totalHt += parseFloat(expense.amountHt)
      totalTax += tax
      totalRecoverable += tax * recoveryRate
    })

    return {
      totalHt,
      totalTax,
      totalTtc: totalHt + totalTax,
      totalRecoverable,
    }
  }, [expensesData])

  // Calculate fixed expenses summary for the selected month
  const fixedExpensesSummary = useMemo(() => {
    if (!activeFixedData?.data) return { totalHt: 0, totalTax: 0, totalTtc: 0, totalRecoverable: 0, count: 0 }

    let totalHt = 0
    let totalTax = 0
    let totalRecoverable = 0
    activeFixedData.data.forEach((expense) => {
      const ht = parseFloat(expense.amountHt)
      const tax = parseFloat(expense.taxAmount)
      const recoveryRate = parseFloat(expense.taxRecoveryRate) / 100
      totalHt += ht
      totalTax += tax
      totalRecoverable += tax * recoveryRate
    })

    return {
      totalHt,
      totalTax,
      totalTtc: totalHt + totalTax,
      totalRecoverable,
      count: activeFixedData.data.length,
    }
  }, [activeFixedData])

  // Combined summary for KPIs (fixed + variable expenses)
  const combinedSummary = useMemo(() => {
    const variableCount = nonFixedExpenses.length
    return {
      totalHt: variableExpensesSummary.totalHt + fixedExpensesSummary.totalHt,
      totalTax: variableExpensesSummary.totalTax + fixedExpensesSummary.totalTax,
      totalTtc: variableExpensesSummary.totalTtc + fixedExpensesSummary.totalTtc,
      totalRecoverable: variableExpensesSummary.totalRecoverable + fixedExpensesSummary.totalRecoverable,
      count: variableCount + fixedExpensesSummary.count,
    }
  }, [variableExpensesSummary, fixedExpensesSummary, nonFixedExpenses])

  // Calculate all fixed expenses summary
  const allFixedSummary = useMemo(() => {
    if (!allFixedData?.data) return null

    let monthlyTotal = 0
    let yearlyTotal = 0

    allFixedData.data.forEach((expense) => {
      const ht = parseFloat(expense.amountHt)
      const tax = parseFloat(expense.taxAmount)
      const ttc = ht + tax

      switch (expense.recurrencePeriod) {
        case 'monthly':
          monthlyTotal += ttc
          yearlyTotal += ttc * 12
          break
        case 'quarterly':
          monthlyTotal += ttc / 3
          yearlyTotal += ttc * 4
          break
        case 'yearly':
          monthlyTotal += ttc / 12
          yearlyTotal += ttc
          break
      }
    })

    return {
      count: allFixedData.data.length,
      monthlyTotal,
      yearlyTotal,
    }
  }, [allFixedData])

  const sortedFixedExpenses = useMemo(() => {
    if (!allFixedData?.data) return []

    const sorted = [...allFixedData.data]
    const directionFactor = fixedSort.direction === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      if (fixedSort.key === 'status') {
        const statusA = getFixedExpenseStatus(a, currentMonthKey)
        const statusB = getFixedExpenseStatus(b, currentMonthKey)
        const rankDiff = fixedStatusOrder[statusA] - fixedStatusOrder[statusB]
        if (rankDiff !== 0) return rankDiff * directionFactor

        const startA = a.startMonth?.slice(0, 7) ?? ''
        const startB = b.startMonth?.slice(0, 7) ?? ''
        return startA.localeCompare(startB, 'fr') * directionFactor
      }

      if (fixedSort.key === 'description') {
        return a.description.localeCompare(b.description, 'fr') * directionFactor
      }

      if (fixedSort.key === 'amountTtc') {
        const amountA = parseFloat(a.amountHt) + parseFloat(a.taxAmount)
        const amountB = parseFloat(b.amountHt) + parseFloat(b.taxAmount)
        return (amountA - amountB) * directionFactor
      }

      if (fixedSort.key === 'paymentDay') {
        const dayA = a.paymentDay ?? 0
        const dayB = b.paymentDay ?? 0
        return (dayA - dayB) * directionFactor
      }

      const recA = a.recurrencePeriod ?? ''
      const recB = b.recurrencePeriod ?? ''
      return recA.localeCompare(recB, 'fr') * directionFactor
    })

    return sorted
  }, [allFixedData, fixedSort, currentMonthKey])

  const toggleFixedSort = (key: FixedSortKey) => {
    setFixedSort((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        }
      }

      return {
        key,
        direction: 'asc',
      }
    })
  }

  const renderSortIcon = (key: FixedSortKey) => {
    if (fixedSort.key !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-text-muted" />
    }

    return fixedSort.direction === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-text-secondary" />
      : <ChevronDown className="h-3.5 w-3.5 text-text-secondary" />
  }

  const sortHeader = (key: FixedSortKey, label: string) => (
    <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => toggleFixedSort(key)}>
      {label}
      {renderSortIcon(key)}
    </button>
  )

  const renderExpenseDescription = (expense: Expense) => (
    <>
      <div className="font-medium">{expense.description}</div>
      {expense.note && <div className="max-w-xs truncate text-xs text-text-secondary">{expense.note}</div>}
    </>
  )

  const renderExpenseActions = (expense: Expense) => (
    <div className="flex justify-end gap-1">
      <Button
        size="sm" iconOnly
        variant="ghost"
        onClick={() => openEditModal(expense)}
        title="Modifier"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        size="sm" iconOnly
        variant="ghost"
        onClick={() => setDeleteConfirmId(expense.id)}
        title="Supprimer"
        className="text-danger hover:bg-danger-soft"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )

  const variableExpenseColumns: DataTableColumn<Expense>[] = [
    { key: 'description', header: 'Description', cell: renderExpenseDescription },
    { key: 'date', header: 'Date', width: 'w-32', className: 'whitespace-nowrap', cell: (expense) => formatDate(expense.date) },
    {
      key: 'amount-ht',
      header: 'Montant HT',
      align: 'right',
      width: 'w-32',
      cell: (expense) => formatCurrency(expense.amountHt),
      footer: formatCurrency(variableExpensesSummary.totalHt),
    },
    {
      key: 'tax',
      header: 'TVA',
      align: 'right',
      width: 'w-28',
      cell: (expense) => <span className="text-text-secondary">{formatCurrency(expense.taxAmount)}</span>,
      footer: formatCurrency(variableExpensesSummary.totalTax),
    },
    {
      key: 'recoverable',
      header: 'Recuperable',
      align: 'right',
      width: 'w-40',
      cell: (expense) => (
        <>
          <span className="text-success-strong">
            {formatCurrency(parseFloat(expense.taxAmount) * (parseFloat(expense.taxRecoveryRate) / 100))}
          </span>
          <span className="ml-1 text-xs text-text-muted">({parseFloat(expense.taxRecoveryRate)}%)</span>
        </>
      ),
      footer: <span className="text-success-strong">{formatCurrency(variableExpensesSummary.totalRecoverable)}</span>,
    },
    { key: 'actions', header: 'Actions', align: 'right', width: 'w-24', cell: renderExpenseActions },
  ]

  const fixedLibraryColumns: DataTableColumn<Expense>[] = [
    { key: 'description', header: sortHeader('description', 'Description'), cell: renderExpenseDescription },
    {
      key: 'amount-ttc',
      header: sortHeader('amountTtc', 'Montant TTC'),
      align: 'right',
      width: 'w-36',
      cell: (expense) => formatCurrency(parseFloat(expense.amountHt) + parseFloat(expense.taxAmount)),
    },
    { key: 'payment-day', header: sortHeader('paymentDay', 'Jour'), align: 'center', numeric: true, width: 'w-24', cell: (expense) => expense.paymentDay },
    {
      key: 'status',
      header: sortHeader('status', 'Statut'),
      width: 'w-40',
      cell: (expense) => {
        const status = getFixedExpenseStatus(expense, currentMonthKey)
        const label = status === 'termine' ? 'Terminé' : status === 'a-venir' ? 'A venir' : 'En cours'
        const tone = status === 'termine' ? 'neutral' : status === 'a-venir' ? 'warning' : 'success'
        return (
          <span className="group relative inline-flex">
            <Badge tone={tone} className="cursor-help">
              {label}
            </Badge>
            <span className="pointer-events-none invisible absolute left-0 top-[calc(100%+6px)] z-20 whitespace-nowrap rounded-md bg-text-primary px-2 py-1 text-2xs font-medium text-white opacity-0 shadow-dropdown transition-opacity group-hover:visible group-hover:opacity-100">
              {getFixedExpenseStatusTooltip(expense)}
            </span>
          </span>
        )
      },
    },
    {
      key: 'recurrence',
      header: sortHeader('recurrence', 'Periodicite'),
      width: 'w-32',
      cell: (expense) =>
        expense.recurrencePeriod && (
          <Badge tone="accent">{recurrenceLabels[expense.recurrencePeriod as RecurrencePeriod]}</Badge>
        ),
    },
    { key: 'actions', header: 'Actions', align: 'right', width: 'w-24', cell: renderExpenseActions },
  ]

  const openCreateModal = (isFixed: boolean = false) => {
    setEditingExpense(null)
    setFormData({
      ...defaultFormData,
      isRecurring: isFixed,
      category: isFixed ? 'fixed' : 'one-time',
    })
    setError('')
    setIsModalOpen(true)
  }

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense)
    const ht = parseFloat(expense.amountHt)
    const tax = parseFloat(expense.taxAmount)
    const ttc = ht + tax
    setFormData({
      description: expense.description,
      date: expense.date,
      amountHt: expense.amountHt,
      taxAmount: expense.taxAmount,
      taxRecoveryRate: expense.taxRecoveryRate,
      category: expense.category as ExpenseCategory,
      isRecurring: expense.isRecurring,
      isIntraEu: expense.isIntraEu,
      recurrencePeriod: (expense.recurrencePeriod as RecurrencePeriod) || 'monthly',
      startMonth: expense.startMonth ? expense.startMonth.substring(0, 7) : `${new Date().getFullYear()}-01`,
      endMonth: expense.endMonth ? expense.endMonth.substring(0, 7) : '',
      paymentDay: expense.paymentDay?.toString() || '1',
      note: expense.note || '',
      inputMode: 'ht',
      amountTtc: ttc.toFixed(2),
      taxRate: ht > 0 ? ((tax / ht) * 100).toFixed(1) : '20',
    })
    setError('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingExpense(null)
    setFormData(defaultFormData)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    let amountHt: number
    let taxAmount: number

    if (formData.inputMode === 'ttc') {
      const ttc = parseFloat(formData.amountTtc) || 0
      const rate = parseFloat(formData.taxRate) || 0
      amountHt = ttc / (1 + rate / 100)
      taxAmount = ttc - amountHt
    } else {
      amountHt = parseFloat(formData.amountHt) || 0
      taxAmount = parseFloat(formData.taxAmount) || 0
    }

    // For recurring expenses, use the first day of start month as the date
    const expenseDate = formData.isRecurring
      ? `${formData.startMonth}-01`
      : formData.date

    const data: CreateExpenseInput = {
      description: formData.description.trim(),
      date: expenseDate,
      amountHt,
      taxAmount,
      taxRecoveryRate: parseFloat(formData.taxRecoveryRate) || 100,
      category: formData.category,
      isRecurring: formData.isRecurring,
      isIntraEu: formData.isIntraEu,
      recurrencePeriod: formData.isRecurring ? (formData.recurrencePeriod as RecurrencePeriod) : undefined,
      startMonth: formData.isRecurring ? `${formData.startMonth}-01` : undefined,
      endMonth: formData.isRecurring && formData.endMonth ? `${formData.endMonth}-01` : undefined,
      paymentDay: formData.isRecurring ? parseInt(formData.paymentDay) : undefined,
      note: formData.note.trim() || undefined,
    }

    try {
      if (editingExpense) {
        await updateMutation.mutateAsync({ id: editingExpense.id, data })
        showSuccess('Dépense modifiée avec succès')
      } else {
        await createMutation.mutateAsync(data)
        showSuccess('Dépense créée avec succès')
      }
      closeModal()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      setDeleteConfirmId(null)
      showSuccess('Dépense supprimée avec succès')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const updateFormField = (field: keyof ExpenseFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const calculatedValues = useMemo(() => {
    if (formData.inputMode === 'ttc') {
      const ttc = parseFloat(formData.amountTtc) || 0
      const rate = parseFloat(formData.taxRate) || 0
      const ht = ttc / (1 + rate / 100)
      const tax = ttc - ht
      return { ht, tax, ttc }
    } else {
      const ht = parseFloat(formData.amountHt) || 0
      const tax = parseFloat(formData.taxAmount) || 0
      return { ht, tax, ttc: ht + tax }
    }
  }, [formData.inputMode, formData.amountTtc, formData.taxRate, formData.amountHt, formData.taxAmount])

  const calculatedRecovery = useMemo(() => {
    const rate = parseFloat(formData.taxRecoveryRate) || 100
    return calculatedValues.tax * (rate / 100)
  }, [calculatedValues.tax, formData.taxRecoveryRate])

  const monthSelectOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    for (const year of [2024, 2025, 2026, 2027]) {
      for (let month = 1; month <= 12; month++) {
        const date = new Date(year, month - 1, 1)
        const value = `${year}-${month.toString().padStart(2, '0')}`
        const label = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
        options.push({ value, label })
      }
    }
    return options
  }, [])

  const endMonthOptions = useMemo(
    () => [{ value: '', label: 'En cours (pas de fin)' }, ...monthSelectOptions],
    [monthSelectOptions],
  )

  const paymentDayOptions = useMemo(
    () => Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
    [],
  )

  const modalTitle = editingExpense
    ? (formData.isRecurring ? 'Modifier la charge fixe' : 'Modifier la depense')
    : (formData.isRecurring ? 'Nouvelle charge fixe' : 'Nouvelle depense')

  const modalSubtitle = formData.isRecurring
    ? 'Remplissez les informations de la charge fixe'
    : 'Remplissez les informations de la depense'

  const submitLabel = editingExpense
    ? 'Enregistrer les modifications'
    : (formData.isRecurring ? 'Ajouter la charge fixe' : 'Ajouter la depense')

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-kpi-lg font-bold leading-tight tracking-[-0.02em] text-text-primary">
            Dépenses
          </h1>
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-3 self-start">
          {activeTab === 'monthly' ? (
            <MonthSwitch
              value={selectedMonth}
              onChange={setSelectedMonth}
              min="2024-01"
              max="2027-12"
            />
          ) : null}
          <Button
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => openCreateModal(activeTab === 'fixed')}
          >
            {activeTab === 'fixed' ? 'Ajouter une charge fixe' : 'Ajouter une dépense'}
          </Button>
        </div>
      </div>

      <PageTabs<'monthly' | 'fixed'>
        aria-label="Vue des dépenses"
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'monthly', label: 'Par mois' },
          { value: 'fixed', label: 'Charges fixes', count: allFixedSummary?.count || 0 },
        ]}
      />

      {activeTab === 'monthly' && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-4">
            <StatCard
              label="Total TTC du mois"
              value={isLoadingExpenses || isLoadingActiveFixed ? <Spinner size="sm" /> : formatCurrency(combinedSummary.totalTtc)}
              description={`${combinedSummary.count} depense(s)`}
              color="var(--dui-series-1)"
            />
            <StatCard
              label="TVA recuperable"
              value={isLoadingExpenses || isLoadingActiveFixed ? <Spinner size="sm" /> : formatCurrency(combinedSummary.totalRecoverable)}
              description={
                <Link to="/tva" className="font-medium text-accent hover:underline">
                  Voir la TVA à déclarer →
                </Link>
              }
              color="var(--dui-series-2)"
            />
            <StatCard
              label="Charges fixes actives"
              value={isLoadingActiveFixed ? <Spinner size="sm" /> : fixedExpensesSummary.count}
              description={isLoadingActiveFixed ? 'Chargement...' : `${formatCurrency(fixedExpensesSummary.totalTtc)} TTC`}
              color="var(--dui-series-5)"
            />
            <StatCard
              label="Dépenses ponctuelles"
              value={isLoadingExpenses ? <Spinner size="sm" /> : nonFixedExpenses.length}
              description={isLoadingExpenses ? 'Chargement...' : `${formatCurrency(variableExpensesSummary.totalTtc)} TTC`}
              color="var(--dui-series-3)"
              valueClassName="text-warning-strong"
            />
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-text-primary">
                  Charges fixes du mois
                </h2>
                <p className="text-xs text-text-secondary">
                  {formatMonth(`${selectedMonth}-01`)} - {fixedExpensesSummary.count} charge(s) active(s)
                </p>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-semibold text-text-primary">
                  {formatCurrency(fixedExpensesSummary.totalTtc)} TTC
                </div>
                <div className="text-xs text-text-secondary">{formatCurrency(fixedExpensesSummary.totalHt)} HT</div>
              </div>
            </div>

            {isLoadingActiveFixed ? (
              <div className="rounded-card border border-border bg-surface py-8 text-center ">
                <Spinner size="lg" />
              </div>
            ) : fixedExpensesSummary.count === 0 ? (
              <div className="rounded-card border border-border bg-surface p-8 text-center ">
                <p className="text-sm text-text-secondary">Aucune charge fixe active pour cette période.</p>
              </div>
            ) : (
              <DataTable
                columns={fixedExpenseColumns}
                rows={activeFixedData?.data ?? []}
                getRowKey={(expense) => expense.id}
                minWidth="min-w-150"
              />
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-text-primary">
                  Dépenses ponctuelles
                </h2>
                <p className="text-xs text-text-secondary">
                  {nonFixedExpenses.length} dépense(s) sur la période sélectionnée
                </p>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-semibold text-text-primary">
                  {formatCurrency(variableExpensesSummary.totalTtc)} TTC
                </div>
                <div className="text-xs text-text-secondary">
                  {formatCurrency(variableExpensesSummary.totalRecoverable)} récupérable
                </div>
              </div>
            </div>

            {isLoadingExpenses ? (
              <div className="rounded-card border border-border bg-surface py-8 text-center ">
                <Spinner size="lg" />
              </div>
            ) : !nonFixedExpenses.length ? (
              <div className="rounded-card border border-border bg-surface p-8 text-center ">
                <p className="text-sm text-text-secondary">Aucune dépense ponctuelle pour cette période.</p>
              </div>
            ) : (
              <DataTable
                columns={variableExpenseColumns}
                rows={nonFixedExpenses}
                getRowKey={(expense) => expense.id}
                footerLabel="Total"
                minWidth="min-w-200"
              />
            )}
          </section>
        </>
      )}

      {activeTab === 'fixed' && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              label="Charges fixes"
              value={isLoadingAllFixed ? <Spinner size="sm" /> : allFixedSummary?.count || 0}
              description="Actives dans votre plan de charges"
              color="var(--dui-series-5)"
            />
            <StatCard
              label="Coût mensuel estime"
              value={isLoadingAllFixed ? <Spinner size="sm" /> : formatCurrency(allFixedSummary?.monthlyTotal || 0)}
              description="Projection TTC"
              color="var(--dui-series-1)"
            />
            <StatCard
              label="Coût annuel estime"
              value={isLoadingAllFixed ? <Spinner size="sm" /> : formatCurrency(allFixedSummary?.yearlyTotal || 0)}
              description="Projection TTC"
              color="var(--dui-warning)"
              valueClassName="text-warning-strong"
            />
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-text-primary">
                  Bibliothèque des charges fixes
                </h2>
                <p className="text-xs text-text-secondary">
                  Visualisez et modifiez toutes les charges récurrentes
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
                <Repeat2 className="h-3.5 w-3.5" />
                {allFixedSummary?.count || 0} actif(s)
              </div>
            </div>

            {isLoadingAllFixed ? (
              <div className="rounded-card border border-border bg-surface py-8 text-center ">
                <Spinner size="lg" />
              </div>
            ) : !allFixedData?.data.length ? (
              <div className="rounded-card border border-border bg-surface p-8 text-center ">
                <Wallet className="mx-auto h-8 w-8 text-text-muted" />
                <p className="mt-3 text-sm text-text-secondary">Aucune charge fixe enregistrée.</p>
              </div>
            ) : (
              <DataTable
                columns={fixedLibraryColumns}
                rows={sortedFixedExpenses}
                getRowKey={(expense) => expense.id}
                minWidth="min-w-190"
              />
            )}
          </section>
        </>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={closeModal}
            aria-label="Fermer"
          />

          <div className="relative w-full max-w-140 overflow-hidden rounded-2xl border border-border bg-surface shadow-modal">
            <div className="flex items-center justify-between px-7 pt-6 pb-0">
              <div>
                <h3 className="font-display text-kpi-sm font-semibold tracking-[-0.02em] text-text-primary">
                  {modalTitle}
                </h3>
                <p className="mt-1 text-compact text-text-secondary">{modalSubtitle}</p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                aria-label="Fermer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[65vh] space-y-4.5 overflow-y-auto px-7 py-5">
                {error && (
                  <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
                    {error}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-compact font-medium text-text-primary">Description *</label>
                  <input
                    type="text"
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                    value={formData.description}
                    onChange={(e) => updateFormField('description', e.target.value)}
                    placeholder="Description de la depense..."
                    required
                  />
                </div>

                {!editingExpense && (
                  <Switch
                    checked={formData.isRecurring}
                    onChange={(e) => {
                      updateFormField('isRecurring', e.target.checked)
                      updateFormField('category', e.target.checked ? 'fixed' : 'one-time')
                    }}
                    label="Charge fixe (recurrente)"
                  />
                )}

                {!formData.isRecurring ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-compact font-medium text-text-primary">Date *</label>
                      <input
                        type="date"
                        className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary focus:border-accent focus:outline-none"
                        value={formData.date}
                        onChange={(e) => updateFormField('date', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-compact font-medium text-text-primary">Categorie *</label>
                      <Select
                        value={formData.category}
                        onChange={(e) => updateFormField('category', e.target.value)}
                        options={categoryOptions}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="block text-compact font-medium text-text-primary">Mois de debut *</label>
                        <Select
                          value={formData.startMonth}
                          onChange={(e) => updateFormField('startMonth', e.target.value)}
                          options={monthSelectOptions}
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-compact font-medium text-text-primary">Mois de fin</label>
                        <Select
                          value={formData.endMonth}
                          onChange={(e) => updateFormField('endMonth', e.target.value)}
                          options={endMonthOptions}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="block text-compact font-medium text-text-primary">Jour de paiement *</label>
                        <Select
                          value={formData.paymentDay}
                          onChange={(e) => updateFormField('paymentDay', e.target.value)}
                          options={paymentDayOptions}
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-compact font-medium text-text-primary">Periodicite *</label>
                        <Select
                          value={formData.recurrencePeriod}
                          onChange={(e) => updateFormField('recurrencePeriod', e.target.value)}
                          options={recurrenceOptions}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-compact font-medium text-text-primary">Categorie *</label>
                      <Select
                        value={formData.category}
                        onChange={(e) => updateFormField('category', e.target.value)}
                        options={categoryOptions}
                      />
                    </div>
                  </>
                )}

                {!formData.isRecurring && (
                  <Checkbox
                    checked={formData.isIntraEu}
                    onChange={(e) => {
                      updateFormField('isIntraEu', e.target.checked)
                      if (e.target.checked) {
                        updateFormField('taxAmount', '0')
                        updateFormField('taxRate', '0')
                      }
                    }}
                    label="Achat intracommunautaire (intra-UE)"
                    description="Auto-liquidation TVA"
                    alignTop
                  />
                )}

                <div className="space-y-2">
                  <label className="block text-compact font-medium text-text-primary">Mode de saisie</label>
                  <div className="flex flex-wrap items-center gap-4">
                    <Radio
                      name="inputMode"
                      checked={formData.inputMode === 'ttc'}
                      onChange={() => updateFormField('inputMode', 'ttc')}
                      label="TTC (toutes taxes)"
                    />
                    <Radio
                      name="inputMode"
                      checked={formData.inputMode === 'ht'}
                      onChange={() => updateFormField('inputMode', 'ht')}
                      label="HT (hors taxes)"
                    />
                  </div>
                </div>

                {formData.inputMode === 'ttc' ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_160px]">
                    <div className="space-y-1.5">
                      <label className="block text-compact font-medium text-text-primary">Montant TTC (EUR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary focus:border-accent focus:outline-none"
                        value={formData.amountTtc}
                        onChange={(e) => updateFormField('amountTtc', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-compact font-medium text-text-primary">Taux TVA</label>
                      <Select
                        value={formData.taxRate}
                        onChange={(e) => updateFormField('taxRate', e.target.value)}
                        options={taxRateOptions}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-compact font-medium text-text-primary">Montant HT (EUR) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary focus:border-accent focus:outline-none"
                        value={formData.amountHt}
                        onChange={(e) => updateFormField('amountHt', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-compact font-medium text-text-primary">Montant TVA (EUR)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary focus:border-accent focus:outline-none"
                        value={formData.taxAmount}
                        onChange={(e) => updateFormField('taxAmount', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-compact font-medium text-text-primary">Taux de recuperation TVA</label>
                  <Select
                    value={formData.taxRecoveryRate}
                    onChange={(e) => updateFormField('taxRecoveryRate', e.target.value)}
                    options={taxRecoveryRateOptions}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-compact font-medium text-text-primary">
                    Note <span className="text-xs font-normal text-text-muted">(optionnel)</span>
                  </label>
                  <textarea
                    className="min-h-10 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                    value={formData.note}
                    onChange={(e) => updateFormField('note', e.target.value)}
                    placeholder="Notes supplementaires..."
                    rows={2}
                  />
                </div>

                {(formData.inputMode === 'ttc' ? formData.amountTtc : formData.amountHt) && (
                  <div className="space-y-2 rounded-lg bg-accent-soft px-4 py-3.5">
                    <div className="flex items-center justify-between text-compact">
                      <span className="text-text-secondary">Montant HT :</span>
                      <span className="font-medium text-text-primary">{formatCurrency(calculatedValues.ht)}</span>
                    </div>
                    <div className="flex items-center justify-between text-compact">
                      <span className="text-text-secondary">TVA :</span>
                      <span className="font-medium text-text-primary">{formatCurrency(calculatedValues.tax)}</span>
                    </div>
                    <div className="flex items-center justify-between text-compact">
                      <span className="text-text-secondary">Total TTC :</span>
                      <span className="font-display text-base font-semibold text-text-primary">{formatCurrency(calculatedValues.ttc)}</span>
                    </div>
                    {calculatedValues.tax > 0 && (
                      <>
                        <div className="h-px w-full bg-border" />
                        <div className="flex items-center justify-between text-compact">
                          <span className="text-text-secondary">TVA recuperable :</span>
                          <span className="font-display text-base font-semibold text-success">{formatCurrency(calculatedRecovery)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="h-px w-full bg-border" />
              <div className="flex items-center justify-end gap-3 px-7 pt-4 pb-6">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  startIcon={createMutation.isPending || updateMutation.isPending ? null : <Check className="h-4 w-4" />}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    submitLabel
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Supprimer la dépense"
        message="Êtes-vous sûr de vouloir supprimer cette dépense ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}
