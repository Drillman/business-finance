import { useState, useMemo } from 'react'
import {
  useUrssafSummary,
  useCreateUrssafPayment,
  useUpdateUrssafPayment,
  useDeleteUrssafPayment,
} from '../hooks/useUrssaf'
import type { UrssafPayment, CreateUrssafPaymentInput } from '@shared/types'
import { Pencil, Trash2 } from 'lucide-react'

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

const currentYear = new Date().getFullYear()

const trimesterLabels: Record<number, string> = {
  1: 'T1 (Jan-Mar)',
  2: 'T2 (Avr-Juin)',
  3: 'T3 (Juil-Sep)',
  4: 'T4 (Oct-Déc)',
}

interface UrssafFormData {
  trimester: string
  year: string
  revenue: string
  amount: string
  status: 'pending' | 'paid'
  paymentDate: string
  reference: string
  note: string
}

const defaultFormData: UrssafFormData = {
  trimester: '1',
  year: currentYear.toString(),
  revenue: '',
  amount: '',
  status: 'pending',
  paymentDate: '',
  reference: '',
  note: '',
}

export default function Urssaf() {
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<UrssafPayment | null>(null)
  const [formData, setFormData] = useState<UrssafFormData>(defaultFormData)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data: summary, isLoading: isLoadingSummary } = useUrssafSummary(selectedYear)

  const createMutation = useCreateUrssafPayment()
  const updateMutation = useUpdateUrssafPayment()
  const deleteMutation = useDeleteUrssafPayment()

  const yearOptions = useMemo(() => {
    const options = []
    for (let y = currentYear; y >= currentYear - 5; y--) {
      options.push(y)
    }
    return options
  }, [])

  const openCreateModal = (trimester?: number) => {
    setEditingPayment(null)
    setFormData({
      ...defaultFormData,
      trimester: trimester?.toString() || '1',
      year: selectedYear.toString(),
    })
    setError('')
    setIsModalOpen(true)
  }

  const openEditModal = (payment: UrssafPayment) => {
    setEditingPayment(payment)
    setFormData({
      trimester: payment.trimester.toString(),
      year: payment.year.toString(),
      revenue: payment.revenue,
      amount: payment.amount,
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

    const data: CreateUrssafPaymentInput = {
      trimester: parseInt(formData.trimester),
      year: parseInt(formData.year),
      revenue: parseFloat(formData.revenue),
      amount: parseFloat(formData.amount),
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

  const updateFormField = (field: keyof UrssafFormData, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value }

      // Auto-calculate amount when revenue changes using the rate from summary
      if (field === 'revenue' && summary) {
        const revenue = parseFloat(value) || 0
        const calculatedAmount = revenue * (summary.urssafRate / 100)
        updated.amount = calculatedAmount.toFixed(2)
      }

      return updated
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Urssaf</h1>
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
          <button className="btn btn-primary" onClick={() => openCreateModal()}>
            Ajouter une cotisation
          </button>
        </div>
      </div>

      {/* Annual Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">CA déclaré</div>
          <div className="stat-value text-lg">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(summary?.totals.totalRevenue || '0')
            )}
          </div>
          <div className="stat-desc">Chiffre d'affaires total</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Cotisations dues</div>
          <div className="stat-value text-lg text-warning">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(summary?.totals.totalAmount || '0')
            )}
          </div>
          <div className="stat-desc">Taux: {summary?.urssafRate || 22}%</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Cotisations payées</div>
          <div className="stat-value text-lg text-success">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(summary?.totals.totalPaid || '0')
            )}
          </div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Reste à payer</div>
          <div className="stat-value text-lg">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <span className={parseFloat(summary?.totals.totalPending || '0') > 0 ? 'text-error' : 'text-success'}>
                {formatCurrency(summary?.totals.totalPending || '0')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quarterly Breakdown */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">Cotisations trimestrielles {selectedYear}</h2>
          {isLoadingSummary ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Trimestre</th>
                    <th>Période</th>
                    <th className="text-right">CA réel</th>
                    <th className="text-right">Cotisation estimée</th>
                    <th className="text-right">Cotisation déclarée</th>
                    <th>Statut</th>
                    <th>Référence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.trimesters.map((t) => {
                    const hasPayment = t.payment !== null
                    const actualRevenue = parseFloat(t.actualRevenue)
                    const estimatedAmount = parseFloat(t.estimatedAmount)

                    return (
                      <tr key={t.trimester} className="hover">
                        <td className="font-bold">{trimesterLabels[t.trimester]}</td>
                        <td className="text-base-content/60">
                          {formatDate(t.startDate)} - {formatDate(t.endDate)}
                        </td>
                        <td className="text-right font-mono">
                          {actualRevenue > 0 ? formatCurrency(actualRevenue) : '-'}
                        </td>
                        <td className="text-right font-mono text-base-content/60">
                          {estimatedAmount > 0 ? formatCurrency(estimatedAmount) : '-'}
                        </td>
                        <td className="text-right font-mono font-bold">
                          {hasPayment ? formatCurrency(t.payment!.amount) : '-'}
                        </td>
                        <td>
                          {hasPayment ? (
                            <span
                              className={`badge ${
                                t.payment!.status === 'paid' ? 'badge-success' : 'badge-warning'
                              }`}
                            >
                              {t.payment!.status === 'paid' ? 'Payé' : 'En attente'}
                            </span>
                          ) : (
                            <span className="badge badge-ghost">Non déclaré</span>
                          )}
                        </td>
                        <td className="text-base-content/60">
                          {hasPayment && t.payment!.reference ? t.payment!.reference : '-'}
                        </td>
                        <td>
                          <div className="flex gap-1">
                            {hasPayment ? (
                              <>
                                <button
                                  className="btn btn-sm btn-ghost btn-square"
                                  onClick={() => openEditModal(t.payment!)}
                                  title="Modifier"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                {deleteConfirmId === t.payment!.id ? (
                                  <div className="flex gap-1">
                                    <button
                                      className="btn btn-sm btn-error"
                                      onClick={() => handleDelete(t.payment!.id)}
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
                                    onClick={() => setDeleteConfirmId(t.payment!.id)}
                                    title="Supprimer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => openCreateModal(t.trimester)}
                              >
                                Déclarer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={2}>Total {selectedYear}</td>
                    <td className="text-right font-mono">
                      {formatCurrency(
                        summary?.trimesters.reduce((acc, t) => acc + parseFloat(t.actualRevenue), 0) || 0
                      )}
                    </td>
                    <td className="text-right font-mono text-base-content/60">
                      {formatCurrency(
                        summary?.trimesters.reduce((acc, t) => acc + parseFloat(t.estimatedAmount), 0) || 0
                      )}
                    </td>
                    <td className="text-right font-mono">
                      {formatCurrency(summary?.totals.totalAmount || '0')}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="card bg-info/10 shadow mt-6">
        <div className="card-body">
          <h3 className="card-title text-info">Information</h3>
          <p className="text-sm">
            Le <strong>CA réel</strong> est calculé automatiquement à partir des factures payées sur chaque trimestre.
            La <strong>cotisation estimée</strong> est basée sur votre taux Urssaf ({summary?.urssafRate || 22}%).
            Vous pouvez ajuster le montant lors de la déclaration si nécessaire.
          </p>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">
              {editingPayment ? 'Modifier la cotisation Urssaf' : 'Nouvelle cotisation Urssaf'}
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
                    <span className="label-text">Trimestre *</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={formData.trimester}
                    onChange={(e) => updateFormField('trimester', e.target.value)}
                    disabled={!!editingPayment}
                  >
                    {[1, 2, 3, 4].map((t) => (
                      <option key={t} value={t}>
                        {trimesterLabels[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Année *</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={formData.year}
                    onChange={(e) => updateFormField('year', e.target.value)}
                    disabled={!!editingPayment}
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Chiffre d'affaires (€) *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input input-bordered w-full"
                    value={formData.revenue}
                    onChange={(e) => updateFormField('revenue', e.target.value)}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Montant cotisation (€) *</span>
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
                  {summary && formData.revenue && (
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        Estimation à {summary.urssafRate}%: {formatCurrency(parseFloat(formData.revenue) * (summary.urssafRate / 100))}
                      </span>
                    </label>
                  )}
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
                    placeholder="Numéro de déclaration..."
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
                    'Déclarer'
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
