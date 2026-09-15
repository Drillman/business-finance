import { useState } from 'react'
import {
  useUrssafSummary,
  useCreateUrssafPayment,
  useUpdateUrssafPayment,
  useDeleteUrssafPayment,
} from '../hooks/useUrssaf'
import type { UrssafPayment, CreateUrssafPaymentInput } from '@shared/types'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { YEARS } from '../utils/years'
import { useSnackbar } from '../contexts/SnackbarContext'
import { Badge, Button, ConfirmDialog, DataTable, Select, Spinner, StatCard, YearSwitch, type DataTableColumn } from '@drillman/dashboard-ui'

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
  type Trimester = NonNullable<typeof summary>['trimesters'][number]

  const quarterlyColumns: DataTableColumn<Trimester>[] = [
    { key: 'trimester', header: 'Trimestre', width: 'w-36', className: 'font-semibold', cell: (trimester) => trimesterLabels[trimester.trimester] },
    {
      key: 'actual-revenue',
      header: 'CA réel',
      align: 'right',
      width: 'w-36',
      cell: (trimester) => (parseFloat(trimester.actualRevenue) > 0 ? formatCurrency(trimester.actualRevenue) : '-'),
      footer: formatCurrency(summary?.trimesters.reduce((acc, t) => acc + parseFloat(t.actualRevenue), 0) || 0),
    },
    {
      key: 'estimated',
      header: 'Cotisation estimée',
      align: 'right',
      width: 'w-40',
      className: 'text-text-secondary',
      cell: (trimester) => (parseFloat(trimester.estimatedAmount) > 0 ? formatCurrency(trimester.estimatedAmount) : '-'),
      footer: formatCurrency(summary?.trimesters.reduce((acc, t) => acc + parseFloat(t.estimatedAmount), 0) || 0),
    },
    {
      key: 'declared',
      header: 'Cotisation déclarée',
      align: 'right',
      width: 'w-40',
      className: 'font-semibold',
      cell: (trimester) => (trimester.payment ? formatCurrency(trimester.payment.amount) : '-'),
      footer: formatCurrency(summary?.totals.totalAmount || '0'),
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      width: 'w-32',
      cell: (trimester) =>
        trimester.payment ? (
          <Badge tone={trimester.payment.status === 'paid' ? 'success' : 'warning'}>
            {trimester.payment.status === 'paid' ? 'Payé' : 'En attente'}
          </Badge>
        ) : (
          <Badge>Non déclaré</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: 'w-28',
      cell: (trimester) => {
        const payment = trimester.payment
        return (
          <div className="flex justify-center gap-1">
            {payment ? (
              <>
                <Button variant="ghost" size="sm" iconOnly className="size-7 text-text-secondary"
                  onClick={() => openEditModal(payment)}
                  title="Modifier"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" iconOnly className="size-7 text-danger"
                  onClick={() => setDeleteConfirmId(payment.id)}
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => openCreateModal(trimester.trimester)}>
                Déclarer
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Urssaf</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <YearSwitch years={[...YEARS]} value={selectedYear} onChange={setSelectedYear} />
          <Button
            className=""
            onClick={() => openCreateModal()}
          >
            Ajouter une cotisation
          </Button>
        </div>
      </div>

      {/* Annual Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="CA déclaré"
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(summary?.totals.totalRevenue || '0')}
          description="Chiffre d'affaires total"
          color="var(--dui-series-1)"
        />
        <StatCard
          label="Cotisations dues"
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(summary?.totals.totalAmount || '0')}
          description={`Taux: ${summary?.urssafRate || 22}%`}
          color="var(--dui-series-3)"
        />
        <StatCard
          label="Cotisations payées"
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(summary?.totals.totalPaid || '0')}
          description="Paiements validés"
          color="var(--dui-series-2)"
        />
        <StatCard
          label="Reste à payer"
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(summary?.totals.totalPending || '0')}
          description="Montant à régulariser"
          color="var(--dui-series-5)"
          valueClassName={summary && parseFloat(summary.totals.totalPending) <= 0 ? 'text-success' : ''}
        />
      </div>

      {/* Quarterly Breakdown */}
      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-text-primary">
          Cotisations trimestrielles {selectedYear}
        </h2>

        {isLoadingSummary ? (
          <div className="rounded-card border border-border bg-surface py-8 text-center ">
            <Spinner size="lg" />
          </div>
        ) : (
          <DataTable
            columns={quarterlyColumns}
            rows={summary?.trimesters ?? []}
            getRowKey={(trimester) => trimester.trimester}
            footerLabel={`Total ${selectedYear}`}
            minWidth="min-w-190"
          />
        )}
      </section>

      {/* Info Card */}
      <section className="rounded-card border border-border bg-accent-soft px-6 py-5 ">
        <h3 className="font-display text-base font-semibold text-accent-strong">Information</h3>
        <p className="mt-2 text-sm text-text-primary">
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

          <div className="relative w-full max-w-140 overflow-hidden rounded-2xl border border-border bg-surface shadow-modal">
            <div className="flex items-center justify-between px-7 pt-6 pb-0">
              <div>
                <h3 className="font-display text-kpi-sm font-semibold tracking-[-0.02em] text-text-primary">
                  {modalTitle}
                </h3>
                <p className="mt-1 text-compact text-text-secondary">
                  Déclarez vos cotisations trimestrielles
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[65vh] space-y-4 overflow-y-auto px-7 py-5">
                {error && (
                  <div className="rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-strong">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-compact font-medium text-text-primary">Trimestre *</label>
                    <Select
                      className="h-10"
                      value={formData.trimester}
                      onChange={(e) => updateFormField('trimester', e.target.value)}
                      options={trimesterOptions}
                      disabled={!!editingPayment}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-compact font-medium text-text-primary">Année *</label>
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
                  <label className="block text-compact font-medium text-text-primary">
                    Chiffre d'affaires (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary focus:border-accent focus:outline-none"
                    value={formData.revenue}
                    onChange={(e) => updateFormField('revenue', e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
                  <div className="space-y-1.5">
                    <label className="block text-compact font-medium text-text-primary">
                      Montant cotisation (€) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary focus:border-accent focus:outline-none"
                      value={formData.amount}
                      onChange={(e) => updateFormField('amount', e.target.value)}
                      required
                    />
                    <p className="text-[11px] text-text-muted">
                      Estimation : {urssafRate}% du CA
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-compact font-medium text-text-primary">Statut *</label>
                    <Select
                      className="h-10"
                      value={formData.status}
                      onChange={(e) => updateFormField('status', e.target.value)}
                      options={statusOptions}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-compact font-medium text-text-primary">Date de paiement</label>
                  <input
                    type="date"
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary focus:border-accent focus:outline-none"
                    value={formData.paymentDate}
                    onChange={(e) => updateFormField('paymentDate', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-compact font-medium text-text-primary">
                    Référence <span className="text-xs font-normal text-text-muted">(optionnel)</span>
                  </label>
                  <input
                    type="text"
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                    value={formData.reference}
                    onChange={(e) => updateFormField('reference', e.target.value)}
                    placeholder="Numéro de déclaration..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-compact font-medium text-text-primary">
                    Note <span className="text-xs font-normal text-text-muted">(optionnel)</span>
                  </label>
                  <textarea
                    className="min-h-16 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                    value={formData.note}
                    onChange={(e) => updateFormField('note', e.target.value)}
                    placeholder="Notes supplémentaires..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2 rounded-lg bg-accent-soft px-4 py-3.5">
                  <div className="flex items-center justify-between text-compact">
                    <span className="text-text-secondary">Chiffre d'affaires :</span>
                    <span className="font-medium text-text-primary">{formatCurrency(parsedRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-compact">
                    <span className="text-text-secondary">Taux Urssaf :</span>
                    <span className="font-medium text-text-primary">{urssafRate}%</span>
                  </div>
                  <div className="h-px w-full bg-border" />
                  <div className="flex items-center justify-between text-compact">
                    <span className="text-text-secondary">Cotisation due :</span>
                    <span className="font-display text-base font-semibold text-accent">
                      {formatCurrency(formData.amount ? parsedAmount : calculatedAmount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-border" />
              <div className="flex items-center justify-end gap-3 px-7 pt-4 pb-6">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  startIcon={isSubmitting ? null : <Check className="h-4 w-4" />}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Spinner size="sm" />
                  ) : (
                    submitLabel
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Supprimer la cotisation Urssaf"
        message="Êtes-vous sûr de vouloir supprimer cette cotisation ? Cette action est irréversible."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        tone="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  )
}
