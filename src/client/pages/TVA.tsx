import { useState } from 'react'
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
import { Pencil, Trash2, Check, Clock, AlertCircle, CalendarClock, Minus } from 'lucide-react'
import { YEARS } from '../utils/years'
import { useSnackbar } from '../contexts/SnackbarContext'
import { TvaTabs } from '../components/TvaTabs'
import { Alert, Badge, Button, ConfirmDialog, DataTable, DatePicker, Input, Modal, Select, Spinner, StatCard, Textarea, YearSwitch, type DataTableColumn } from '@drillman/dashboard-ui'

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

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const isCurrentYearSelected = selectedYear === now.getFullYear()
  const currentMonthData = isCurrentYearSelected
    ? monthlyData?.months.find((m) => m.month === currentMonth)
    : null

  const totalPendingAmount = parseFloat(summary?.totalPending || '0')
  const currentMonthNetTva = parseFloat(currentMonthData?.netTva || '0')
  const currentMonthDeclaredAmount = currentMonthData
    ? parseFloat(currentMonthData.paidAmount) + parseFloat(currentMonthData.pendingAmount)
    : 0
  const undeclaredCurrentMonthAmount = Math.max(0, currentMonthNetTva - currentMonthDeclaredAmount)
  const remainingToDeclareAndPay = totalPendingAmount + undeclaredCurrentMonthAmount

  type TvaMonth = NonNullable<typeof monthlyData>['months'][number]

  const renderPaymentStatusBadge = (m: TvaMonth) => {
    if (parseFloat(m.netTva) <= 0) {
      return <Badge icon={<Minus />}>N/A</Badge>
    }

    switch (m.paymentStatus) {
      case 'paid':
        return (
          <Badge tone="success" icon={<Check />}>
            Payé
          </Badge>
        )
      case 'pending':
        return (
          <Badge tone="warning" icon={<Clock />}>
            En attente
          </Badge>
        )
      case 'overdue':
        return (
          <Badge tone="danger" title={`Échéance: ${formatDate(m.dueDate)}`} icon={<AlertCircle />}>
            En retard
          </Badge>
        )
      case 'upcoming':
        return (
          <Badge tone="accent" title={`Échéance: ${formatDate(m.dueDate)}`} icon={<CalendarClock />}>
            À payer
          </Badge>
        )
      case 'not_due':
        return <Badge icon={<Minus />}>-</Badge>
      default:
        return null
    }
  }

  const summaryNetTva = parseFloat(summary?.netTva || '0')

  const monthlyColumns: DataTableColumn<TvaMonth>[] = [
    { key: 'month', header: 'Mois', className: 'font-medium', cell: (m) => formatMonth(m.month) },
    {
      key: 'collected',
      header: 'Collectée',
      align: 'right',
      width: 'w-32',
      cell: (m) => (parseFloat(m.tvaCollected) > 0 ? formatCurrency(m.tvaCollected) : '-'),
      footer: formatCurrency(summary?.tvaCollected || '0'),
    },
    {
      key: 'recoverable',
      header: 'Récupérable',
      align: 'right',
      width: 'w-32',
      className: 'text-success',
      cell: (m) => (parseFloat(m.tvaRecoverable) > 0 ? formatCurrency(m.tvaRecoverable) : '-'),
      footer: formatCurrency(summary?.tvaRecoverable || '0'),
    },
    {
      key: 'net',
      header: 'Nette',
      align: 'right',
      width: 'w-32',
      cell: (m) => {
        const net = parseFloat(m.netTva)
        const hasData = parseFloat(m.tvaCollected) > 0 || parseFloat(m.tvaRecoverable) > 0
        if (!hasData) return '-'
        return <span className={net > 0 ? 'text-warning' : 'text-success'}>{formatCurrency(Math.round(net))}</span>
      },
      footer: (
        <span className={summaryNetTva > 0 ? 'text-warning' : 'text-success'}>{formatCurrency(Math.round(summaryNetTva))}</span>
      ),
    },
    { key: 'payment', header: 'Paiement', align: 'center', width: 'w-32', cell: renderPaymentStatusBadge },
  ]

  const paymentColumns: DataTableColumn<TaxPayment>[] = [
    {
      key: 'period',
      header: 'Période',
      cell: (payment) => (
        <>
          <div className="font-medium">{formatPeriodMonth(payment.periodMonth)}</div>
          {payment.note && <div className="max-w-xs truncate text-xs text-text-secondary">{payment.note}</div>}
        </>
      ),
    },
    { key: 'amount', header: 'Montant', align: 'right', width: 'w-32', className: 'font-semibold', cell: (payment) => formatCurrency(payment.amount) },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      width: 'w-28',
      cell: (payment) => (
        <Badge tone={payment.status === 'paid' ? 'success' : 'warning'}>
          {payment.status === 'paid' ? 'Payé' : 'En attente'}
        </Badge>
      ),
    },
    {
      key: 'payment-date',
      header: 'Date paiement',
      align: 'right',
      numeric: false,
      width: 'w-36',
      className: 'text-text-secondary',
      cell: (payment) => (payment.paymentDate ? formatDate(payment.paymentDate) : '-'),
    },
    {
      key: 'reference',
      header: 'Référence',
      align: 'right',
      numeric: false,
      width: 'w-36',
      className: 'text-text-secondary',
      cell: (payment) => payment.reference || '-',
    },
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">TVA</h1>
        <div className="flex flex-wrap items-center gap-3">
          <YearSwitch years={[...YEARS]} value={selectedYear} onChange={setSelectedYear} />
          <Button className="" onClick={openCreateModal}>
            Ajouter un paiement
          </Button>
        </div>
      </div>

      <TvaTabs active="suivi" />

      {/* Annual Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="TVA collectée"
          value={
            isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(summary?.tvaCollected || '0')
          }
          description="Sur les factures payées"
          color="var(--dui-series-1)"
          valueClassName="text-lg"
        />
        <StatCard
          label="TVA récupérable"
          value={
            isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(summary?.tvaRecoverable || '0')
          }
          description={
            <Link to="/expenses" className="font-medium text-accent hover:underline">
              Issue de vos dépenses — voir →
            </Link>
          }
          color="var(--dui-series-2)"
          valueClassName="text-lg"
        />
        <StatCard
          label="TVA nette à payer"
          value={
            isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(summary?.netTva || '0')
          }
          description="Collectée - Récupérable"
          color="var(--dui-series-3)"
          tone={parseFloat(summary?.netTva || '0') > 0 ? 'warning' : 'success'}
          valueClassName="text-lg"
        />
        <StatCard
          label="À déclarer et payer"
          value={
            isLoadingSummary || isLoadingMonthly
              ? <Spinner size="sm" />
              : formatCurrency(remainingToDeclareAndPay)
          }
          color="var(--dui-series-5)"
          valueClassName="text-lg"
        />
      </div>

      {/* Monthly Breakdown */}
      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-text-primary">Détail mensuel</h2>
        {isLoadingMonthly ? (
          <div className="rounded-card border border-border bg-surface py-8 text-center ">
            <Spinner size="lg" />
          </div>
        ) : (
          <DataTable
            columns={monthlyColumns}
            rows={monthlyData?.months ?? []}
            getRowKey={(m) => m.month}
            footerLabel="Total"
            minWidth="min-w-170"
          />
        )}
      </section>

      {/* Payments List */}
      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-text-primary">Paiements enregistres</h2>
        {isLoadingPayments ? (
          <div className="rounded-card border border-border bg-surface py-8 text-center ">
            <Spinner size="lg" />
          </div>
        ) : !paymentsData?.data.length ? (
          <div className="rounded-card border border-border bg-surface px-6 py-8 ">
            <p className="text-text-secondary">Aucun paiement de TVA enregistre pour {selectedYear}.</p>
          </div>
        ) : (
          <DataTable
            columns={paymentColumns}
            rows={paymentsData.data}
            getRowKey={(payment) => payment.id}
            minWidth="min-w-190"
          />
        )}
      </section>

      {/* Create/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        size="xl"
        title={editingPayment ? 'Modifier le paiement TVA' : 'Nouveau paiement TVA'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Annuler
            </Button>
            <Button type="submit" form="tva-payment-form" loading={isSubmitting}>
              {editingPayment ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <form id="tva-payment-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Mois"
            type="month"
            required
            value={formData.periodMonth}
            onChange={(e) => updateFormField('periodMonth', e.target.value)}
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
        title="Supprimer le paiement TVA"
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
