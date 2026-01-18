import { useState, useMemo } from 'react'
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useRecurringExpenses,
} from '../hooks/useExpenses'
import type { Expense, CreateExpenseInput, ExpenseCategory, RecurrencePeriod } from '@shared/types'
import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useSnackbar } from '../contexts/SnackbarContext'

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
    const variableCount = expensesData?.data.filter(e => e.category !== 'fixed').length || 0
    return {
      totalHt: variableExpensesSummary.totalHt + fixedExpensesSummary.totalHt,
      totalTax: variableExpensesSummary.totalTax + fixedExpensesSummary.totalTax,
      totalTtc: variableExpensesSummary.totalTtc + fixedExpensesSummary.totalTtc,
      totalRecoverable: variableExpensesSummary.totalRecoverable + fixedExpensesSummary.totalRecoverable,
      count: variableCount + fixedExpensesSummary.count,
    }
  }, [variableExpensesSummary, fixedExpensesSummary, expensesData])

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

  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    for (const year of [2026, 2025, 2024]) {
      for (let month = 12; month >= 1; month--) {
        const date = new Date(year, month - 1, 1)
        const value = `${year}-${month.toString().padStart(2, '0')}`
        const label = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
        options.push({ value, label })
      }
    }
    return options
  }, [])

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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dépenses</h1>
        <button
          className="btn btn-primary"
          onClick={() => openCreateModal(activeTab === 'fixed')}
        >
          {activeTab === 'fixed' ? 'Ajouter une charge fixe' : 'Ajouter une dépense'}
        </button>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-boxed mb-6">
        <button
          role="tab"
          className={`tab ${activeTab === 'monthly' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          Par mois
        </button>
        <button
          role="tab"
          className={`tab ${activeTab === 'fixed' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('fixed')}
        >
          Charges fixes ({allFixedSummary?.count || 0})
        </button>
      </div>

      {activeTab === 'monthly' && (
        <>
          {/* Month Selector */}
          <div className="form-control mb-6">
            <label className="label">
              <span className="label-text">Mois</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-square btn-sm"
                onClick={() => {
                  const [year, month] = selectedMonth.split('-').map(Number)
                  const prevDate = new Date(year, month - 2, 1)
                  setSelectedMonth(`${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`)
                }}
                title="Mois précédent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                className="select select-bordered"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-square btn-sm"
                onClick={() => {
                  const [year, month] = selectedMonth.split('-').map(Number)
                  const nextDate = new Date(year, month, 1)
                  setSelectedMonth(`${nextDate.getFullYear()}-${(nextDate.getMonth() + 1).toString().padStart(2, '0')}`)
                }}
                title="Mois suivant"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Monthly Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Total HT</div>
              <div className="stat-value text-lg">
                {isLoadingExpenses || isLoadingActiveFixed ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  formatCurrency(combinedSummary.totalHt)
                )}
              </div>
              <div className="stat-desc">{combinedSummary.count} dépense(s)</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">TVA récupérable</div>
              <div className="stat-value text-lg text-success">
                {isLoadingExpenses || isLoadingActiveFixed ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  formatCurrency(combinedSummary.totalRecoverable)
                )}
              </div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Total TTC</div>
              <div className="stat-value text-lg">
                {isLoadingExpenses || isLoadingActiveFixed ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  formatCurrency(combinedSummary.totalTtc)
                )}
              </div>
            </div>
          </div>

          {/* Fixed Expenses Summary Card */}
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body">
              <h2 className="card-title text-base">Charges fixes du mois</h2>
              {isLoadingActiveFixed ? (
                <div className="flex justify-center py-4">
                  <span className="loading loading-spinner loading-sm"></span>
                </div>
              ) : fixedExpensesSummary.count === 0 ? (
                <p className="text-base-content/60">Aucune charge fixe active pour ce mois.</p>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-base-content/70">{fixedExpensesSummary.count} charge(s) fixe(s)</span>
                    <div className="text-right">
                      <span className="text-xl font-bold">{formatCurrency(fixedExpensesSummary.totalTtc)} TTC</span> / <span className="text-sm text-base-content/70">{formatCurrency(fixedExpensesSummary.totalHt)} HT</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Jour</th>
                          <th className="text-right">Montant HT</th>
                          <th className="text-right">Montant TTC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeFixedData?.data.map((expense) => {
                          const ht = parseFloat(expense.amountHt)
                          const ttc = ht + parseFloat(expense.taxAmount)
                          return (
                            <tr key={expense.id}>
                              <td>{expense.description}</td>
                              <td>{expense.paymentDay}</td>
                              <td className="text-right font-mono">{formatCurrency(ht)}</td>
                              <td className="text-right font-mono">{formatCurrency(ttc)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>


          {/* Non-recurring Expense List */}
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-base">Dépenses ponctuelles</h2>
              {isLoadingExpenses ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : !expensesData?.data.filter(e => e.category !== 'fixed').length ? (
                <p className="text-base-content/60">Aucune dépense ponctuelle pour cette période.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Date</th>
                        <th className="text-right">Montant HT</th>
                        <th className="text-right">TVA</th>
                        <th className="text-right">Récupérable</th>
                        <th className="text-right">TTC</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensesData.data.filter(e => e.category !== 'fixed').map((expense) => {
                        const taxRecovery = parseFloat(expense.taxAmount) * (parseFloat(expense.taxRecoveryRate) / 100)
                        return (
                          <tr key={expense.id} className="hover">
                            <td>
                              <div className="font-medium">{expense.description}</div>
                              {expense.note && (
                                <div className="text-sm text-base-content/60 truncate max-w-xs">
                                  {expense.note}
                                </div>
                              )}
                            </td>
                            <td>{formatDate(expense.date)}</td>
                            <td className="text-right font-mono">
                              {formatCurrency(expense.amountHt)}
                            </td>
                            <td className="text-right font-mono text-base-content/60">
                              {formatCurrency(expense.taxAmount)}
                            </td>
                            <td className="text-right font-mono">
                              <span className="text-success">{formatCurrency(taxRecovery)}</span>
                              <span className="text-xs text-base-content/50 ml-1">
                                ({parseFloat(expense.taxRecoveryRate)}%)
                              </span>
                            </td>
                            <td className="text-right font-mono">
                              {formatCurrency(parseFloat(expense.amountHt) + parseFloat(expense.taxAmount))}
                            </td>
                            <td>
                              <div className="flex gap-1">
                                <button
                                  className="btn btn-sm btn-ghost btn-square"
                                  onClick={() => openEditModal(expense)}
                                  title="Modifier"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  className="btn btn-sm btn-ghost btn-square text-error"
                                  onClick={() => setDeleteConfirmId(expense.id)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold border-t-2">
                        <td colSpan={2}>Total</td>
                        <td className="text-right font-mono">{formatCurrency(variableExpensesSummary.totalHt)}</td>
                        <td className="text-right font-mono">{formatCurrency(variableExpensesSummary.totalTax)}</td>
                        <td className="text-right font-mono text-success">{formatCurrency(variableExpensesSummary.totalRecoverable)}</td>
                        <td className="text-right font-mono">{formatCurrency(variableExpensesSummary.totalTtc)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'fixed' && (
        <>
          {/* Fixed Expenses Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Charges fixes</div>
              <div className="stat-value text-lg">
                {isLoadingAllFixed ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  allFixedSummary?.count || 0
                )}
              </div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Coût mensuel estimé</div>
              <div className="stat-value text-lg text-base-content/70">
                {isLoadingAllFixed ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  formatCurrency(allFixedSummary?.monthlyTotal || 0)
                )}
              </div>
              <div className="stat-desc">TTC</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Coût annuel estimé</div>
              <div className="stat-value text-lg text-base-content/70">
                {isLoadingAllFixed ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  formatCurrency(allFixedSummary?.yearlyTotal || 0)
                )}
              </div>
              <div className="stat-desc">TTC</div>
            </div>
          </div>

          {/* Fixed Expenses List */}
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              {isLoadingAllFixed ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : !allFixedData?.data.length ? (
                <p className="text-base-content/60">Aucune charge fixe enregistrée.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th className="text-right">Montant TTC</th>
                        <th>Jour</th>
                        <th>Début</th>
                        <th>Fin</th>
                        <th>Périodicité</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allFixedData.data.map((expense) => {
                        const ttc = parseFloat(expense.amountHt) + parseFloat(expense.taxAmount)
                        return (
                          <tr key={expense.id} className="hover">
                            <td>
                              <div className="font-medium">{expense.description}</div>
                              {expense.note && (
                                <div className="text-sm text-base-content/60 truncate max-w-xs">
                                  {expense.note}
                                </div>
                              )}
                            </td>
                            <td className="text-right font-mono">
                              {formatCurrency(ttc)}
                            </td>
                            <td>{expense.paymentDay}</td>
                            <td>{expense.startMonth ? formatMonth(expense.startMonth) : '-'}</td>
                            <td>
                              {expense.endMonth ? (
                                formatMonth(expense.endMonth)
                              ) : (
                                <span className="badge badge-success badge-sm">En cours</span>
                              )}
                            </td>
                            <td>
                              <span className="badge badge-accent badge-sm">
                                {expense.recurrencePeriod && recurrenceLabels[expense.recurrencePeriod as RecurrencePeriod]}
                              </span>
                            </td>
                            <td>
                              <div className="flex gap-1">
                                <button
                                  className="btn btn-sm btn-ghost btn-square"
                                  onClick={() => openEditModal(expense)}
                                  title="Modifier"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  className="btn btn-sm btn-ghost btn-square text-error"
                                  onClick={() => setDeleteConfirmId(expense.id)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
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
