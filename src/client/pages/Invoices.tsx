import { useState, useMemo } from 'react'
import {
  useInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useInvoiceYearlySummary,
  useNextInvoiceNumber,
  useInvoiceClients,
  useInvoiceDescriptions,
} from '../hooks/useInvoices'
import { useSettings } from '../hooks/useSettings'
import type { Invoice, CreateInvoiceInput } from '@shared/types'
import { Pencil, Trash2, CreditCard, Ban, RotateCcw, Plus, Sparkles } from 'lucide-react'
import { YEARS } from '../utils/years'
import { useSnackbar } from '../contexts/SnackbarContext'
import { ComboSelect } from '../components/ComboSelect'
import { Alert, Badge, Button, ConfirmDialog, DataTable, DatePicker, Field, Input, Modal, Select, Spinner, StatCard, Textarea, YearSwitch, type DataTableColumn } from '@drillman/dashboard-ui'

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

function normalizeTaxRateForSelect(taxRate: string): string {
  const parsedRate = Number.parseFloat(taxRate)
  return Number.isNaN(parsedRate) ? taxRate : parsedRate.toString()
}

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

interface InvoiceFormData {
  client: string
  description: string
  invoiceDate: string
  paymentDate: string
  amountHt: string
  taxRate: string
  invoiceNumber: string
  note: string
}

const defaultFormData: InvoiceFormData = {
  client: '',
  description: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  paymentDate: '',
  amountHt: '',
  taxRate: '20',
  invoiceNumber: '',
  note: '',
}

const taxRateOptions = [
  { value: '0', label: '0% (Exonere)' },
  { value: '5.5', label: '5.5%' },
  { value: '10', label: '10%' },
  { value: '20', label: '20% (Taux normal)' },
]

export default function Invoices() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [formData, setFormData] = useState<InvoiceFormData>(defaultFormData)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)
  const [paymentDate, setPaymentDate] = useState('')
  const [hoveredVatInvoiceId, setHoveredVatInvoiceId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { showSuccess, showError } = useSnackbar()

  const { data: invoicesData, isLoading: isLoadingInvoices } = useInvoices({
    year: selectedYear,
  })

  const { data: summary, isLoading: isLoadingSummary } = useInvoiceYearlySummary(selectedYear)
  const { data: settings } = useSettings()

  const createMutation = useCreateInvoice()
  const updateMutation = useUpdateInvoice()
  const deleteMutation = useDeleteInvoice()
  const { refetch: refetchNextNumber } = useNextInvoiceNumber()
  const { data: clientsData } = useInvoiceClients()
  const { data: descriptionsData } = useInvoiceDescriptions()

  const calculatedSummary = useMemo(() => {
    if (!summary || !settings) return null

    const totalHt = parseFloat(summary.totalHt)
    const urssafRate = parseFloat(settings.urssafRate)
    const estimatedTaxRate = parseFloat(settings.estimatedTaxRate)

    const urssafAmount = totalHt * (urssafRate / 100)
    const estimatedTax = totalHt * (estimatedTaxRate / 100)

    return {
      totalHt,
      totalTtc: parseFloat(summary.totalTtc),
      taxTotal: parseFloat(summary.taxTotal),
      urssafAmount,
      estimatedTax,
      count: summary.count,
    }
  }, [summary, settings])

  const invoiceMetrics = useMemo(() => {
    const allInvoices = invoicesData?.data ?? []
    const activeInvoices = allInvoices.filter((invoice) => !invoice.isCanceled)
    const paidInvoices = activeInvoices.filter((invoice) => Boolean(invoice.paymentDate))
    const unpaidInvoices = activeInvoices.filter((invoice) => !invoice.paymentDate)

    const totalTtc = activeInvoices.reduce((acc, invoice) => acc + parseFloat(invoice.amountTtc), 0)
    const paidAmountTtc = paidInvoices.reduce((acc, invoice) => acc + parseFloat(invoice.amountTtc), 0)
    const pendingAmountTtc = unpaidInvoices.reduce((acc, invoice) => acc + parseFloat(invoice.amountTtc), 0)

    return {
      paidCount: paidInvoices.length,
      pendingCount: unpaidInvoices.length,
      totalTtc,
      paidAmountTtc,
      pendingAmountTtc,
      canceledCount: allInvoices.filter((invoice) => invoice.isCanceled).length,
    }
  }, [invoicesData])

  // Group invoices by month (prioritize payment date, fall back to invoice date)
  const invoicesByMonth = useMemo(() => {
    if (!invoicesData?.data) return new Map<number, Invoice[]>()

    const grouped = new Map<number, Invoice[]>()

    invoicesData.data.forEach(invoice => {
      // Use payment date if available, otherwise use invoice date
      const dateToUse = invoice.paymentDate || invoice.invoiceDate
      const month = new Date(dateToUse).getMonth()
      if (!grouped.has(month)) {
        grouped.set(month, [])
      }
      grouped.get(month)!.push(invoice)
    })

    // Sort months in descending order (most recent first)
    return new Map([...grouped.entries()].sort((a, b) => b[0] - a[0]))
  }, [invoicesData])

  const openCreateModal = async () => {
    setEditingInvoice(null)
    const { data } = await refetchNextNumber()
    setFormData({
      ...defaultFormData,
      invoiceNumber: data?.invoiceNumber || '',
    })
    setError('')
    setIsModalOpen(true)
  }

  const openEditModal = (invoice: Invoice) => {
    setEditingInvoice(invoice)
    setFormData({
      client: invoice.client,
      description: invoice.description || '',
      invoiceDate: invoice.invoiceDate,
      paymentDate: invoice.paymentDate || '',
      amountHt: invoice.amountHt,
      taxRate: normalizeTaxRateForSelect(invoice.taxRate),
      invoiceNumber: invoice.invoiceNumber || '',
      note: invoice.note || '',
    })
    setError('')
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingInvoice(null)
    setFormData(defaultFormData)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const data: CreateInvoiceInput = {
      client: formData.client.trim(),
      description: formData.description.trim() || undefined,
      invoiceDate: formData.invoiceDate,
      paymentDate: formData.paymentDate || undefined,
      amountHt: parseFloat(formData.amountHt),
      taxRate: parseFloat(formData.taxRate),
      invoiceNumber: formData.invoiceNumber.trim() || undefined,
      note: formData.note.trim() || undefined,
    }

    try {
      if (editingInvoice) {
        await updateMutation.mutateAsync({ id: editingInvoice.id, data })
        showSuccess('Facture modifiée avec succès')
      } else {
        await createMutation.mutateAsync(data)
        showSuccess('Facture créée avec succès')
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
      showSuccess('Facture supprimée avec succès')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const openPaymentModal = (invoice: Invoice) => {
    setPaymentInvoice(invoice)
    setPaymentDate(new Date().toISOString().split('T')[0])
    setIsPaymentModalOpen(true)
  }

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false)
    setPaymentInvoice(null)
    setPaymentDate('')
  }

  const handleConfirmPayment = async () => {
    if (!paymentInvoice) return
    try {
      await updateMutation.mutateAsync({
        id: paymentInvoice.id,
        data: { paymentDate },
      })
      showSuccess('Paiement enregistré avec succès')
      closePaymentModal()
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const handleToggleCanceled = async (invoice: Invoice) => {
    try {
      await updateMutation.mutateAsync({
        id: invoice.id,
        data: { isCanceled: !invoice.isCanceled },
      })
      showSuccess(invoice.isCanceled ? 'Facture restaurée' : 'Facture annulée')
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const updateFormField = (field: keyof InvoiceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const calculatedTtc = useMemo(() => {
    const ht = parseFloat(formData.amountHt) || 0
    const rate = parseFloat(formData.taxRate) || 0
    return ht * (1 + rate / 100)
  }, [formData.amountHt, formData.taxRate])

  const deleteInvoice = useMemo(() => {
    if (!deleteConfirmId) return null
    return invoicesData?.data.find((invoice) => invoice.id === deleteConfirmId) ?? null
  }, [deleteConfirmId, invoicesData])

  const deleteInvoiceNumber = deleteInvoice?.invoiceNumber || '-'

  const invoiceColumns: DataTableColumn<Invoice>[] = [
    {
      key: 'invoice-number',
      header: 'N° Facture',
      width: 'w-32',
      numeric: true,
      className: 'text-xs',
      cell: (invoice) => (
        <>
          <span className={invoice.isCanceled ? 'line-through' : undefined}>{invoice.invoiceNumber || '-'}</span>
          {invoice.isCanceled && (
            <Badge tone="danger" className="ml-2 font-sans">
              Annulée
            </Badge>
          )}
        </>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      cell: (invoice) => (
        <>
          <p className={`truncate font-medium ${invoice.isCanceled ? 'line-through' : ''}`}>{invoice.client}</p>
          {invoice.description && (
            <p className={`max-w-72.5 truncate text-xs text-text-secondary ${invoice.isCanceled ? 'line-through' : ''}`}>
              {invoice.description}
            </p>
          )}
        </>
      ),
    },
    {
      key: 'invoice-date',
      header: 'Date facture',
      width: 'w-32',
      className: 'whitespace-nowrap',
      cell: (invoice) => (
        <span className={invoice.isCanceled ? 'line-through' : undefined}>{formatDate(invoice.invoiceDate)}</span>
      ),
    },
    {
      key: 'payment-date',
      header: 'Paiement',
      width: 'w-36',
      cell: (invoice) =>
        invoice.isCanceled ? (
          <span className="text-text-secondary">-</span>
        ) : invoice.paymentDate ? (
          <Badge tone="success">{formatDate(invoice.paymentDate)}</Badge>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openPaymentModal(invoice)}
            disabled={updateMutation.isPending}
            className="h-7 border-warning/35 bg-warning-soft px-2.5 text-xs text-warning-strong hover:bg-warning-soft"
            startIcon={<CreditCard className="h-3.5 w-3.5" />}
          >
            Attente
          </Button>
        ),
    },
    {
      key: 'amount',
      header: 'Montant',
      align: 'right',
      width: 'w-40',
      cell: (invoice) => (
        <div className="flex flex-col items-end leading-tight">
          <div className="relative inline-flex flex-col items-end">
            <button
              type="button"
              className={`cursor-help bg-transparent p-0 text-right ${invoice.isCanceled ? 'line-through' : ''}`}
              onMouseEnter={() => setHoveredVatInvoiceId(invoice.id)}
              onMouseLeave={() => setHoveredVatInvoiceId((current) => (current === invoice.id ? null : current))}
              onFocus={() => setHoveredVatInvoiceId(invoice.id)}
              onBlur={() => setHoveredVatInvoiceId((current) => (current === invoice.id ? null : current))}
            >
              {formatCurrency(invoice.amountHt)} HT
            </button>
            {hoveredVatInvoiceId === invoice.id && (
              <span className="pointer-events-none absolute right-0 top-0 z-20 -translate-y-[120%] whitespace-nowrap rounded-md bg-text-primary px-2 py-1 text-2xs font-medium text-white shadow-dropdown">
                TVA ({parseFloat(invoice.taxRate)}%): {formatCurrency(parseFloat(invoice.amountTtc) - parseFloat(invoice.amountHt))}
              </span>
            )}
          </div>
          <span className={`text-xs text-text-secondary ${invoice.isCanceled ? 'line-through' : ''}`}>
            {formatCurrency(invoice.amountTtc)} TTC
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 'w-28',
      cell: (invoice) => (
        <div className="flex justify-end gap-1">
          {invoice.isCanceled ? (
            <Button
              size="sm" iconOnly
              variant="ghost"
              onClick={() => handleToggleCanceled(invoice)}
              title="Restaurer la facture"
              disabled={updateMutation.isPending}
              className="text-success hover:bg-success-soft"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button
                size="sm" iconOnly
                variant="ghost"
                onClick={() => openEditModal(invoice)}
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {!invoice.paymentDate && (
                <Button
                  size="sm" iconOnly
                  variant="ghost"
                  onClick={() => handleToggleCanceled(invoice)}
                  title="Annuler la facture"
                  disabled={updateMutation.isPending}
                  className="text-warning-strong hover:bg-warning-soft"
                >
                  <Ban className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
          <Button
            size="sm" iconOnly
            variant="ghost"
            onClick={() => setDeleteConfirmId(invoice.id)}
            title="Supprimer"
            className="text-danger hover:bg-danger-soft"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-kpi-lg font-bold leading-tight tracking-[-0.02em] text-text-primary">
            Factures
          </h1>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3 self-start">
          <YearSwitch years={[...YEARS]} value={selectedYear} onChange={setSelectedYear} />
          <Button startIcon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
            Ajouter une facture
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-3">
        <StatCard
          label={`CA HT ${selectedYear}`}
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(calculatedSummary?.totalHt || 0)}
          description={`${calculatedSummary?.count || 0} facture(s) - ${formatCurrency(calculatedSummary?.totalTtc || 0)} ttc`}
          color="var(--dui-series-1)"
        />
        <StatCard
          label="TVA collectée"
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(calculatedSummary?.taxTotal || 0)}
          description={isLoadingSummary ? 'Chargement...' : `Encaissée: ${formatCurrency(calculatedSummary?.totalTtc || 0)}`}
          color="var(--dui-series-1)"
        />
        <StatCard
          label="À encaisser"
          value={isLoadingSummary ? <Spinner size="sm" /> : formatCurrency(invoiceMetrics.pendingAmountTtc)}
          description={`${invoiceMetrics.pendingCount} facture(s) en attente`}
          color="var(--dui-series-3)"
          valueClassName={invoiceMetrics.pendingAmountTtc > 0 ? 'text-warning-strong' : ''}
        />
      </div>

      {/* Invoice Timeline */}
      {isLoadingInvoices ? (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      ) : invoicesByMonth.size === 0 ? (
        <div className="rounded-card border border-border bg-surface p-8 text-center ">
          <p className="text-sm text-text-secondary">Aucune facture pour {selectedYear}.</p>
          <div className="mt-4">
            <Button startIcon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
              Créer la première facture
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(invoicesByMonth.entries()).map(([month, monthInvoices]) => {
            const activeInvoices = monthInvoices.filter(inv => !inv.isCanceled)
            const monthTotal = activeInvoices.reduce((acc, inv) => acc + parseFloat(inv.amountHt), 0)
            const monthTotalTtc = activeInvoices.reduce((acc, inv) => acc + parseFloat(inv.amountTtc), 0)
            const monthPaid = activeInvoices.filter(inv => inv.paymentDate).length

            return (
              <section key={month} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <div>
                    <h2 className="font-display text-xl font-semibold tracking-[-0.01em] text-text-primary">
                      {monthNames[month]} {selectedYear}
                    </h2>
                    <p className="text-xs text-text-secondary">
                      {monthInvoices.length} facture(s), {monthPaid} payée(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold text-text-primary">
                      {formatCurrency(monthTotal)} HT
                    </div>
                    <div className="text-xs text-text-secondary">{formatCurrency(monthTotalTtc)} TTC</div>
                  </div>
                </div>

                <DataTable
                  columns={invoiceColumns}
                  rows={monthInvoices}
                  getRowKey={(invoice) => invoice.id}
                  isRowMuted={(invoice) => invoice.isCanceled}
                  layout="fixed"
                  minWidth="min-w-230"
                />
              </section>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={closeModal}
        size="xl"
        title={editingInvoice ? 'Modifier la facture' : 'Nouvelle facture'}
        description="Renseignez les informations de facturation et de paiement client."
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Annuler
            </Button>
            <Button type="submit" form="invoice-form" loading={createMutation.isPending || updateMutation.isPending}>
              {editingInvoice ? 'Enregistrer' : 'Créer'}
            </Button>
          </>
        }
      >
        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <form id="invoice-form" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Client" required className="md:col-span-2">
              <ComboSelect
                value={formData.client}
                options={clientsData?.clients || []}
                onChange={(value) => updateFormField('client', value)}
                placeholder="Sélectionner un client..."
                required
              />
            </Field>

            <Field label="N° Facture" className="md:col-span-2">
              <div className="flex gap-2">
                <Input
                  aria-label="N° Facture"
                  containerClassName="min-w-0 flex-1"
                  value={formData.invoiceNumber}
                  onChange={(e) => updateFormField('invoiceNumber', e.target.value)}
                  placeholder="FAC-YYYYMM-XXX"
                />
                <Button
                  type="button"
                  variant="secondary"
                  iconOnly
                  onClick={async () => {
                    const { data } = await refetchNextNumber()
                    if (data?.invoiceNumber) {
                      updateFormField('invoiceNumber', data.invoiceNumber)
                    }
                  }}
                  title="Générer automatiquement"
                  aria-label="Générer automatiquement"
                >
                  <Sparkles className="size-4" />
                </Button>
              </div>
            </Field>

            <Field label="Description" className="md:col-span-2">
              <ComboSelect
                value={formData.description}
                options={descriptionsData?.descriptions || []}
                onChange={(value) => updateFormField('description', value)}
                placeholder="Sélectionner une description..."
              />
            </Field>

            <DatePicker
              label="Date de facturation"
              required
              value={formData.invoiceDate}
              onChange={(value) => updateFormField('invoiceDate', value)}
            />

            <DatePicker
              label="Date de paiement"
              value={formData.paymentDate}
              onChange={(value) => updateFormField('paymentDate', value)}
            />

            <Input
              label="Montant HT"
              type="number"
              step="0.01"
              min="0"
              suffix="€"
              required
              value={formData.amountHt}
              onChange={(e) => updateFormField('amountHt', e.target.value)}
            />

            <Select
              label="Taux TVA (%)"
              required
              value={formData.taxRate}
              onChange={(e) => updateFormField('taxRate', e.target.value)}
              options={taxRateOptions}
            />

            <Textarea
              label="Note"
              containerClassName="md:col-span-2"
              rows={2}
              value={formData.note}
              onChange={(e) => updateFormField('note', e.target.value)}
              placeholder="Notes supplémentaires..."
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-card border border-border bg-surface-subtle px-4 py-3">
            <span className="text-xs font-medium text-text-secondary">Montant TTC calculé :</span>
            <span className="font-display text-xl font-semibold text-text-primary">
              {formatCurrency(calculatedTtc)}
            </span>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        open={isPaymentModalOpen && Boolean(paymentInvoice)}
        onClose={closePaymentModal}
        size="sm"
        title="Enregistrer le paiement"
        footer={
          <>
            <Button variant="secondary" onClick={closePaymentModal}>
              Annuler
            </Button>
            <Button onClick={handleConfirmPayment} loading={updateMutation.isPending}>
              Confirmer
            </Button>
          </>
        }
      >
        {paymentInvoice && (
          <>
            <p className="mb-4 text-sm text-text-secondary">
              Facture <span className="font-figures tabular-nums">{paymentInvoice.invoiceNumber || '-'}</span> pour{' '}
              <span className="font-medium text-text-primary">{paymentInvoice.client}</span>
            </p>
            <DatePicker label="Date de paiement" value={paymentDate} onChange={setPaymentDate} />
          </>
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        title="Supprimer la facture ?"
        message={`Cette action est irréversible. La facture ${deleteInvoiceNumber} et toutes les données associées seront définitivement supprimées.`}
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
