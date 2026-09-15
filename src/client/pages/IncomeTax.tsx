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
import { YEARS } from '../utils/years'
import { useSnackbar } from '../contexts/SnackbarContext'
import { MathInput } from '../components/MathInput'
import { Badge, Button, ConfirmDialog, DataTable, DataTableEmpty, DatePicker, Input, Modal, Select, Spinner, StatCard, Textarea, YearSwitch, type DataTableColumn } from '@drillman/dashboard-ui'

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

  type ActiveBracket = (typeof activeBrackets)[number]

  const bracketColumns: DataTableColumn<ActiveBracket>[] = [
    {
      key: 'bracket',
      header: 'Tranche',
      numeric: true,
      cell: (bracket) =>
        bracket.maxIncome
          ? `${formatCurrency(bracket.minIncome)} - ${formatCurrency(bracket.maxIncome)}`
          : `> ${formatCurrency(bracket.minIncome)}`,
    },
    { key: 'rate', header: 'Taux', align: 'right', width: 'w-20', className: 'text-text-secondary', cell: (bracket) => formatPercent(bracket.rate) },
    { key: 'income', header: 'Revenu', align: 'right', width: 'w-32', cell: (bracket) => formatCurrency(parseFloat(bracket.taxableAmount)) },
    {
      key: 'tax',
      header: 'Impôt',
      align: 'right',
      width: 'w-32',
      className: 'font-semibold',
      cell: (bracket) => formatCurrency(parseFloat(bracket.taxAmount)),
      footer: <span className="font-bold text-warning">{formatCurrency(estimatedTax)}</span>,
    },
  ]

  const paymentColumns: DataTableColumn<IncomeTaxPayment>[] = [
    {
      key: 'date',
      header: 'Date',
      width: 'w-36',
      className: 'whitespace-nowrap',
      cell: (payment) => (payment.paymentDate ? formatDate(payment.paymentDate) : formatDate(payment.createdAt)),
    },
    { key: 'amount', header: 'Montant', align: 'right', width: 'w-32', className: 'font-semibold', cell: (payment) => formatCurrency(payment.amount) },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      width: 'w-32',
      cell: (payment) => (
        <Badge tone={payment.status === 'paid' ? 'success' : 'warning'}>
          {payment.status === 'paid' ? 'Payé' : 'En attente'}
        </Badge>
      ),
    },
    { key: 'reference', header: 'Référence', width: 'w-40', className: 'text-text-secondary', cell: (payment) => payment.reference || '-' },
    { key: 'note', header: 'Note', className: 'text-text-secondary', cell: (payment) => payment.note || '-' },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: 'w-24',
      cell: (payment) => (
        <div className="flex justify-center gap-1">
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
        </div>
      ),
    },
  ]

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Impôts sur le revenu</h1>
        <div className="flex flex-wrap items-center gap-3">
          <YearSwitch years={[...YEARS]} value={selectedYear} onChange={setSelectedYear} />
          <Button className="" onClick={openCreateModal}>
            Ajouter un paiement
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="CA ANNUEL"
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(summary?.totalRevenue || '0')}
          description="Factures payées"
          color="var(--dui-series-1)"
        />
        <StatCard
          label="REVENU IMPOSABLE"
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(summary?.taxableIncome || '0')}
          description={(
            <>
              Après abattement ({formatPercent(summary?.deductionRate || '34')})
              {parseFloat(summary?.additionalTaxableIncome || '0') > 0 && (
                <> + {formatCurrency(summary?.additionalTaxableIncome || '0')}</>
              )}
            </>
          )}
          valueClassName="text-text-secondary"
        />
        <StatCard
          label="IMPÔT ESTIMÉ"
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(estimatedTax)}
          description="Selon les tranches fiscales"
          valueClassName="text-text-secondary"
        />
        <StatCard
          label="RESTE À PAYER"
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(remaining)}
          description={totalPaid > 0 ? `${formatCurrency(totalPaid)} déjà payé` : 'Aucun paiement enregistré'}
          color="var(--dui-series-3)"
        />
      </div>

      <section className="rounded-card border border-border bg-surface p-6 ">
        <h2 className="font-display text-base font-semibold text-text-primary">Revenu imposable supplémentaire</h2>
        <p className="mt-3 max-w-275 text-compact leading-relaxed text-text-secondary">
          Ajoutez un montant supplémentaire à votre revenu imposable (ex: autres revenus, revenus fonciers). Vous pouvez utiliser des expressions mathématiques (ex: 1000 + 500).
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex w-full max-w-70 flex-col gap-1.5">
            <span className="text-compact font-medium text-text-secondary">Montant supplémentaire (EUR)</span>
            <MathInput
              value={additionalIncomeDraft}
              onChange={setAdditionalIncomeDraft}
              placeholder="0"
              disabled={updateSettingsMutation.isPending}
              className="h-10 border-border! bg-surface!"
            />
          </label>

          <Button
            startIcon={updateSettingsMutation.isPending ? <Spinner size="xs" /> : <Check className="h-4 w-4" />}
            onClick={handleAdditionalIncomeSave}
            disabled={updateSettingsMutation.isPending}
          >
            Valider
          </Button>
        </div>
      </section>

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)_340px]">
        <section className="overflow-hidden rounded-card border border-border bg-surface ">
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-display text-base font-semibold text-text-primary">
              Calcul progressif de l'impôt {selectedYear}
            </h2>
          </div>

          {isLoadingSummary ? (
            <div className="flex justify-center py-10">
              <Spinner size="lg" />
            </div>
          ) : activeBrackets.length > 0 ? (
            <DataTable
              variant="plain"
              columns={bracketColumns}
              rows={activeBrackets}
              getRowKey={(_, index) => index}
              footerLabel="Total impôt estimé"
            />
          ) : (
            <p className="px-6 py-8 text-sm text-text-secondary">Aucun revenu enregistré pour cette année.</p>
          )}
        </section>

        <section className="h-fit rounded-card border border-border bg-surface p-6 ">
          <h2 className="font-display text-base font-semibold text-text-primary">Avancement des paiements</h2>
          <p className="mt-4 text-sm font-medium text-text-primary">
            {formatCurrency(totalProgress)} / {formatCurrency(estimatedTax)}
          </p>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progressPercent}%` }}></div>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-compact">
            <div className="flex items-center gap-2 text-text-primary">
              <span className="h-2 w-2 rounded-full bg-success"></span>
              <span>Payé: {formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex items-center gap-2 text-text-primary">
              <span className="h-2 w-2 rounded-full bg-warning"></span>
              <span>En attente: {formatCurrency(totalPending)}</span>
            </div>
            <div className="flex items-center gap-2 text-text-primary">
              <span className="h-2 w-2 rounded-full bg-danger"></span>
              <span>Reste: {formatCurrency(remaining)}</span>
            </div>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-text-primary">Paiements d'impôts {selectedYear}</h2>
        <DataTable
          columns={paymentColumns}
          rows={paymentsData?.data ?? []}
          getRowKey={(payment) => payment.id}
          loading={isLoadingPayments}
          loadingRows={2}
          minWidth="min-w-220"
          empty={
            <DataTableEmpty
              title={`Aucun paiement enregistré pour ${selectedYear}.`}
              action={
                <Button size="sm" variant="secondary" onClick={openCreateModal}>
                  Ajouter un paiement
                </Button>
              }
            />
          }
        />
      </section>

      {/* Create/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        size="xl"
        title={editingPayment ? 'Modifier le paiement' : "Nouveau paiement d'impôt"}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Annuler
            </Button>
            <Button type="submit" form="income-tax-payment-form" loading={isSubmitting}>
              {editingPayment ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </>
        }
      >
        <form id="income-tax-payment-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Année"
            required
            value={formData.year}
            onChange={(e) => updateFormField('year', e.target.value)}
            options={YEARS.map((year) => ({ value: year.toString(), label: year.toString() }))}
          />

          <Input
            label="Montant"
            type="number"
            step="0.01"
            min="0"
            suffix="€"
            required
            value={formData.amount}
            onChange={(e) => updateFormField('amount', e.target.value)}
          />

          <Select
            label="Statut"
            required
            value={formData.status}
            onChange={(e) => updateFormField('status', e.target.value)}
            options={[
              { value: 'pending', label: 'En attente' },
              { value: 'paid', label: 'Payé' },
            ]}
          />

          {formData.status === 'paid' && (
            <DatePicker
              label="Date de paiement"
              value={formData.paymentDate}
              onChange={(value) => updateFormField('paymentDate', value)}
            />
          )}

          <Input
            label="Référence"
            containerClassName="md:col-span-2"
            value={formData.reference}
            onChange={(e) => updateFormField('reference', e.target.value)}
            placeholder="Numéro de référence..."
          />

          <Textarea
            label="Note"
            containerClassName="md:col-span-2"
            rows={2}
            value={formData.note}
            onChange={(e) => updateFormField('note', e.target.value)}
            placeholder="Notes supplémentaires..."
          />
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Supprimer le paiement"
        message="Êtes-vous sûr de vouloir supprimer ce paiement ? Cette action est irréversible."
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
