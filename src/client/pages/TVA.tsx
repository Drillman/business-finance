import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  useTaxPayments,
  useCreateTaxPayment,
  useUpdateTaxPayment,
  useDeleteTaxPayment,
  useTvaSummary,
  useMonthlyTva,
} from '../hooks/useTva'
import type { TaxPayment, CreateTaxPaymentInput } from '@shared/types'
import { Pencil, Trash2, Check, Clock, AlertTriangle, AlertCircle, CalendarClock, Minus } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useSnackbar } from '../contexts/SnackbarContext'

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

function formatMonth(month: number): string {
  const date = new Date(2024, month - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'short' })
}

function formatPeriodMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
}

const currentYear = new Date().getFullYear()

interface TaxPaymentFormData {
  amount: string
  periodMonth: string
  status: 'pending' | 'paid'
  paymentDate: string
  reference: string
  note: string
}

const defaultFormData: TaxPaymentFormData = {
  amount: '',
  periodMonth: '',
  status: 'pending',
  paymentDate: '',
  reference: '',
  note: '',
}

export default function TVA() {
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<TaxPayment | null>(null)
  const [formData, setFormData] = useState<TaxPaymentFormData>(defaultFormData)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { showSuccess, showError } = useSnackbar()

  // Dates for the full year summary
  const startDate = `${selectedYear}-01-01`
  const endDate = `${selectedYear}-12-31`

  const { data: paymentsData, isLoading: isLoadingPayments } = useTaxPayments({ year: selectedYear })
  const { data: summary, isLoading: isLoadingSummary } = useTvaSummary(startDate, endDate)
  const { data: monthlyData, isLoading: isLoadingMonthly } = useMonthlyTva(selectedYear)

  const createMutation = useCreateTaxPayment()
  const updateMutation = useUpdateTaxPayment()
  const deleteMutation = useDeleteTaxPayment()

  const yearOptions = [2025, 2026]

  const openCreateModal = () => {
    setEditingPayment(null)
    const currentMonth = new Date().getMonth() + 1
    setFormData({
      ...defaultFormData,
      periodMonth: `${selectedYear}-${currentMonth.toString().padStart(2, '0')}`,
    })
    setError('')
    setIsModalOpen(true)
  }

  const openEditModal = (payment: TaxPayment) => {
    setEditingPayment(payment)
    setFormData({
      amount: payment.amount,
      periodMonth: payment.periodMonth,
      status: payment.status,
      paymentDate: payment.paymentDate || '',
      reference: payment.reference || '',
      note: payment.note || '',
    })
    setError('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingPayment(null)
    setFormData(defaultFormData)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const data: CreateTaxPaymentInput = {
      amount: parseFloat(formData.amount),
      periodMonth: formData.periodMonth,
      status: formData.status,
      paymentDate: formData.paymentDate || undefined,
      reference: formData.reference.trim() || undefined,
      note: formData.note.trim() || undefined,
    }

    try {
      if (editingPayment) {
        await updateMutation.mutateAsync({ id: editingPayment.id, data })
        showSuccess('Paiement TVA modifié avec succès')
      } else {
        await createMutation.mutateAsync(data)
        showSuccess('Paiement TVA créé avec succès')
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
      showSuccess('Paiement TVA supprimé avec succès')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const updateFormField = (field: keyof TaxPaymentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">TVA</h1>
        <div className="flex gap-4 items-center">
          <Link to="/tva/declaration" className="btn btn-secondary">
            Assistant déclaration
          </Link>
          <select
            className="select select-bordered"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={openCreateModal}>
            Ajouter un paiement
          </button>
        </div>
      </div>

      {/* Annual Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">TVA collectée</div>
          <div className="stat-value text-lg">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(summary?.tvaCollected || '0')
            )}
          </div>
          <div className="stat-desc">Sur les factures payées</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">TVA récupérable</div>
          <div className="stat-value text-lg text-base-content/70">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(summary?.tvaRecoverable || '0')
            )}
          </div>
          <div className="stat-desc">Sur les dépenses</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">TVA nette à payer</div>
          <div className="stat-value text-lg text-base-content/70">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(summary?.netTva || '0')
            )}
          </div>
          <div className="stat-desc">Collectée - Récupérable</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Solde restant</div>
          <div className="stat-value text-lg">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(summary?.balance || '0')
            )}
          </div>
          <div className="stat-desc">
            {isLoadingSummary ? '' : `Payé: ${formatCurrency(summary?.totalPaid || '0')}`}
          </div>
        </div>
      </div>

      {/* Monthly Breakdown */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="card-title">Détail mensuel</h2>
          {isLoadingMonthly ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th className="text-right">TVA collectée</th>
                    <th className="text-right">TVA récupérable</th>
                    <th className="text-right">TVA nette</th>
                    <th className="text-center">Paiement</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData?.months.map((m) => {
                    const collected = parseFloat(m.tvaCollected)
                    const recoverable = parseFloat(m.tvaRecoverable)
                    const net = parseFloat(m.netTva)
                    const hasData = collected > 0 || recoverable > 0

                    // Payment status indicator
                    const getPaymentStatusBadge = () => {
                      // If no net TVA to pay, no payment needed
                      if (net <= 0) {
                        return (
                          <span className="badge badge-ghost gap-1">
                            <Minus className="h-3 w-3" />
                            N/A
                          </span>
                        )
                      }

                      switch (m.paymentStatus) {
                        case 'paid':
                          return (
                            <span className="badge badge-success gap-1">
                              <Check className="h-3 w-3" />
                              Payé
                            </span>
                          )
                        case 'pending':
                          return (
                            <span className="badge badge-warning gap-1">
                              <Clock className="h-3 w-3" />
                              En attente
                            </span>
                          )
                        case 'overdue':
                          return (
                            <span className="badge badge-error gap-1" title={`Échéance: ${formatDate(m.dueDate)}`}>
                              <AlertCircle className="h-3 w-3" />
                              En retard
                            </span>
                          )
                        case 'upcoming':
                          return (
                            <span className="badge badge-info gap-1" title={`Échéance: ${formatDate(m.dueDate)}`}>
                              <CalendarClock className="h-3 w-3" />
                              À payer
                            </span>
                          )
                        case 'not_due':
                          return (
                            <span className="badge badge-ghost gap-1">
                              <Minus className="h-3 w-3" />
                              -
                            </span>
                          )
                        default:
                          return null
                      }
                    }

                    return (
                      <tr key={m.month} className={hasData ? '' : 'text-base-content/40'}>
                        <td className="font-medium">{formatMonth(m.month)}</td>
                        <td className="text-right font-mono">
                          {collected > 0 ? formatCurrency(collected) : '-'}
                        </td>
                        <td className="text-right font-mono text-success">
                          {recoverable > 0 ? formatCurrency(recoverable) : '-'}
                        </td>
                        <td className="text-right font-mono">
                          {hasData ? (
                            <span className={net > 0 ? 'text-warning' : 'text-success'}>
                              {formatCurrency(net)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="text-center">
                          {getPaymentStatusBadge()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td>Total</td>
                    <td className="text-right font-mono">
                      {formatCurrency(summary?.tvaCollected || '0')}
                    </td>
                    <td className="text-right font-mono text-success">
                      {formatCurrency(summary?.tvaRecoverable || '0')}
                    </td>
                    <td className="text-right font-mono">
                      <span className={parseFloat(summary?.netTva || '0') > 0 ? 'text-warning' : 'text-success'}>
                        {formatCurrency(summary?.netTva || '0')}
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Payments List */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">Paiements de TVA</h2>
          {isLoadingPayments ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : !paymentsData?.data.length ? (
            <p className="text-base-content/60">Aucun paiement de TVA enregistré pour {selectedYear}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Période</th>
                    <th className="text-right">Montant</th>
                    <th>Statut</th>
                    <th>Date de paiement</th>
                    <th>Référence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.data.map((payment) => (
                    <tr key={payment.id} className="hover">
                      <td>
                        <div className="font-medium">
                          {formatPeriodMonth(payment.periodMonth)}
                        </div>
                        {payment.note && (
                          <div className="text-sm text-base-content/60 truncate max-w-xs">
                            {payment.note}
                          </div>
                        )}
                      </td>
                      <td className="text-right font-mono font-bold">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            payment.status === 'paid' ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {payment.status === 'paid' ? 'Payé' : 'En attente'}
                        </span>
                      </td>
                      <td>
                        {payment.paymentDate ? formatDate(payment.paymentDate) : '-'}
                      </td>
                      <td className="text-base-content/60">{payment.reference || '-'}</td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-sm btn-ghost btn-square"
                            onClick={() => openEditModal(payment)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="btn btn-sm btn-ghost btn-square text-error"
                            onClick={() => setDeleteConfirmId(payment.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">
              {editingPayment ? 'Modifier le paiement TVA' : 'Nouveau paiement TVA'}
            </h3>

            {error && (
              <div className="alert alert-error mb-4">
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Mois *</span>
                  </label>
                  <input
                    type="month"
                    className="input input-bordered w-full"
                    value={formData.periodMonth}
                    onChange={(e) => updateFormField('periodMonth', e.target.value)}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Montant (€) *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input input-bordered w-full"
                    value={formData.amount}
                    onChange={(e) => updateFormField('amount', e.target.value)}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Statut *</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={formData.status}
                    onChange={(e) => updateFormField('status', e.target.value)}
                  >
                    <option value="pending">En attente</option>
                    <option value="paid">Payé</option>
                  </select>
                </div>

                {formData.status === 'paid' && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Date de paiement</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered w-full"
                      value={formData.paymentDate}
                      onChange={(e) => updateFormField('paymentDate', e.target.value)}
                    />
                  </div>
                )}

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Référence</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.reference}
                    onChange={(e) => updateFormField('reference', e.target.value)}
                    placeholder="Numéro de référence..."
                  />
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
                  ) : editingPayment ? (
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
        title="Supprimer le paiement TVA"
        message="Êtes-vous sûr de vouloir supprimer ce paiement ? Cette action est irréversible."
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
