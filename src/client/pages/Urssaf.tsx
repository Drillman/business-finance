import { useState } from 'react'
import {
  useUrssafSummary,
  useCreateUrssafPayment,
  useUpdateUrssafPayment,
  useDeleteUrssafPayment,
} from '../hooks/useUrssaf'
import type { UrssafPayment, CreateUrssafPaymentInput } from '@shared/types'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { YearSelect, YEARS } from '../components/PeriodSelect'
import { useSnackbar } from '../contexts/SnackbarContext'
import { AppButton } from '../components/ui/AppButton'
import { Select } from '../components/ui/Select'

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

const trimesterOptions = [1, 2, 3, 4].map((trimester) => ({
  value: trimester.toString(),
  label: trimesterLabels[trimester],
}))

const statusOptions = [
  { value: 'pending', label: 'En attente' },
  { value: 'paid', label: 'Payé' },
]

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

  const { showSuccess, showError } = useSnackbar()

  const { data: summary, isLoading: isLoadingSummary } = useUrssafSummary(selectedYear)

  const createMutation = useCreateUrssafPayment()
  const updateMutation = useUpdateUrssafPayment()
  const deleteMutation = useDeleteUrssafPayment()

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
        showSuccess('Cotisation Urssaf modifiée avec succès')
      } else {
        await createMutation.mutateAsync(data)
        showSuccess('Cotisation Urssaf créée avec succès')
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
      showSuccess('Cotisation Urssaf supprimée avec succès')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Une erreur est survenue')
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

  const parsedRevenue = parseFloat(formData.revenue) || 0
  const parsedAmount = parseFloat(formData.amount) || 0
  const urssafRate = summary?.urssafRate || 22
  const calculatedAmount = parsedRevenue * (urssafRate / 100)
  const modalTitle = editingPayment ? 'Modifier la cotisation Urssaf' : 'Nouvelle cotisation Urssaf'
  const submitLabel = editingPayment ? 'Enregistrer' : 'Déclarer'

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Urssaf</h1>
        <div className="flex gap-4 items-center">
          <YearSelect value={selectedYear} onChange={setSelectedYear} />
          <AppButton onClick={() => openCreateModal()}>
            Ajouter une cotisation
          </AppButton>
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
          <div className="stat-value text-lg text-base-content/70">
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
          <div className="stat-value text-lg text-base-content/70">
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
              formatCurrency(summary?.totals.totalPending || '0')
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
                                <button
                                  className="btn btn-sm btn-ghost btn-square text-error"
                                  onClick={() => setDeleteConfirmId(t.payment!.id)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <AppButton size="sm" onClick={() => openCreateModal(t.trimester)}>
                                Déclarer
                              </AppButton>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            onClick={closeModal}
            aria-label="Fermer"
          />

          <div className="relative w-full max-w-140 overflow-hidden rounded-2xl border border-(--border-default) bg-(--card-bg) shadow-[0_8px_32px_-4px_rgba(0,0,0,0.15)]">
            <div className="flex items-center justify-between px-7 pt-6 pb-0">
              <div>
                <h3 className="font-['Space_Grotesk'] text-[22px] font-semibold tracking-[-0.02em] text-(--text-primary)">
                  {modalTitle}
                </h3>
                <p className="mt-1 text-[13px] text-(--text-secondary)">
                  Déclarez vos cotisations trimestrielles
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-primary)"
                aria-label="Fermer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[65vh] space-y-4.5 overflow-y-auto px-7 py-5">
                {error && (
                  <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-(--text-primary)">Trimestre *</label>
                    <Select
                      className="h-10"
                      value={formData.trimester}
                      onChange={(e) => updateFormField('trimester', e.target.value)}
                      options={trimesterOptions}
                      disabled={!!editingPayment}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-(--text-primary)">Année *</label>
                    <Select
                      className="h-10"
                      value={formData.year}
                      onChange={(e) => updateFormField('year', e.target.value)}
                      options={YEARS.map((year) => ({ value: year.toString(), label: year.toString() }))}
                      disabled={!!editingPayment}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-(--text-primary)">
                    Chiffre d'affaires (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-10 w-full rounded-lg border border-(--border-default) bg-white px-3 text-sm text-(--text-primary) focus:border-(--color-primary) focus:outline-none"
                    value={formData.revenue}
                    onChange={(e) => updateFormField('revenue', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-(--text-primary)">
                      Montant cotisation (€) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-10 w-full rounded-lg border border-(--border-default) bg-white px-3 text-sm text-(--text-primary) focus:border-(--color-primary) focus:outline-none"
                      value={formData.amount}
                      onChange={(e) => updateFormField('amount', e.target.value)}
                      required
                    />
                    <p className="text-[11px] text-(--text-tertiary)">
                      Estimation : {urssafRate}% du CA
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-(--text-primary)">Statut *</label>
                    <Select
                      className="h-10"
                      value={formData.status}
                      onChange={(e) => updateFormField('status', e.target.value)}
                      options={statusOptions}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-(--text-primary)">Date de paiement</label>
                  <input
                    type="date"
                    className="h-10 w-full rounded-lg border border-(--border-default) bg-white px-3 text-sm text-(--text-primary) focus:border-(--color-primary) focus:outline-none"
                    value={formData.paymentDate}
                    onChange={(e) => updateFormField('paymentDate', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-(--text-primary)">
                    Référence <span className="text-xs font-normal text-(--text-tertiary)">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    className="h-10 w-full rounded-lg border border-(--border-default) bg-white px-3 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:border-(--color-primary) focus:outline-none"
                    value={formData.reference}
                    onChange={(e) => updateFormField('reference', e.target.value)}
                    placeholder="Numéro de déclaration..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-(--text-primary)">
                    Note <span className="text-xs font-normal text-(--text-tertiary)">(optionnel)</span>
                  </label>
                  <textarea
                    className="min-h-16 w-full rounded-lg border border-(--border-default) bg-white px-3 py-2.5 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:border-(--color-primary) focus:outline-none"
                    value={formData.note}
                    onChange={(e) => updateFormField('note', e.target.value)}
                    placeholder="Notes supplémentaires..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2 rounded-lg bg-[#EEF2FF] px-4 py-3.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-(--text-secondary)">Chiffre d'affaires :</span>
                    <span className="font-medium text-(--text-primary)">{formatCurrency(parsedRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-(--text-secondary)">Taux Urssaf :</span>
                    <span className="font-medium text-(--text-primary)">{urssafRate}%</span>
                  </div>
                  <div className="h-px w-full bg-(--border-default)" />
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-(--text-secondary)">Cotisation due :</span>
                    <span className="font-['Space_Grotesk'] text-base font-semibold text-(--color-primary)">
                      {formatCurrency(formData.amount ? parsedAmount : calculatedAmount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-(--border-default)" />
              <div className="flex items-center justify-end gap-3 px-7 pt-4 pb-6">
                <AppButton type="button" variant="outline" onClick={closeModal}>
                  Annuler
                </AppButton>
                <AppButton
                  type="submit"
                  startIcon={createMutation.isPending || updateMutation.isPending ? null : <Check className="h-4 w-4" />}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    submitLabel
                  )}
                </AppButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title="Supprimer la cotisation Urssaf"
        message="Êtes-vous sûr de vouloir supprimer cette cotisation ? Cette action est irréversible."
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
