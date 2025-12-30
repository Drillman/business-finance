import { useState, useMemo } from 'react'
import {
  useIncomeTaxSummary,
  useIncomeTaxPayments,
  useCreateIncomeTaxPayment,
  useUpdateIncomeTaxPayment,
  useDeleteIncomeTaxPayment,
} from '../hooks/useIncomeTax'
import type { IncomeTaxPayment, CreateIncomeTaxPaymentInput } from '@shared/types'
import { Pencil, Trash2 } from 'lucide-react'
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

function formatPercent(rate: string | number): string {
  const num = typeof rate === 'string' ? parseFloat(rate) : rate
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(num / 100)
}

const currentYear = new Date().getFullYear()

interface IncomeTaxFormData {
  year: string
  amount: string
  status: 'pending' | 'paid'
  paymentDate: string
  reference: string
  note: string
}

const defaultFormData: IncomeTaxFormData = {
  year: currentYear.toString(),
  amount: '',
  status: 'pending',
  paymentDate: '',
  reference: '',
  note: '',
}

export default function IncomeTax() {
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<IncomeTaxPayment | null>(null)
  const [formData, setFormData] = useState<IncomeTaxFormData>(defaultFormData)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { showSuccess, showError } = useSnackbar()

  const { data: summary, isLoading: isLoadingSummary } = useIncomeTaxSummary(selectedYear)
  const { data: paymentsData, isLoading: isLoadingPayments } = useIncomeTaxPayments({ year: selectedYear })

  const createMutation = useCreateIncomeTaxPayment()
  const updateMutation = useUpdateIncomeTaxPayment()
  const deleteMutation = useDeleteIncomeTaxPayment()

  const yearOptions = [2025, 2026]

  const openCreateModal = () => {
    setEditingPayment(null)
    setFormData({
      ...defaultFormData,
      year: selectedYear.toString(),
    })
    setError('')
    setIsModalOpen(true)
  }

  const openEditModal = (payment: IncomeTaxPayment) => {
    setEditingPayment(payment)
    setFormData({
      year: payment.year.toString(),
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

    const data: CreateIncomeTaxPaymentInput = {
      year: parseInt(formData.year),
      amount: parseFloat(formData.amount),
      status: formData.status,
      paymentDate: formData.paymentDate || undefined,
      reference: formData.reference.trim() || undefined,
      note: formData.note.trim() || undefined,
    }

    try {
      if (editingPayment) {
        await updateMutation.mutateAsync({ id: editingPayment.id, data })
        showSuccess('Paiement modifié avec succès')
      } else {
        await createMutation.mutateAsync(data)
        showSuccess('Paiement créé avec succès')
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
      showSuccess('Paiement supprimé avec succès')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const updateFormField = (field: keyof IncomeTaxFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const estimatedTax = parseFloat(summary?.estimatedTax || '0')
  const totalPaid = parseFloat(summary?.totalPaid || '0')
  const totalPending = parseFloat(summary?.totalPending || '0')
  const remaining = parseFloat(summary?.remaining || '0')

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Impots sur le revenu</h1>
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
          <div className="stat-title">CA annuel</div>
          <div className="stat-value text-lg">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(summary?.totalRevenue || '0')
            )}
          </div>
          <div className="stat-desc">Factures payees</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Revenu imposable</div>
          <div className="stat-value text-lg text-base-content/70">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(summary?.taxableIncome || '0')
            )}
          </div>
          <div className="stat-desc">
            Apres abattement ({formatPercent(summary?.deductionRate || '34')})
          </div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Impot estime</div>
          <div className="stat-value text-lg text-base-content/70">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(estimatedTax)
            )}
          </div>
          <div className="stat-desc">Selon les tranches fiscales</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Reste a payer</div>
          <div className="stat-value text-lg">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(remaining)
            )}
          </div>
          <div className="stat-desc">
            {totalPaid > 0 && `${formatCurrency(totalPaid)} deja paye`}
          </div>
        </div>
      </div>

      {/* Tax Bracket Breakdown */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="card-title">Calcul progressif de l'impot {selectedYear}</h2>
          {isLoadingSummary ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : summary?.brackets && summary.brackets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tranche</th>
                    <th className="text-right">Taux</th>
                    <th className="text-right">Revenu dans la tranche</th>
                    <th className="text-right">Impot</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.brackets.map((bracket, index) => {
                    const taxableAmount = parseFloat(bracket.taxableAmount)
                    const taxAmount = parseFloat(bracket.taxAmount)
                    if (taxableAmount === 0) return null

                    return (
                      <tr key={index} className="hover">
                        <td>
                          {bracket.maxIncome
                            ? `${formatCurrency(bracket.minIncome)} - ${formatCurrency(bracket.maxIncome)}`
                            : `> ${formatCurrency(bracket.minIncome)}`}
                        </td>
                        <td className="text-right font-mono">{formatPercent(bracket.rate)}</td>
                        <td className="text-right font-mono">{formatCurrency(taxableAmount)}</td>
                        <td className="text-right font-mono font-bold">{formatCurrency(taxAmount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={3}>Total impot estime</td>
                    <td className="text-right font-mono text-warning">{formatCurrency(estimatedTax)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-base-content/60">
              Aucun revenu enregistre pour cette annee.
            </p>
          )}
        </div>
      </div>

      {/* Payment Progress */}
      <div className="card bg-base-100 shadow mb-6">
        <div className="card-body">
          <h2 className="card-title">Avancement des paiements</h2>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span>Progression</span>
              <span className="font-mono">
                {formatCurrency(totalPaid + totalPending)} / {formatCurrency(estimatedTax)}
              </span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={estimatedTax > 0 ? ((totalPaid + totalPending) / estimatedTax) * 100 : 0}
              max="100"
            ></progress>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="badge badge-success badge-sm"></span>
                <span>Paye: {formatCurrency(totalPaid)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-warning badge-sm"></span>
                <span>En attente: {formatCurrency(totalPending)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-error badge-sm"></span>
                <span>Reste: {formatCurrency(remaining)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment List */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">Paiements d'impots {selectedYear}</h2>
          {isLoadingPayments ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : paymentsData && paymentsData.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Montant</th>
                    <th>Statut</th>
                    <th>Reference</th>
                    <th>Note</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.data.map((payment) => (
                    <tr key={payment.id} className="hover">
                      <td>
                        {payment.paymentDate
                          ? formatDate(payment.paymentDate)
                          : formatDate(payment.createdAt)}
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
                          {payment.status === 'paid' ? 'Paye' : 'En attente'}
                        </span>
                      </td>
                      <td className="text-base-content/60">{payment.reference || '-'}</td>
                      <td className="text-base-content/60 max-w-xs truncate">
                        {payment.note || '-'}
                      </td>
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
          ) : (
            <p className="text-base-content/60 py-4">
              Aucun paiement enregistre pour {selectedYear}.{' '}
              <button className="link link-primary" onClick={openCreateModal}>
                Ajouter un paiement
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className="card bg-info/10 shadow mt-6">
        <div className="card-body">
          <h3 className="card-title text-info">Information</h3>
          <p className="text-sm">
            L'impot est calcule selon le <strong>bareme progressif</strong> de l'impot sur le revenu.
            Le <strong>revenu imposable</strong> est obtenu en appliquant l'abattement forfaitaire
            pour frais professionnels ({formatPercent(summary?.deductionRate || '34')}) au chiffre d'affaires.
            Vous pouvez enregistrer vos acomptes et paiements pour suivre votre situation fiscale.
          </p>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">
              {editingPayment ? 'Modifier le paiement' : 'Nouveau paiement d\'impot'}
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
                    <span className="label-text">Annee *</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={formData.year}
                    onChange={(e) => updateFormField('year', e.target.value)}
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
                    <span className="label-text">Montant (EUR) *</span>
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
                    <option value="paid">Paye</option>
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

                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">Reference</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.reference}
                    onChange={(e) => updateFormField('reference', e.target.value)}
                    placeholder="Numero de reference..."
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
                    placeholder="Notes supplementaires..."
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
                    'Ajouter'
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
        title="Supprimer le paiement"
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
