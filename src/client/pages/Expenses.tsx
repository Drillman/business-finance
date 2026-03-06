import { useState, useMemo } from 'react'
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useRecurringExpenses,
} from '../hooks/useExpenses'
import type { Expense, CreateExpenseInput, ExpenseCategory, RecurrencePeriod } from '@shared/types'
import { ArrowUpDown, ChevronDown, ChevronUp, Pencil, Plus, Repeat2, Trash2, Wallet } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useSnackbar } from '../contexts/SnackbarContext'
import { MonthSelect } from '../components/PeriodSelect'
import { AppButton } from '../components/ui/AppButton'
import { KpiCard } from '../components/ui/KpiCard'
import { FinanceTable, type FinanceTableColumn } from '../components/ui/FinanceTable'

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

const fixedExpenseColumns: FinanceTableColumn[] = [
  { key: 'description', label: 'Description', className: 'w-[320px]' },
  { key: 'payment-day', label: 'Jour', className: 'w-[92px] text-center' },
  { key: 'amount-ht', label: 'Montant HT', className: 'w-[170px] text-right' },
  { key: 'amount-ttc', label: 'Montant TTC', className: 'w-[170px] text-right' },
]

const variableExpenseColumns: FinanceTableColumn[] = [
  { key: 'description', label: 'Description', className: 'w-[300px]' },
  { key: 'date', label: 'Date', className: 'w-[130px]' },
  { key: 'amount-ht', label: 'Montant HT', className: 'w-[130px] text-right' },
  { key: 'tax', label: 'TVA', className: 'w-[120px] text-right' },
  { key: 'recoverable', label: 'Recuperable', className: 'w-[150px] text-right' },
  { key: 'amount-ttc', label: 'TTC', className: 'w-[130px] text-right' },
  { key: 'actions', label: 'Actions', className: 'w-[108px] text-right' },
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
      return <ArrowUpDown className="h-3.5 w-3.5 text-(--text-tertiary)" />
    }

    return fixedSort.direction === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-(--text-secondary)" />
      : <ChevronDown className="h-3.5 w-3.5 text-(--text-secondary)" />
  }

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

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-['Space_Grotesk'] text-[32px] font-bold leading-tight tracking-[-0.02em] text-(--text-primary)">
            Dépenses
          </h1>
          <p className="mt-1 text-sm text-(--text-secondary)">
            Pilotage des charges ponctuelles et des charges fixes
          </p>
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-3 self-start">
          {activeTab === 'monthly' ? (
            <MonthSelect
              value={selectedMonth}
              onChange={setSelectedMonth}
              years={[2027, 2026, 2025, 2024]}
            />
          ) : null}
          <AppButton
            startIcon={<Plus className="h-4 w-4" />}
            onClick={() => openCreateModal(activeTab === 'fixed')}
          >
            {activeTab === 'fixed' ? 'Ajouter une charge fixe' : 'Ajouter une dépense'}
          </AppButton>
        </div>
      </div>

      <div className="inline-flex h-10 items-center gap-1 rounded-lg border border-(--border-default) bg-(--color-base-200) p-1">
        <button
          type="button"
          className={[
            'inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors',
            activeTab === 'monthly'
              ? 'bg-(--card-bg) text-(--text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
              : 'text-(--text-secondary) hover:text-(--text-primary)',
          ].join(' ')}
          onClick={() => setActiveTab('monthly')}
        >
          Par mois
        </button>
        <button
          type="button"
          className={[
            'inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors',
            activeTab === 'fixed'
              ? 'bg-(--card-bg) text-(--text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
              : 'text-(--text-secondary) hover:text-(--text-primary)',
          ].join(' ')}
          onClick={() => setActiveTab('fixed')}
        >
          Charges fixes ({allFixedSummary?.count || 0})
        </button>
      </div>

      {activeTab === 'monthly' && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total TTC du mois"
              value={isLoadingExpenses || isLoadingActiveFixed ? <span className="loading loading-spinner loading-sm" /> : formatCurrency(combinedSummary.totalTtc)}
              description={`${combinedSummary.count} depense(s)`}
              accentColor="#818CF8"
            />
            <KpiCard
              title="TVA recuperable"
              value={isLoadingExpenses || isLoadingActiveFixed ? <span className="loading loading-spinner loading-sm" /> : formatCurrency(combinedSummary.totalRecoverable)}
              description="Deduction possible"
              accentColor="#34D399"
              valueClassName="text-[#047857]"
            />
            <KpiCard
              title="Charges fixes actives"
              value={isLoadingActiveFixed ? <span className="loading loading-spinner loading-sm" /> : fixedExpensesSummary.count}
              description={isLoadingActiveFixed ? 'Chargement...' : `${formatCurrency(fixedExpensesSummary.totalTtc)} TTC`}
              accentColor="#A78BFA"
            />
            <KpiCard
              title="Dépenses ponctuelles"
              value={isLoadingExpenses ? <span className="loading loading-spinner loading-sm" /> : nonFixedExpenses.length}
              description={isLoadingExpenses ? 'Chargement...' : `${formatCurrency(variableExpensesSummary.totalTtc)} TTC`}
              accentColor="#FBBF24"
              valueClassName="text-[#B45309]"
            />
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <h2 className="font-['Space_Grotesk'] text-xl font-semibold tracking-[-0.01em] text-(--text-primary)">
                  Charges fixes du mois
                </h2>
                <p className="text-xs text-(--text-secondary)">
                  {formatMonth(`${selectedMonth}-01`)} - {fixedExpensesSummary.count} charge(s) active(s)
                </p>
              </div>
              <div className="text-right">
                <div className="font-['Space_Grotesk'] text-lg font-semibold text-(--text-primary)">
                  {formatCurrency(fixedExpensesSummary.totalTtc)} TTC
                </div>
                <div className="text-xs text-(--text-secondary)">{formatCurrency(fixedExpensesSummary.totalHt)} HT</div>
              </div>
            </div>

            {isLoadingActiveFixed ? (
              <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) py-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <span className="loading loading-spinner loading-lg" />
              </div>
            ) : fixedExpensesSummary.count === 0 ? (
              <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) p-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <p className="text-sm text-(--text-secondary)">Aucune charge fixe active pour cette période.</p>
              </div>
            ) : (
              <FinanceTable columns={fixedExpenseColumns} minWidthClassName="min-w-[780px]">
                {activeFixedData?.data.map((expense, index) => {
                  const ht = parseFloat(expense.amountHt)
                  const ttc = ht + parseFloat(expense.taxAmount)
                  return (
                    <tr
                      key={expense.id}
                      className={[
                        'h-12 border-b border-(--border-default) align-middle',
                        index % 2 === 1 ? 'bg-(--color-base-200)/45' : 'bg-(--card-bg)',
                      ].join(' ')}
                    >
                      <td className="px-3 text-sm font-medium text-(--text-primary) md:px-4">{expense.description}</td>
                      <td className="px-3 text-center text-sm text-(--text-primary) md:px-4">{expense.paymentDay}</td>
                      <td className="px-3 text-right font-mono text-sm text-(--text-primary) md:px-4">{formatCurrency(ht)}</td>
                      <td className="px-3 text-right font-mono text-sm text-(--text-primary) md:px-4">{formatCurrency(ttc)}</td>
                    </tr>
                  )
                })}
              </FinanceTable>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <h2 className="font-['Space_Grotesk'] text-xl font-semibold tracking-[-0.01em] text-(--text-primary)">
                  Dépenses ponctuelles
                </h2>
                <p className="text-xs text-(--text-secondary)">
                  {nonFixedExpenses.length} dépense(s) sur la période sélectionnée
                </p>
              </div>
              <div className="text-right">
                <div className="font-['Space_Grotesk'] text-lg font-semibold text-(--text-primary)">
                  {formatCurrency(variableExpensesSummary.totalTtc)} TTC
                </div>
                <div className="text-xs text-(--text-secondary)">
                  {formatCurrency(variableExpensesSummary.totalRecoverable)} récupérable
                </div>
              </div>
            </div>

            {isLoadingExpenses ? (
              <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) py-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <span className="loading loading-spinner loading-lg" />
              </div>
            ) : !nonFixedExpenses.length ? (
              <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) p-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <p className="text-sm text-(--text-secondary)">Aucune dépense ponctuelle pour cette période.</p>
              </div>
            ) : (
              <FinanceTable columns={variableExpenseColumns} minWidthClassName="min-w-[1030px]">
                {nonFixedExpenses.map((expense, index) => {
                  const taxRecovery = parseFloat(expense.taxAmount) * (parseFloat(expense.taxRecoveryRate) / 100)
                  return (
                    <tr
                      key={expense.id}
                      className={[
                        'h-12 border-b border-(--border-default) align-middle',
                        index % 2 === 1 ? 'bg-(--color-base-200)/45' : 'bg-(--card-bg)',
                      ].join(' ')}
                    >
                      <td className="px-3 md:px-4">
                        <div className="font-medium text-(--text-primary)">{expense.description}</div>
                        {expense.note && (
                          <div className="max-w-xs truncate text-xs text-(--text-secondary)">
                            {expense.note}
                          </div>
                        )}
                      </td>
                      <td className="px-3 text-sm text-(--text-primary) md:px-4">{formatDate(expense.date)}</td>
                      <td className="px-3 text-right font-mono text-sm text-(--text-primary) md:px-4">{formatCurrency(expense.amountHt)}</td>
                      <td className="px-3 text-right font-mono text-sm text-(--text-secondary) md:px-4">{formatCurrency(expense.taxAmount)}</td>
                      <td className="px-3 text-right font-mono text-sm md:px-4">
                        <span className="text-[#15803D]">{formatCurrency(taxRecovery)}</span>
                        <span className="ml-1 text-[11px] text-(--text-tertiary)">({parseFloat(expense.taxRecoveryRate)}%)</span>
                      </td>
                      <td className="px-3 text-right font-mono text-sm text-(--text-primary) md:px-4">
                        {formatCurrency(parseFloat(expense.amountHt) + parseFloat(expense.taxAmount))}
                      </td>
                      <td className="px-3 md:px-4">
                        <div className="flex justify-end gap-1">
                          <AppButton
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => openEditModal(expense)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </AppButton>
                          <AppButton
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(expense.id)}
                            title="Supprimer"
                            className="text-(--color-error) hover:bg-[#FEE2E2]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </AppButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                <tr className="h-12 border-t-2 border-(--border-default) bg-(--card-bg) font-semibold">
                  <td colSpan={2} className="px-3 text-sm text-(--text-primary) md:px-4">Total</td>
                  <td className="px-3 text-right font-mono text-sm text-(--text-primary) md:px-4">{formatCurrency(variableExpensesSummary.totalHt)}</td>
                  <td className="px-3 text-right font-mono text-sm text-(--text-primary) md:px-4">{formatCurrency(variableExpensesSummary.totalTax)}</td>
                  <td className="px-3 text-right font-mono text-sm text-[#15803D] md:px-4">{formatCurrency(variableExpensesSummary.totalRecoverable)}</td>
                  <td className="px-3 text-right font-mono text-sm text-(--text-primary) md:px-4">{formatCurrency(variableExpensesSummary.totalTtc)}</td>
                  <td className="px-3 md:px-4" />
                </tr>
              </FinanceTable>
            )}
          </section>
        </>
      )}

      {activeTab === 'fixed' && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              title="Charges fixes"
              value={isLoadingAllFixed ? <span className="loading loading-spinner loading-sm" /> : allFixedSummary?.count || 0}
              description="Actives dans votre plan de charges"
              accentColor="#A78BFA"
            />
            <KpiCard
              title="Coût mensuel estime"
              value={isLoadingAllFixed ? <span className="loading loading-spinner loading-sm" /> : formatCurrency(allFixedSummary?.monthlyTotal || 0)}
              description="Projection TTC"
              accentColor="#3B82F6"
            />
            <KpiCard
              title="Coût annuel estime"
              value={isLoadingAllFixed ? <span className="loading loading-spinner loading-sm" /> : formatCurrency(allFixedSummary?.yearlyTotal || 0)}
              description="Projection TTC"
              accentColor="#F59E0B"
              valueClassName="text-[#B45309]"
            />
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <h2 className="font-['Space_Grotesk'] text-xl font-semibold tracking-[-0.01em] text-(--text-primary)">
                  Bibliothèque des charges fixes
                </h2>
                <p className="text-xs text-(--text-secondary)">
                  Visualisez et modifiez toutes les charges récurrentes
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4338CA]">
                <Repeat2 className="h-3.5 w-3.5" />
                {allFixedSummary?.count || 0} actif(s)
              </div>
            </div>

            {isLoadingAllFixed ? (
              <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) py-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <span className="loading loading-spinner loading-lg" />
              </div>
            ) : !allFixedData?.data.length ? (
              <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) p-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <Wallet className="mx-auto h-8 w-8 text-(--text-tertiary)" />
                <p className="mt-3 text-sm text-(--text-secondary)">Aucune charge fixe enregistrée.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse">
                    <thead>
                      <tr className="h-10 border-b border-(--border-default) bg-(--color-base-200) text-left">
                        <th className="w-55 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-(--text-secondary) md:px-4 md:text-xs">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleFixedSort('description')}
                          >
                            Description
                            {renderSortIcon('description')}
                          </button>
                        </th>
                        <th className="w-30 px-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-(--text-secondary) md:px-4 md:text-xs">
                          <button
                            type="button"
                            className="ml-auto inline-flex items-center gap-1"
                            onClick={() => toggleFixedSort('amountTtc')}
                          >
                            Montant TTC
                            {renderSortIcon('amountTtc')}
                          </button>
                        </th>
                        <th className="w-18 px-3 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-(--text-secondary) md:px-4 md:text-xs">
                          <button
                            type="button"
                            className="mx-auto inline-flex items-center gap-1"
                            onClick={() => toggleFixedSort('paymentDay')}
                          >
                            Jour
                            {renderSortIcon('paymentDay')}
                          </button>
                        </th>
                        <th className="w-48 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-(--text-secondary) md:px-4 md:text-xs">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleFixedSort('status')}
                          >
                            Statut
                            {renderSortIcon('status')}
                          </button>
                        </th>
                        <th className="w-30 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-(--text-secondary) md:px-4 md:text-xs">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => toggleFixedSort('recurrence')}
                          >
                            Periodicite
                            {renderSortIcon('recurrence')}
                          </button>
                        </th>
                        <th className="w-24 px-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-(--text-secondary) md:px-4 md:text-xs">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFixedExpenses.map((expense, index) => {
                        const ttc = parseFloat(expense.amountHt) + parseFloat(expense.taxAmount)
                        const status = getFixedExpenseStatus(expense, currentMonthKey)
                        const statusTooltip = getFixedExpenseStatusTooltip(expense)
                        const statusLabel = status === 'termine' ? 'Terminé' : status === 'a-venir' ? 'A venir' : 'En cours'
                        const statusClassName =
                          status === 'termine'
                            ? 'bg-[#F3F4F6] text-[#6B7280]'
                            : status === 'a-venir'
                              ? 'bg-[#FEF3C7] text-[#92400E]'
                              : 'bg-[#DCFCE7] text-[#15803D]'

                        return (
                          <tr
                            key={expense.id}
                            className={[
                              'h-12 border-b border-(--border-default) align-middle',
                              index % 2 === 1 ? 'bg-(--color-base-200)/45' : 'bg-(--card-bg)',
                            ].join(' ')}
                          >
                            <td className="px-3 md:px-4">
                              <div className="font-medium text-(--text-primary)">{expense.description}</div>
                              {expense.note && (
                                <div className="max-w-xs truncate text-xs text-(--text-secondary)">{expense.note}</div>
                              )}
                            </td>
                            <td className="px-3 text-right font-mono text-sm text-(--text-primary) md:px-4">{formatCurrency(ttc)}</td>
                            <td className="px-3 text-center text-sm text-(--text-primary) md:px-4">{expense.paymentDay}</td>
                            <td className="px-3 text-sm md:px-4">
                              <span className="group relative inline-flex">
                                <span className={`inline-flex w-fit cursor-help rounded-full px-2 py-1 text-[11px] font-semibold ${statusClassName}`}>
                                  {statusLabel}
                                </span>
                                <span className="pointer-events-none invisible absolute left-0 top-[calc(100%+6px)] z-20 whitespace-nowrap rounded-md bg-[#111827] px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100">
                                  {statusTooltip}
                                </span>
                              </span>
                            </td>
                            <td className="px-3 md:px-4">
                              <span className="inline-flex rounded-full bg-[#EEF2FF] px-2 py-1 text-[11px] font-semibold text-[#4338CA]">
                                {expense.recurrencePeriod && recurrenceLabels[expense.recurrencePeriod as RecurrencePeriod]}
                              </span>
                            </td>
                            <td className="px-3 md:px-4">
                              <div className="flex justify-end gap-1">
                                <AppButton
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => openEditModal(expense)}
                                  title="Modifier"
                                >
                                  <Pencil className="h-4 w-4" />
                                </AppButton>
                                <AppButton
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => setDeleteConfirmId(expense.id)}
                                  title="Supprimer"
                                  className="text-(--color-error) hover:bg-[#FEE2E2]"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </AppButton>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              {editingExpense
                ? (formData.isRecurring ? 'Modifier la charge fixe' : 'Modifier la dépense')
                : (formData.isRecurring ? 'Nouvelle charge fixe' : 'Nouvelle dépense')}
            </h3>

            {error && (
              <div className="alert alert-error mb-4">
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">Description *</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.description}
                    onChange={(e) => updateFormField('description', e.target.value)}
                    placeholder="Description de la dépense..."
                    required
                  />
                </div>

                {/* Toggle for expense type - only show when creating */}
                {!editingExpense && (
                  <div className="form-control md:col-span-2">
                    <label className="label cursor-pointer justify-start gap-3">
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={formData.isRecurring}
                        onChange={(e) => {
                          updateFormField('isRecurring', e.target.checked)
                          updateFormField('category', e.target.checked ? 'fixed' : 'one-time')
                        }}
                      />
                      <span className="label-text">Charge fixe (récurrente)</span>
                    </label>
                  </div>
                )}

                {/* Date field for non-recurring */}
                {!formData.isRecurring && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Date *</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered w-full"
                      value={formData.date}
                      onChange={(e) => updateFormField('date', e.target.value)}
                      required
                    />
                  </div>
                )}

                {/* Fields for recurring expenses */}
                {formData.isRecurring && (
                  <>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Mois de début *</span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        value={formData.startMonth}
                        onChange={(e) => updateFormField('startMonth', e.target.value)}
                        required
                      >
                        {monthSelectOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Mois de fin (optionnel)</span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        value={formData.endMonth}
                        onChange={(e) => updateFormField('endMonth', e.target.value)}
                      >
                        <option value="">En cours (pas de fin)</option>
                        {monthSelectOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Jour de paiement *</span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        value={formData.paymentDay}
                        onChange={(e) => updateFormField('paymentDay', e.target.value)}
                        required
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Périodicité *</span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        value={formData.recurrencePeriod}
                        onChange={(e) => updateFormField('recurrencePeriod', e.target.value)}
                        required
                      >
                        {Object.entries(recurrenceLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Catégorie *</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={formData.category}
                    onChange={(e) => updateFormField('category', e.target.value)}
                  >
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Intra-EU checkbox - only for non-recurring expenses */}
                {!formData.isRecurring && (
                  <div className="form-control md:col-span-2">
                    <label className="label cursor-pointer justify-start gap-3">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary"
                        checked={formData.isIntraEu}
                        onChange={(e) => {
                          updateFormField('isIntraEu', e.target.checked)
                          // When intra-EU is checked, set tax amount to 0 (auto-liquidation)
                          if (e.target.checked) {
                            updateFormField('taxAmount', '0')
                            updateFormField('taxRate', '0')
                          }
                        }}
                      />
                      <div>
                        <span className="label-text font-medium">Achat intracommunautaire (intra-UE)</span>
                        <span className="label-text-alt block text-xs text-base-content/60">
                          Auto-liquidation TVA - La TVA sera declaree mais non payee au fournisseur
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                {/* Amount input mode toggle */}
                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">Mode de saisie du montant</span>
                  </label>
                  <div className="flex gap-2">
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="inputMode"
                        className="radio radio-primary"
                        checked={formData.inputMode === 'ttc'}
                        onChange={() => updateFormField('inputMode', 'ttc')}
                      />
                      <span className="label-text">TTC (toutes taxes comprises)</span>
                    </label>
                    <label className="label cursor-pointer gap-2">
                      <input
                        type="radio"
                        name="inputMode"
                        className="radio radio-primary"
                        checked={formData.inputMode === 'ht'}
                        onChange={() => updateFormField('inputMode', 'ht')}
                      />
                      <span className="label-text">HT (hors taxes)</span>
                    </label>
                  </div>
                </div>

                {formData.inputMode === 'ttc' ? (
                  <>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Montant TTC (€) *</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input input-bordered w-full"
                        value={formData.amountTtc}
                        onChange={(e) => updateFormField('amountTtc', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Taux TVA (%)</span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        value={formData.taxRate}
                        onChange={(e) => updateFormField('taxRate', e.target.value)}
                      >
                        <option value="0">0% (Exonéré)</option>
                        <option value="5.5">5.5%</option>
                        <option value="10">10%</option>
                        <option value="20">20% (Taux normal)</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Montant HT (€) *</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input input-bordered w-full"
                        value={formData.amountHt}
                        onChange={(e) => updateFormField('amountHt', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Montant TVA (€)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input input-bordered w-full"
                        value={formData.taxAmount}
                        onChange={(e) => updateFormField('taxAmount', e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Taux de récupération TVA (%)</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={formData.taxRecoveryRate}
                    onChange={(e) => updateFormField('taxRecoveryRate', e.target.value)}
                  >
                    <option value="100">100% (Récupération totale)</option>
                    <option value="80">80% (Récupération partielle)</option>
                    <option value="0">0% (Non récupérable)</option>
                  </select>
                </div>

                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">Note</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    value={formData.note}
                    onChange={(e) => updateFormField('note', e.target.value)}
                    placeholder="Notes supplémentaires..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Calculated totals */}
              {(formData.inputMode === 'ttc' ? formData.amountTtc : formData.amountHt) && (
                <div className="mt-4 p-4 bg-base-200 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/70">Montant HT :</span>
                    <span className="font-medium">{formatCurrency(calculatedValues.ht)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/70">TVA :</span>
                    <span className="font-medium">{formatCurrency(calculatedValues.tax)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/70">Total TTC :</span>
                    <span className="text-lg font-bold">{formatCurrency(calculatedValues.ttc)}</span>
                  </div>
                  {calculatedValues.tax > 0 && (
                    <div className="flex justify-between items-center border-t border-base-300 pt-2 mt-2">
                      <span className="text-base-content/70">TVA récupérable :</span>
                      <span className="text-lg font-bold text-success">{formatCurrency(calculatedRecovery)}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="modal-action">
                <button type="button" className="btn" onClick={closeModal}>
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : editingExpense ? (
                    'Enregistrer'
                  ) : (
                    'Créer'
                  )}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={closeModal}></div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title="Supprimer la dépense"
        message="Êtes-vous sûr de vouloir supprimer cette dépense ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}
