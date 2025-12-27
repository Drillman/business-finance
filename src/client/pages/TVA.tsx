import { useState, useMemo } from 'react'
import {
  useTaxPayments,
  useCreateTaxPayment,
  useUpdateTaxPayment,
  useDeleteTaxPayment,
  useTvaSummary,
  useMonthlyTva,
} from '../hooks/useTva'
import type { TaxPayment, CreateTaxPaymentInput } from '@shared/types'

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

const currentYear = new Date().getFullYear()

interface TaxPaymentFormData {
  amount: string
  periodStart: string
  periodEnd: string
  status: 'pending' | 'paid'
  paymentDate: string
  reference: string
  note: string
}

const defaultFormData: TaxPaymentFormData = {
  amount: '',
  periodStart: '',
  periodEnd: '',
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

  // Dates for the full year summary
  const startDate = `${selectedYear}-01-01`
  const endDate = `${selectedYear}-12-31`

  const { data: paymentsData, isLoading: isLoadingPayments } = useTaxPayments({ year: selectedYear })
  const { data: summary, isLoading: isLoadingSummary } = useTvaSummary(startDate, endDate)
  const { data: monthlyData, isLoading: isLoadingMonthly } = useMonthlyTva(selectedYear)

  const createMutation = useCreateTaxPayment()
  const updateMutation = useUpdateTaxPayment()
  const deleteMutation = useDeleteTaxPayment()

  const yearOptions = useMemo(() => {
    const options = []
    for (let y = currentYear; y >= currentYear - 5; y--) {
      options.push(y)
    }
    return options
  }, [])

  const openCreateModal = () => {
    setEditingPayment(null)
    setFormData({
      ...defaultFormData,
      periodStart: `${selectedYear}-01-01`,
      periodEnd: `${selectedYear}-03-31`,
    })
    setError('')
    setIsModalOpen(true)
  }

  const openEditModal = (payment: TaxPayment) => {
    setEditingPayment(payment)
    setFormData({
      amount: payment.amount,
      periodStart: payment.periodStart,
      periodEnd: payment.periodEnd,
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
      periodStart: formData.periodStart,
      periodEnd: formData.periodEnd,
      status: formData.status,
      paymentDate: formData.paymentDate || undefined,
      reference: formData.reference.trim() || undefined,
      note: formData.note.trim() || undefined,
    }

    try {
      if (editingPayment) {
        await updateMutation.mutateAsync({ id: editingPayment.id, data })
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

  const updateFormField = (field: keyof TaxPaymentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">TVA</h1>
        <div className="flex gap-4 items-center">
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
          <div className="stat-value text-lg text-primary">
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
          <div className="stat-value text-lg text-success">
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
          <div className="stat-value text-lg text-warning">
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
              <span className={parseFloat(summary?.balance || '0') > 0 ? 'text-error' : 'text-success'}>
                {formatCurrency(summary?.balance || '0')}
              </span>
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
                  </tr>
                </thead>
                <tbody>
                  {monthlyData?.months.map((m) => {
                    const collected = parseFloat(m.tvaCollected)
                    const recoverable = parseFloat(m.tvaRecoverable)
                    const net = parseFloat(m.netTva)
                    const hasData = collected > 0 || recoverable > 0

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
                          {formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}
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
                        <div className="flex gap-2">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => openEditModal(payment)}
                          >
                            Modifier
                          </button>
                          {deleteConfirmId === payment.id ? (
                            <div className="flex gap-1">
                              <button
                                className="btn btn-sm btn-error"
                                onClick={() => handleDelete(payment.id)}
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
                              className="btn btn-sm btn-ghost text-error"
                              onClick={() => setDeleteConfirmId(payment.id)}
                            >
                              Supprimer
                            </button>
                          )}
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
                    <span className="label-text">Début de période *</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={formData.periodStart}
                    onChange={(e) => updateFormField('periodStart', e.target.value)}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Fin de période *</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={formData.periodEnd}
                    onChange={(e) => updateFormField('periodEnd', e.target.value)}
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
                    className="input input-bordered"
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
                    className="select select-bordered"
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
                      className="input input-bordered"
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
                    className="input input-bordered"
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
                    className="textarea textarea-bordered"
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
    </div>
  )
}
