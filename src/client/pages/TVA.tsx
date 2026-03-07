import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useTaxPayments,
  useCreateTaxPayment,
  useUpdateTaxPayment,
  useDeleteTaxPayment,
  useTvaSummary,
  useMonthlyTva,
} from '../hooks/useTva'
import type { TaxPayment, CreateTaxPaymentInput } from '@shared/types'
import { Pencil, Trash2, Check, Clock, AlertCircle, CalendarClock, Minus } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { YearSelect } from '../components/PeriodSelect'
import { useSnackbar } from '../contexts/SnackbarContext'
import { DataTable, type DataTableColumn } from '../components/ui/DataTable'
import { AppButton } from '../components/ui/AppButton'
import { KpiCard } from '../components/ui/KpiCard'

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
  return date.toLocaleDateString('fr-FR', { month: 'long' })
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

const monthlyColumns: DataTableColumn[] = [
  { key: 'month', label: 'Mois' },
  { key: 'collected', label: 'Collectée', className: 'w-30 text-right' },
  { key: 'recoverable', label: 'Récupérable', className: 'w-30 text-right' },
  { key: 'net', label: 'Nette', className: 'w-30 text-right' },
  { key: 'payment', label: 'Paiement', className: 'w-30 text-center' },
]

const paymentColumns: DataTableColumn[] = [
  { key: 'period', label: 'Période' },
  { key: 'amount', label: 'Montant', className: 'w-30 text-right' },
  { key: 'status', label: 'Statut', className: 'w-25 text-center' },
  { key: 'payment-date', label: 'Date paiement', className: 'w-35 text-right' },
  { key: 'reference', label: 'Référence', className: 'w-35 text-right' },
  { key: 'actions', label: 'Actions', className: 'w-25 text-center' },
]

export default function TVA() {
  const navigate = useNavigate()
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

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-(--text-primary)">TVA</h1>
          <AppButton variant="outline" onClick={() => navigate('/tva/declaration')}>
            Assistant déclaration
          </AppButton>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <YearSelect value={selectedYear} onChange={setSelectedYear} />
          <AppButton className="shadow-[0_8px_20px_-12px_rgba(37,99,235,0.75)]" onClick={openCreateModal}>
            Ajouter un paiement
          </AppButton>
        </div>
      </div>

      {/* Annual Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="TVA collectée"
          value={
            isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(summary?.tvaCollected || '0')
          }
          description="Sur les factures payées"
          accentColor="var(--kpi-blue, #818CF8)"
          valueClassName="text-lg"
        />
        <KpiCard
          title="TVA récupérable"
          value={
            isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(summary?.tvaRecoverable || '0')
          }
          description="Sur les dépenses"
          accentColor="var(--kpi-emerald, #34D399)"
          valueClassName="text-lg"
        />
        <KpiCard
          title="TVA nette à payer"
          value={
            isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(summary?.netTva || '0')
          }
          description="Collectée - Récupérable"
          accentColor="var(--kpi-amber, #FBBF24)"
          valueColor={parseFloat(summary?.netTva || '0') > 0 ? 'var(--color-warning)' : 'var(--color-success)'}
          valueClassName="text-lg"
        />
        <KpiCard
          title="Solde restant"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm"></span> : formatCurrency(summary?.balance || '0')}
          description={isLoadingSummary ? '' : `Payé: ${formatCurrency(summary?.totalPaid || '0')}`}
          accentColor="var(--kpi-indigo, #A78BFA)"
          valueClassName="text-lg"
        />
      </div>

      {/* Monthly Breakdown */}
      <section className="space-y-3">
        <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">Détail mensuel</h2>
        {isLoadingMonthly ? (
          <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) py-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <DataTable
            columns={monthlyColumns}
            minWidthClassName=""
            footer={
              <tr className="h-11 border-t border-(--border-default) bg-(--card-bg)">
                <td className="px-4 text-sm font-semibold text-(--text-primary)">Total</td>
                <td className="px-4 text-right font-mono text-sm font-semibold text-(--text-primary)">
                  {formatCurrency(summary?.tvaCollected || '0')}
                </td>
                <td className="px-4 text-right font-mono text-sm font-semibold text-(--color-success)">
                  {formatCurrency(summary?.tvaRecoverable || '0')}
                </td>
                <td className="px-4 text-right font-mono text-sm font-semibold">
                  <span className={parseFloat(summary?.netTva || '0') > 0 ? 'text-(--color-warning)' : 'text-(--color-success)'}>
                    {formatCurrency(summary?.netTva || '0')}
                  </span>
                </td>
                <td className="px-4" />
              </tr>
            }
          >
            {monthlyData?.months.map((m, index) => {
              const collected = parseFloat(m.tvaCollected)
              const recoverable = parseFloat(m.tvaRecoverable)
              const net = parseFloat(m.netTva)
              const hasData = collected > 0 || recoverable > 0

              const getPaymentStatusBadge = () => {
                if (net <= 0) {
                  return (
                    <span className="badge h-5.5 min-h-5.5 gap-1 border-0 bg-base-200 px-2 text-[10px] font-semibold text-(--text-secondary)">
                      <Minus className="h-3 w-3" />
                      N/A
                    </span>
                  )
                }

                switch (m.paymentStatus) {
                  case 'paid':
                    return (
                      <span className="badge h-5.5 min-h-5.5 gap-1 border-0 bg-[#ECFDF5] px-2 text-[10px] font-semibold text-[#16A34A]">
                        <Check className="h-3 w-3" />
                        Payé
                      </span>
                    )
                  case 'pending':
                    return (
                      <span className="badge h-5.5 min-h-5.5 gap-1 border-0 bg-[#FFFBEB] px-2 text-[10px] font-semibold text-[#B45309]">
                        <Clock className="h-3 w-3" />
                        En attente
                      </span>
                    )
                  case 'overdue':
                    return (
                      <span className="badge h-5.5 min-h-5.5 gap-1 border-0 bg-[#FEF2F2] px-2 text-[10px] font-semibold text-[#DC2626]" title={`Échéance: ${formatDate(m.dueDate)}`}>
                        <AlertCircle className="h-3 w-3" />
                        En retard
                      </span>
                    )
                  case 'upcoming':
                    return (
                      <span className="badge h-5.5 min-h-5.5 gap-1 border-0 bg-[#EEF2FF] px-2 text-[10px] font-semibold text-[#4338CA]" title={`Échéance: ${formatDate(m.dueDate)}`}>
                        <CalendarClock className="h-3 w-3" />
                        À payer
                      </span>
                    )
                  case 'not_due':
                    return (
                      <span className="badge h-5.5 min-h-5.5 gap-1 border-0 bg-base-200 px-2 text-[10px] font-semibold text-(--text-secondary)">
                        <Minus className="h-3 w-3" />
                        -
                      </span>
                    )
                  default:
                    return null
                }
              }

              return (
                <tr
                  key={m.month}
                  className={[
                    'h-11 border-b border-(--border-default)',
                    index % 2 === 1 ? 'bg-(--color-base-200)/45' : 'bg-(--card-bg)',
                    !hasData ? 'text-base-content/40' : '',
                  ].join(' ').trim()}
                >
                  <td className="px-4 text-sm font-medium text-(--text-primary)">{formatMonth(m.month)}</td>
                  <td className="px-4 text-right font-mono text-sm text-(--text-primary)">{collected > 0 ? formatCurrency(collected) : '-'}</td>
                  <td className="px-4 text-right font-mono text-sm text-(--color-success)">{recoverable > 0 ? formatCurrency(recoverable) : '-'}</td>
                  <td className="px-4 text-right font-mono text-sm">
                    {hasData ? (
                      <span className={net > 0 ? 'text-(--color-warning)' : 'text-(--color-success)'}>
                        {formatCurrency(net)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 text-center">{getPaymentStatusBadge()}</td>
                </tr>
              )
            })}
          </DataTable>
        )}
      </section>

      {/* Payments List */}
      <section className="space-y-3">
        <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">Paiements enregistres</h2>
        {isLoadingPayments ? (
          <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) py-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : !paymentsData?.data.length ? (
          <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) px-6 py-8 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <p className="text-base-content/60">Aucun paiement de TVA enregistre pour {selectedYear}.</p>
          </div>
        ) : (
          <DataTable columns={paymentColumns} minWidthClassName="">
            {paymentsData.data.map((payment, index) => (
              <tr
                key={payment.id}
                className={[
                  'h-12 border-b border-(--border-default)',
                  index % 2 === 1 ? 'bg-(--color-base-200)/45' : 'bg-(--card-bg)',
                ].join(' ')}
              >
                <td className="px-4">
                  <div className="text-sm font-medium text-(--text-primary)">{formatPeriodMonth(payment.periodMonth)}</div>
                  {payment.note && (
                    <div className="max-w-xs truncate text-xs text-base-content/60">{payment.note}</div>
                  )}
                </td>
                <td className="px-4 text-right font-mono text-sm font-bold text-(--text-primary)">{formatCurrency(payment.amount)}</td>
                <td className="px-4 text-center">
                  <span
                    className={`badge h-5.5 min-h-5.5 border-0 px-2 text-[10px] font-semibold ${
                      payment.status === 'paid'
                        ? 'bg-[#ECFDF5] text-[#16A34A]'
                        : 'bg-[#FFFBEB] text-[#B45309]'
                    }`}
                  >
                    {payment.status === 'paid' ? 'Payé' : 'En attente'}
                  </span>
                </td>
                <td className="px-4 text-right text-sm text-(--text-secondary)">{payment.paymentDate ? formatDate(payment.paymentDate) : '-'}</td>
                <td className="px-4 text-right text-sm text-base-content/60">{payment.reference || '-'}</td>
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
                      className="btn btn-ghost btn-xs h-6 min-h-6 w-6 p-0 text-error hover:bg-transparent"
                      onClick={() => setDeleteConfirmId(payment.id)}
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </section>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-xl rounded-2xl border border-(--border-default) p-0 shadow-[0_10px_32px_-8px_rgba(0,0,0,0.25)]">
            <div className="border-b border-(--border-default) px-7 py-5">
              <h3 className="font-bold text-xl text-(--text-primary)">
                {editingPayment ? 'Modifier le paiement TVA' : 'Nouveau paiement TVA'}
              </h3>
            </div>

            <div className="px-7 py-5">
              {error && (
                <div className="alert alert-error mb-4">
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="form-control">
                    <label className="label pb-1">
                      <span className="label-text text-[13px] font-semibold text-(--text-secondary)">Mois *</span>
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
                    <label className="label pb-1">
                      <span className="label-text text-[13px] font-semibold text-(--text-secondary)">Montant (EUR) *</span>
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
                    <label className="label pb-1">
                      <span className="label-text text-[13px] font-semibold text-(--text-secondary)">Statut *</span>
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
                      <label className="label pb-1">
                        <span className="label-text text-[13px] font-semibold text-(--text-secondary)">Date de paiement</span>
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
                    <label className="label pb-1">
                      <span className="label-text text-[13px] font-semibold text-(--text-secondary)">Référence</span>
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
                    <label className="label pb-1">
                      <span className="label-text text-[13px] font-semibold text-(--text-secondary)">Note</span>
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

                <div className="modal-action border-t border-(--border-default) mt-6 -mx-7 px-7 pt-4 pb-1">
                  <AppButton type="button" variant="outline" onClick={closeModal}>
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
                      'Creer'
                    )}
                  </AppButton>
                </div>
              </form>
            </div>
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
