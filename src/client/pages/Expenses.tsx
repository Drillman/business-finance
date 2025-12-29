import { useState, useMemo } from 'react'
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useExpenseMonthlySummary,
  useRecurringExpenses,
} from '../hooks/useExpenses'
import type { Expense, CreateExpenseInput, ExpenseCategory, RecurrencePeriod } from '@shared/types'

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
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

const categoryColors: Record<ExpenseCategory, string> = {
  fixed: 'badge-primary',
  'one-time': 'badge-secondary',
  recurring: 'badge-accent',
  professional: 'badge-info',
  other: 'badge-ghost',
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
  recurrencePeriod: RecurrencePeriod | ''
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
  recurrencePeriod: '',
  note: '',
  inputMode: 'ttc',
  amountTtc: '',
  taxRate: '20',
}

export default function Expenses() {
  const [activeTab, setActiveTab] = useState<'monthly' | 'recurring'>('monthly')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('')
  const [recurringFilter, setRecurringFilter] = useState<'all' | 'recurring' | 'one-time'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [formData, setFormData] = useState<ExpenseFormData>(defaultFormData)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [year, month] = selectedMonth.split('-').map(Number)

  const { data: expensesData, isLoading: isLoadingExpenses } = useExpenses({
    month: selectedMonth,
    category: categoryFilter || undefined,
    isRecurring: recurringFilter === 'all' ? undefined : recurringFilter === 'recurring',
  })

  const { data: summary, isLoading: isLoadingSummary } = useExpenseMonthlySummary(year, month)
  const { data: recurringData, isLoading: isLoadingRecurring } = useRecurringExpenses()

  const createMutation = useCreateExpense()
  const updateMutation = useUpdateExpense()
  const deleteMutation = useDeleteExpense()

  const calculatedSummary = useMemo(() => {
    if (!summary) return null

    return {
      totalHt: parseFloat(summary.totalHt),
      totalTax: parseFloat(summary.totalTax),
      recoverableTax: parseFloat(summary.recoverableTax),
      count: summary.count,
      byCategory: summary.byCategory,
    }
  }, [summary])

  const recurringSummary = useMemo(() => {
    if (!recurringData?.data) return null

    let monthlyTotal = 0
    let yearlyTotal = 0

    recurringData.data.forEach((expense) => {
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
      count: recurringData.data.length,
      monthlyTotal,
      yearlyTotal,
    }
  }, [recurringData])

  const openCreateModal = () => {
    setEditingExpense(null)
    setFormData(defaultFormData)
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
      recurrencePeriod: (expense.recurrencePeriod as RecurrencePeriod) || '',
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

    const data: CreateExpenseInput = {
      description: formData.description.trim(),
      date: formData.date,
      amountHt,
      taxAmount,
      taxRecoveryRate: parseFloat(formData.taxRecoveryRate) || 100,
      category: formData.category,
      isRecurring: formData.isRecurring,
      recurrencePeriod: formData.isRecurring ? (formData.recurrencePeriod as RecurrencePeriod) : undefined,
      note: formData.note.trim() || undefined,
    }

    try {
      if (editingExpense) {
        await updateMutation.mutateAsync({ id: editingExpense.id, data })
      } else {
        await createMutation.mutateAsync(data)
      }
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      setDeleteConfirmId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
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
    const now = new Date()
    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
      const label = date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
      options.push({ value, label })
    }
    return options
  }, [])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dépenses</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Ajouter une dépense
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
          className={`tab ${activeTab === 'recurring' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('recurring')}
        >
          Récurrentes ({recurringSummary?.count || 0})
        </button>
      </div>

      {activeTab === 'monthly' && (
        <>
      {/* Monthly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Total HT</div>
          <div className="stat-value text-lg">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(calculatedSummary?.totalHt || 0)
            )}
          </div>
          <div className="stat-desc">{calculatedSummary?.count || 0} dépense(s)</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">TVA payée</div>
          <div className="stat-value text-lg text-warning">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(calculatedSummary?.totalTax || 0)
            )}
          </div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">TVA récupérable</div>
          <div className="stat-value text-lg text-success">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(calculatedSummary?.recoverableTax || 0)
            )}
          </div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Total TTC</div>
          <div className="stat-value text-lg">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency((calculatedSummary?.totalHt || 0) + (calculatedSummary?.totalTax || 0))
            )}
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {calculatedSummary && calculatedSummary.byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {calculatedSummary.byCategory.map((cat) => (
            <div key={cat.category} className="badge badge-lg gap-2">
              <span className={`badge badge-sm ${categoryColors[cat.category as ExpenseCategory]}`}>
                {categoryLabels[cat.category as ExpenseCategory]}
              </span>
              {formatCurrency(cat.total)} ({cat.count})
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Mois</span>
          </label>
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
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Catégorie</span>
          </label>
          <select
            className="select select-bordered"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | '')}
          >
            <option value="">Toutes les catégories</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Type</span>
          </label>
          <select
            className="select select-bordered"
            value={recurringFilter}
            onChange={(e) => setRecurringFilter(e.target.value as 'all' | 'recurring' | 'one-time')}
          >
            <option value="all">Toutes</option>
            <option value="recurring">Récurrentes uniquement</option>
            <option value="one-time">Ponctuelles uniquement</option>
          </select>
        </div>
      </div>

      {/* Expense List */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          {isLoadingExpenses ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : !expensesData?.data.length ? (
            <p className="text-base-content/60">Aucune dépense pour cette période.</p>
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
                    <th>Récurrence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expensesData.data.map((expense) => {
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
                        <td>
                          {expense.isRecurring ? (
                            <span className="badge badge-accent badge-sm">
                              {expense.recurrencePeriod && recurrenceLabels[expense.recurrencePeriod as RecurrencePeriod]}
                            </span>
                          ) : (
                            <span className="text-base-content/40">-</span>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              className="btn btn-sm btn-ghost btn-square"
                              onClick={() => openEditModal(expense)}
                              title="Modifier"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            {deleteConfirmId === expense.id ? (
                              <div className="flex gap-1">
                                <button
                                  className="btn btn-sm btn-error"
                                  onClick={() => handleDelete(expense.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  Oui
                                </button>
                                <button
                                  className="btn btn-sm btn-ghost"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  Non
                                </button>
                              </div>
                            ) : (
                              <button
                                className="btn btn-sm btn-ghost btn-square text-error"
                                onClick={() => setDeleteConfirmId(expense.id)}
                                title="Supprimer"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
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

      {activeTab === 'recurring' && (
        <>
          {/* Recurring Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Dépenses récurrentes</div>
              <div className="stat-value text-lg">
                {isLoadingRecurring ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  recurringSummary?.count || 0
                )}
              </div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Coût mensuel estimé</div>
              <div className="stat-value text-lg text-warning">
                {isLoadingRecurring ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  formatCurrency(recurringSummary?.monthlyTotal || 0)
                )}
              </div>
              <div className="stat-desc">TTC</div>
            </div>
            <div className="stat bg-base-100 rounded-box shadow">
              <div className="stat-title">Coût annuel estimé</div>
              <div className="stat-value text-lg text-error">
                {isLoadingRecurring ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  formatCurrency(recurringSummary?.yearlyTotal || 0)
                )}
              </div>
              <div className="stat-desc">TTC</div>
            </div>
          </div>

          {/* Recurring Expenses List */}
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              {isLoadingRecurring ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner loading-lg"></span>
                </div>
              ) : !recurringData?.data.length ? (
                <p className="text-base-content/60">Aucune dépense récurrente enregistrée.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Catégorie</th>
                        <th>Périodicité</th>
                        <th className="text-right">Montant TTC</th>
                        <th className="text-right">Coût mensuel</th>
                        <th className="text-right">Coût annuel</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurringData.data.map((expense) => {
                        const ht = parseFloat(expense.amountHt)
                        const tax = parseFloat(expense.taxAmount)
                        const ttc = ht + tax
                        let monthly = 0
                        let yearly = 0
                        switch (expense.recurrencePeriod) {
                          case 'monthly':
                            monthly = ttc
                            yearly = ttc * 12
                            break
                          case 'quarterly':
                            monthly = ttc / 3
                            yearly = ttc * 4
                            break
                          case 'yearly':
                            monthly = ttc / 12
                            yearly = ttc
                            break
                        }
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
                            <td>
                              <span className={`badge ${categoryColors[expense.category as ExpenseCategory]}`}>
                                {categoryLabels[expense.category as ExpenseCategory]}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-accent">
                                {expense.recurrencePeriod && recurrenceLabels[expense.recurrencePeriod as RecurrencePeriod]}
                              </span>
                            </td>
                            <td className="text-right font-mono">
                              {formatCurrency(ttc)}
                            </td>
                            <td className="text-right font-mono text-warning">
                              {formatCurrency(monthly)}
                            </td>
                            <td className="text-right font-mono text-error">
                              {formatCurrency(yearly)}
                            </td>
                            <td>
                              <div className="flex gap-1">
                                <button
                                  className="btn btn-sm btn-ghost btn-square"
                                  onClick={() => openEditModal(expense)}
                                  title="Modifier"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                {deleteConfirmId === expense.id ? (
                                  <div className="flex gap-1">
                                    <button
                                      className="btn btn-sm btn-error"
                                      onClick={() => handleDelete(expense.id)}
                                      disabled={deleteMutation.isPending}
                                    >
                                      Oui
                                    </button>
                                    <button
                                      className="btn btn-sm btn-ghost"
                                      onClick={() => setDeleteConfirmId(null)}
                                    >
                                      Non
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="btn btn-sm btn-ghost btn-square text-error"
                                    onClick={() => setDeleteConfirmId(expense.id)}
                                    title="Supprimer"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
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
              {editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}
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
                    className="input input-bordered"
                    value={formData.description}
                    onChange={(e) => updateFormField('description', e.target.value)}
                    placeholder="Description de la dépense..."
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Date *</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={formData.date}
                    onChange={(e) => updateFormField('date', e.target.value)}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Catégorie *</span>
                  </label>
                  <select
                    className="select select-bordered"
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

                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">Mode de saisie</span>
                  </label>
                  <div className="join">
                    <button
                      type="button"
                      className={`btn join-item ${formData.inputMode === 'ttc' ? 'btn-active' : ''}`}
                      onClick={() => updateFormField('inputMode', 'ttc')}
                    >
                      Montant TTC
                    </button>
                    <button
                      type="button"
                      className={`btn join-item ${formData.inputMode === 'ht' ? 'btn-active' : ''}`}
                      onClick={() => updateFormField('inputMode', 'ht')}
                    >
                      Montant HT
                    </button>
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
                        className="input input-bordered"
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
                        className="select select-bordered"
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
                        className="input input-bordered"
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
                        className="input input-bordered"
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
                    className="select select-bordered"
                    value={formData.taxRecoveryRate}
                    onChange={(e) => updateFormField('taxRecoveryRate', e.target.value)}
                  >
                    <option value="100">100% (Récupération totale)</option>
                    <option value="80">80% (Récupération partielle)</option>
                    <option value="0">0% (Non récupérable)</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={formData.isRecurring}
                      onChange={(e) => updateFormField('isRecurring', e.target.checked)}
                    />
                    <span className="label-text">Dépense récurrente</span>
                  </label>
                </div>

                {formData.isRecurring && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Période de récurrence *</span>
                    </label>
                    <select
                      className="select select-bordered"
                      value={formData.recurrencePeriod}
                      onChange={(e) => updateFormField('recurrencePeriod', e.target.value)}
                      required={formData.isRecurring}
                    >
                      <option value="">Sélectionner...</option>
                      {Object.entries(recurrenceLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">Note</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered"
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
    </div>
  )
}
