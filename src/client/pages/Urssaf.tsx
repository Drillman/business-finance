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
import { DataTable, type DataTableColumn } from '../components/ui/DataTable'
import { KpiCard } from '../components/ui/KpiCard'

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

const quarterlyColumns: DataTableColumn[] = [
  { key: 'trimester', label: 'Trimestre', className: 'w-34' },
  { key: 'actual-revenue', label: 'CA réel', className: 'w-34 text-right' },
  { key: 'estimated', label: 'Cotisation estimée', className: 'w-40 text-right' },
  { key: 'declared', label: 'Cotisation déclarée', className: 'w-40 text-right' },
  { key: 'status', label: 'Statut', className: 'w-30 text-center' },
  { key: 'actions', label: 'Actions', className: 'w-20 text-center' },
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
  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-(--text-primary)">Urssaf</h1>
          <p className="mt-1 text-sm text-(--text-secondary)">
            Suivi trimestriel des cotisations et déclarations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <YearSelect value={selectedYear} onChange={setSelectedYear} />
          <AppButton
            className="shadow-[0_8px_20px_-12px_rgba(37,99,235,0.75)]"
            onClick={() => openCreateModal()}
          >
            Ajouter une cotisation
          </AppButton>
        </div>
      </div>

      {/* Annual Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="CA déclaré"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(summary?.totals.totalRevenue || '0')}
          description="Chiffre d'affaires total"
          accentColor="#818CF8"
        />
        <KpiCard
          title="Cotisations dues"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(summary?.totals.totalAmount || '0')}
          description={`Taux: ${summary?.urssafRate || 22}%`}
          accentColor="#FBBF24"
        />
        <KpiCard
          title="Cotisations payées"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(summary?.totals.totalPaid || '0')}
          description="Paiements validés"
          accentColor="#34D399"
        />
        <KpiCard
          title="Reste à payer"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(summary?.totals.totalPending || '0')}
          description="Montant à régulariser"
          accentColor="#A78BFA"
          valueClassName={summary && parseFloat(summary.totals.totalPending) <= 0 ? 'text-[#34D399]' : ''}
        />
      </div>

      {/* Quarterly Breakdown */}
      <section className="space-y-3">
        <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">
          Cotisations trimestrielles {selectedYear}
        </h2>

        {isLoadingSummary ? (
          <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) py-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <DataTable
            columns={quarterlyColumns}
            minWidthClassName=""
            tableClassName="mx-auto w-full max-w-245"
            footer={(
              <tr className="h-11 border-t border-(--border-default) bg-(--card-bg)">
                <td className="px-4 text-sm font-semibold text-(--text-primary)">
                  Total {selectedYear}
                </td>
                <td className="px-4 text-right font-mono text-sm font-semibold text-(--text-primary)">
                  {formatCurrency(
                    summary?.trimesters.reduce((acc, t) => acc + parseFloat(t.actualRevenue), 0) || 0,
                  )}
                </td>
                <td className="px-4 text-right font-mono text-sm font-semibold text-(--text-secondary)">
                  {formatCurrency(
                    summary?.trimesters.reduce((acc, t) => acc + parseFloat(t.estimatedAmount), 0) || 0,
                  )}
                </td>
                <td className="px-4 text-right font-mono text-sm font-semibold text-(--text-primary)">
                  {formatCurrency(summary?.totals.totalAmount || '0')}
                </td>
                <td colSpan={2} />
              </tr>
            )}
          >
            {summary?.trimesters.map((trimester, index) => {
              const hasPayment = trimester.payment !== null
              const actualRevenue = parseFloat(trimester.actualRevenue)
              const estimatedAmount = parseFloat(trimester.estimatedAmount)

              return (
                <tr
                  key={trimester.trimester}
                  className={[
                    'h-12 border-b border-(--border-default)',
                    index % 2 === 1 ? 'bg-(--color-base-200)/45' : 'bg-(--card-bg)',
                  ].join(' ')}
                >
                  <td className="px-4 text-sm font-semibold text-(--text-primary)">
                    {trimesterLabels[trimester.trimester]}
                  </td>
                  <td className="px-4 text-right font-mono text-sm text-(--text-primary)">
                    {actualRevenue > 0 ? formatCurrency(actualRevenue) : '-'}
                  </td>
                  <td className="px-4 text-right font-mono text-sm text-(--text-secondary)">
                    {estimatedAmount > 0 ? formatCurrency(estimatedAmount) : '-'}
                  </td>
                  <td className="px-4 text-right font-mono text-sm font-semibold text-(--text-primary)">
                    {hasPayment ? formatCurrency(trimester.payment!.amount) : '-'}
                  </td>
                  <td className="px-4 text-center">
                    {hasPayment ? (
                      <span
                        className={[
                          'badge h-5.5 min-h-5.5 border-0 px-2 text-[10px] font-semibold',
                          trimester.payment!.status === 'paid'
                            ? 'bg-[#ECFDF5] text-[#16A34A]'
                            : 'bg-[#FFFBEB] text-[#B45309]',
                        ].join(' ')}
                      >
                        {trimester.payment!.status === 'paid' ? 'Payé' : 'En attente'}
                      </span>
                    ) : (
                      <span className="badge h-5.5 min-h-5.5 border-0 bg-base-200 px-2 text-[10px] font-semibold text-(--text-secondary)">
                        Non déclaré
                      </span>
                    )}
                  </td>
                  <td className="px-4">
                    <div className="flex justify-center gap-1">
                      {hasPayment ? (
                        <>
                          <button
                            className="btn btn-ghost btn-xs h-6 min-h-6 w-6 p-0 text-(--text-secondary) hover:bg-transparent"
                            onClick={() => openEditModal(trimester.payment!)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs h-6 min-h-6 w-6 p-0 text-error hover:bg-transparent"
                            onClick={() => setDeleteConfirmId(trimester.payment!.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <AppButton size="sm" onClick={() => openCreateModal(trimester.trimester)}>
                          Déclarer
                        </AppButton>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}

          </DataTable>
        )}
      </section>

      {/* Info Card */}
      <section className="rounded-[10px] border border-(--border-default) bg-[#EEF2FF] px-6 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <h3 className="font-['Space_Grotesk'] text-base font-semibold text-[#4338CA]">Information</h3>
        <p className="mt-2 text-sm text-(--text-primary)">
            Le <strong>CA réel</strong> est calculé automatiquement à partir des factures payées sur chaque trimestre.
            La <strong>cotisation estimée</strong> est basée sur votre taux Urssaf ({summary?.urssafRate || 22}%).
            Vous pouvez ajuster le montant lors de la déclaration si nécessaire.
        </p>
      </section>

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
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[65vh] space-y-4 overflow-y-auto px-7 py-5">
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
                  startIcon={isSubmitting ? null : <Check className="h-4 w-4" />}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
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
