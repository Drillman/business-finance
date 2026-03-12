import { useEffect, useMemo, useState } from 'react'
import {
  useIncomeTaxSummary,
  useIncomeTaxPayments,
  useCreateIncomeTaxPayment,
  useUpdateIncomeTaxPayment,
  useDeleteIncomeTaxPayment,
} from '../hooks/useIncomeTax'
import { useSettings, useUpdateSettings } from '../hooks/useSettings'
import type { IncomeTaxPayment, CreateIncomeTaxPaymentInput } from '@shared/types'
import { Check, Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { YearSelect, YEARS } from '../components/PeriodSelect'
import { useSnackbar } from '../contexts/SnackbarContext'
import { MathInput } from '../components/MathInput'
import { AppButton } from '../components/ui/AppButton'
import { KpiCard } from '../components/ui/KpiCard'
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
  const [additionalIncomeDraft, setAdditionalIncomeDraft] = useState(0)

  const { showSuccess, showError } = useSnackbar()

  const { data: summary, isLoading: isLoadingSummary } = useIncomeTaxSummary(selectedYear)
  const { data: paymentsData, isLoading: isLoadingPayments } = useIncomeTaxPayments({ year: selectedYear })
  const { data: settings } = useSettings()
  const updateSettingsMutation = useUpdateSettings()

  const createMutation = useCreateIncomeTaxPayment()
  const updateMutation = useUpdateIncomeTaxPayment()
  const deleteMutation = useDeleteIncomeTaxPayment()

  useEffect(() => {
    setAdditionalIncomeDraft(parseFloat(settings?.additionalTaxableIncome || '0'))
  }, [settings?.additionalTaxableIncome])

  const handleAdditionalIncomeSave = async () => {
    try {
      await updateSettingsMutation.mutateAsync({ additionalTaxableIncome: additionalIncomeDraft })
      showSuccess('Revenu supplémentaire mis à jour')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const openCreateModal = () => {
    setEditingPayment(null)
    setFormData({
      ...defaultFormData,
      year: selectedYear.toString(),
    })
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
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingPayment(null)
    setFormData(defaultFormData)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
  const totalProgress = totalPaid + totalPending
  const progressPercent = estimatedTax > 0 ? Math.min(100, (totalProgress / estimatedTax) * 100) : 0

  const activeBrackets = useMemo(
    () => (summary?.brackets ?? []).filter((bracket) => parseFloat(bracket.taxableAmount) > 0),
    [summary?.brackets],
  )

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-(--text-primary)">Impôts sur le revenu</h1>
        <div className="flex flex-wrap items-center gap-3">
          <YearSelect value={selectedYear} onChange={setSelectedYear} />
          <AppButton className="shadow-[0_8px_20px_-12px_rgba(37,99,235,0.75)]" onClick={openCreateModal}>
            Ajouter un paiement
          </AppButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="CA ANNUEL"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(summary?.totalRevenue || '0')}
          description="Factures payées"
          accentColor="var(--color-primary)"
          valueClassName="text-[22px]"
        />
        <KpiCard
          title="REVENU IMPOSABLE"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(summary?.taxableIncome || '0')}
          description={(
            <>
              Après abattement ({formatPercent(summary?.deductionRate || '34')})
              {parseFloat(summary?.additionalTaxableIncome || '0') > 0 && (
                <> + {formatCurrency(summary?.additionalTaxableIncome || '0')}</>
              )}
            </>
          )}
          accentColor="var(--border-default)"
          valueColor="var(--text-secondary)"
          valueClassName="text-[22px]"
        />
        <KpiCard
          title="IMPÔT ESTIMÉ"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(estimatedTax)}
          description="Selon les tranches fiscales"
          accentColor="var(--border-default)"
          valueColor="var(--text-secondary)"
          valueClassName="text-[22px]"
        />
        <KpiCard
          title="RESTE À PAYER"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(remaining)}
          description={totalPaid > 0 ? `${formatCurrency(totalPaid)} déjà payé` : 'Aucun paiement enregistré'}
          accentColor="var(--kpi-amber, #FBBF24)"
          valueColor="var(--kpi-amber, #FBBF24)"
          valueClassName="text-[22px]"
        />
      </div>

      <section className="rounded-[10px] border border-(--border-default) bg-(--card-bg) p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">Revenu imposable supplémentaire</h2>
        <p className="mt-3 max-w-275 text-[13px] leading-relaxed text-(--text-secondary)">
          Ajoutez un montant supplémentaire à votre revenu imposable (ex: autres revenus, revenus fonciers). Vous pouvez utiliser des expressions mathématiques (ex: 1000 + 500).
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex w-full max-w-70 flex-col gap-1.5">
            <span className="text-[13px] font-medium text-(--text-secondary)">Montant supplémentaire (EUR)</span>
            <MathInput
              value={additionalIncomeDraft}
              onChange={setAdditionalIncomeDraft}
              placeholder="0"
              disabled={updateSettingsMutation.isPending}
              className="h-10 border-(--border-default)! bg-(--card-bg)!"
            />
          </label>

          <AppButton
            startIcon={updateSettingsMutation.isPending ? <span className="loading loading-spinner loading-xs"></span> : <Check className="h-4 w-4" />}
            onClick={handleAdditionalIncomeSave}
            disabled={updateSettingsMutation.isPending}
          >
            Valider
          </AppButton>
        </div>
      </section>

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="border-b border-(--border-default) px-6 py-4">
            <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">
              Calcul progressif de l'impôt {selectedYear}
            </h2>
          </div>

          {isLoadingSummary ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : activeBrackets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-50" />
                  <col className="w-16" />
                  <col className="w-26" />
                  <col className="w-24" />
                </colgroup>
                <thead>
                  <tr className="h-10 border-b border-(--border-default) bg-(--color-base-200)">
                    <th className="px-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Tranche</th>
                    <th className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Taux</th>
                    <th className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Revenu</th>
                    <th className="px-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Impôt</th>
                  </tr>
                </thead>
                <tbody>
                  {activeBrackets.map((bracket, index) => {
                    const taxableAmount = parseFloat(bracket.taxableAmount)
                    const taxAmount = parseFloat(bracket.taxAmount)

                    return (
                      <tr
                        key={index}
                        className={[
                          'h-10 border-b border-(--border-default)',
                          index % 2 === 1 ? 'bg-(--color-base-200)/45' : 'bg-(--card-bg)',
                        ].join(' ')}
                      >
                        <td className="px-4 text-sm text-(--text-primary)">
                          {bracket.maxIncome
                            ? `${formatCurrency(bracket.minIncome)} - ${formatCurrency(bracket.maxIncome)}`
                            : `> ${formatCurrency(bracket.minIncome)}`}
                        </td>
                        <td className="px-4 text-right text-sm whitespace-nowrap text-(--text-secondary)">{formatPercent(bracket.rate)}</td>
                        <td className="px-4 text-right font-mono text-sm whitespace-nowrap text-(--text-primary)">{formatCurrency(taxableAmount)}</td>
                        <td className="px-4 text-right font-mono text-sm font-semibold whitespace-nowrap text-(--text-primary)">{formatCurrency(taxAmount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="h-11 border-t border-(--border-default) bg-(--color-base-200)">
                    <td colSpan={3} className="px-4 text-sm font-semibold text-(--text-primary)">Total impôt estimé</td>
                    <td className="px-4 text-right font-mono text-sm font-bold whitespace-nowrap text-(--color-warning)">{formatCurrency(estimatedTax)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="px-6 py-8 text-sm text-(--text-secondary)">Aucun revenu enregistré pour cette année.</p>
          )}
        </section>

        <section className="h-fit rounded-[10px] border border-(--border-default) bg-(--card-bg) p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">Avancement des paiements</h2>
          <p className="mt-4 text-sm font-medium text-(--text-primary)">
            {formatCurrency(totalProgress)} / {formatCurrency(estimatedTax)}
          </p>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-(--border-default)">
            <div className="h-full rounded-full bg-(--color-primary)" style={{ width: `${progressPercent}%` }}></div>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-[13px]">
            <div className="flex items-center gap-2 text-(--text-primary)">
              <span className="h-2 w-2 rounded-full bg-(--color-success)"></span>
              <span>Payé: {formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex items-center gap-2 text-(--text-primary)">
              <span className="h-2 w-2 rounded-full bg-(--color-warning)"></span>
              <span>En attente: {formatCurrency(totalPending)}</span>
            </div>
            <div className="flex items-center gap-2 text-(--text-primary)">
              <span className="h-2 w-2 rounded-full bg-(--color-error)"></span>
              <span>Reste: {formatCurrency(remaining)}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">Paiements d'impôts {selectedYear}</h2>
        <div className="overflow-hidden rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          {isLoadingPayments ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : paymentsData && paymentsData.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-220 table-fixed border-collapse">
                <thead>
                  <tr className="h-10 border-b border-(--border-default) bg-(--color-base-200)">
                    <th className="px-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Date</th>
                    <th className="w-30 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Montant</th>
                    <th className="w-30 px-4 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Statut</th>
                    <th className="w-40 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Référence</th>
                    <th className="px-4 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Note</th>
                    <th className="w-25 px-4 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentsData.data.map((payment, index) => (
                    <tr
                      key={payment.id}
                      className={[
                        'h-12 border-b border-(--border-default)',
                        index % 2 === 1 ? 'bg-(--color-base-200)/45' : 'bg-(--card-bg)',
                      ].join(' ')}
                    >
                      <td className="px-4 text-sm text-(--text-primary)">{payment.paymentDate ? formatDate(payment.paymentDate) : formatDate(payment.createdAt)}</td>
                      <td className="px-4 text-right font-mono text-sm font-semibold text-(--text-primary)">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 text-center">
                        <span className={[
                          'inline-flex h-5.5 min-h-5.5 items-center rounded-full px-2 text-[10px] font-semibold',
                          payment.status === 'paid' ? 'bg-[#ECFDF5] text-[#16A34A]' : 'bg-[#FFFBEB] text-[#B45309]',
                        ].join(' ')}>
                          {payment.status === 'paid' ? 'Payé' : 'En attente'}
                        </span>
                      </td>
                      <td className="px-4 text-sm text-(--text-secondary)">{payment.reference || '-'}</td>
                      <td className="truncate px-4 text-sm text-(--text-secondary)">{payment.note || '-'}</td>
                      <td className="px-4">
                        <div className="flex justify-center gap-1">
                          <button
                            className="btn btn-ghost btn-xs h-6 min-h-6 w-6 p-0 text-(--text-secondary) hover:bg-transparent"
                            onClick={() => openEditModal(payment)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="btn btn-ghost btn-xs h-6 min-h-6 w-6 p-0 text-(--color-error) hover:bg-transparent"
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
            <p className="px-4 py-6 text-sm text-(--text-secondary)">
              Aucun paiement enregistré pour {selectedYear}.{' '}
              <AppButton size="sm" variant="ghost" className="h-auto p-0 text-(--color-primary) hover:bg-transparent" onClick={openCreateModal}>
                Ajouter un paiement
              </AppButton>
            </p>
          )}
        </div>
      </section>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-140 p-0">
            <div className="px-7 pt-6">
              <h3 className="font-['Space_Grotesk'] text-lg font-semibold text-(--text-primary)">
                {editingPayment ? 'Modifier le paiement' : 'Nouveau paiement d\'impot'}
              </h3>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 px-7 py-5 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-(--text-secondary)">Année *</label>
                  <Select
                    value={formData.year}
                    onChange={(e) => updateFormField('year', e.target.value)}
                    options={YEARS.map((year) => ({ value: year.toString(), label: year.toString() }))}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-(--text-secondary)">Montant (EUR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input h-9.5 w-full border-(--border-default) bg-(--card-bg) text-sm focus:border-(--border-focus) focus:outline-none"
                    value={formData.amount}
                    onChange={(e) => updateFormField('amount', e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-(--text-secondary)">Statut *</label>
                  <Select
                    value={formData.status}
                    onChange={(e) => updateFormField('status', e.target.value)}
                    options={[
                      { value: 'pending', label: 'En attente' },
                      { value: 'paid', label: 'Payé' },
                    ]}
                  />
                </div>

                {formData.status === 'paid' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-(--text-secondary)">Date de paiement</label>
                    <input
                      type="date"
                      className="input h-9.5 w-full border-(--border-default) bg-(--card-bg) text-sm focus:border-(--border-focus) focus:outline-none"
                      value={formData.paymentDate}
                      onChange={(e) => updateFormField('paymentDate', e.target.value)}
                    />
                  </div>
                )}

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-(--text-secondary)">Référence</label>
                  <input
                    type="text"
                    className="input h-9.5 w-full border-(--border-default) bg-(--card-bg) text-sm focus:border-(--border-focus) focus:outline-none"
                    value={formData.reference}
                    onChange={(e) => updateFormField('reference', e.target.value)}
                    placeholder="Numéro de référence..."
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-(--text-secondary)">Note</label>
                  <textarea
                    className="textarea w-full border-(--border-default) bg-(--card-bg) text-sm focus:border-(--border-focus) focus:outline-none"
                    value={formData.note}
                    onChange={(e) => updateFormField('note', e.target.value)}
                    placeholder="Notes supplémentaires..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="border-t border-(--border-default) px-7 py-4">
                <div className="flex justify-end gap-3">
                  <AppButton type="button" variant="ghost" onClick={closeModal}>
                    Annuler
                  </AppButton>
                  <AppButton
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : editingPayment ? (
                      'Enregistrer'
                    ) : (
                      'Ajouter'
                    )}
                  </AppButton>
                </div>
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
