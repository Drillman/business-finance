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
import { Pencil, Trash2, CreditCard, Ban, RotateCcw, Plus } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useSnackbar } from '../contexts/SnackbarContext'
import { ComboSelect } from '../components/ComboSelect'
import { YearSelect } from '../components/PeriodSelect'
import { AppButton } from '../components/ui/AppButton'
import { KpiCard } from '../components/ui/KpiCard'
import { FinanceTable, type FinanceTableColumn } from '../components/ui/FinanceTable'

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

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

const invoiceColumns: FinanceTableColumn[] = [
  { key: 'invoice-number', label: 'N° Facture', className: 'w-[112px]' },
  { key: 'client', label: 'Client', className: 'w-[200px]' },
  { key: 'invoice-date', label: 'Date facture', className: 'w-[106px]' },
  { key: 'payment-date', label: 'Paiement', className: 'w-[116px]' },
  { key: 'amount-ht', label: 'Montant', className: 'w-[168px] text-right' },
  { key: 'actions', label: 'Actions', className: 'w-[96px] text-right' },
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
      taxRate: invoice.taxRate,
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

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-['Space_Grotesk'] text-[32px] font-bold leading-tight tracking-[-0.02em] text-(--text-primary)">
            Factures
          </h1>
          <p className="mt-1 text-sm text-(--text-secondary)">
            Suivi de la facturation et des paiements clients
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3 self-start">
          <YearSelect value={selectedYear} onChange={setSelectedYear} />
          <AppButton startIcon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
            Ajouter une facture
          </AppButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          title={`CA HT ${selectedYear}`}
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm" /> : formatCurrency(calculatedSummary?.totalHt || 0)}
          description={`${calculatedSummary?.count || 0} facture(s) - ${formatCurrency(invoiceMetrics.paidAmountTtc || 0)} ttc`}
          accentColor="#6366F1"
        />
        <KpiCard
          title="TVA collectée"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm" /> : formatCurrency(calculatedSummary?.taxTotal || 0)}
          description={isLoadingSummary ? 'Chargement...' : `Encaissée: ${formatCurrency(invoiceMetrics.paidAmountTtc)}`}
          accentColor="#3B82F6"
        />
        <KpiCard
          title="À encaisser"
          value={isLoadingSummary ? <span className="loading loading-spinner loading-sm" /> : formatCurrency(invoiceMetrics.pendingAmountTtc)}
          description={`${invoiceMetrics.pendingCount} facture(s) en attente`}
          accentColor="#FBBF24"
          valueClassName={invoiceMetrics.pendingAmountTtc > 0 ? 'text-[#B45309]' : ''}
        />
      </div>

      {/* Invoice Timeline */}
      {isLoadingInvoices ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : invoicesByMonth.size === 0 ? (
        <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) p-8 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-(--text-secondary)">Aucune facture pour {selectedYear}.</p>
          <div className="mt-4">
            <AppButton startIcon={<Plus className="h-4 w-4" />} onClick={openCreateModal}>
              Créer la première facture
            </AppButton>
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
                    <h2 className="font-['Space_Grotesk'] text-xl font-semibold tracking-[-0.01em] text-(--text-primary)">
                      {monthNames[month]} {selectedYear}
                    </h2>
                    <p className="text-xs text-(--text-secondary)">
                      {monthInvoices.length} facture(s), {monthPaid} payée(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-['Space_Grotesk'] text-lg font-semibold text-(--text-primary)">
                      {formatCurrency(monthTotal)} HT
                    </div>
                    <div className="text-xs text-(--text-secondary)">{formatCurrency(monthTotalTtc)} TTC</div>
                  </div>
                </div>

                <FinanceTable
                  columns={invoiceColumns}
                  minWidthClassName=""
                >
                  {monthInvoices.map((invoice, index) => (
                    <tr
                      key={invoice.id}
                      className={[
                        'h-12 border-b border-(--border-default) align-middle',
                        index % 2 === 1 ? 'bg-(--color-base-200)/45' : 'bg-(--card-bg)',
                        invoice.isCanceled ? 'opacity-55' : '',
                      ].join(' ')}
                    >
                      <td className="px-3 font-mono text-[11px] text-(--text-primary) md:px-4 md:text-xs">
                        <span className={invoice.isCanceled ? 'line-through' : ''}>{invoice.invoiceNumber || '-'}</span>
                        {invoice.isCanceled && (
                          <span className="ml-2 inline-flex rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold text-[#B91C1C]">
                            Annulée
                          </span>
                        )}
                      </td>
                      <td className="px-3 md:px-4">
                        <p className={['truncate text-sm font-medium text-(--text-primary)', invoice.isCanceled ? 'line-through' : ''].join(' ')}>
                          {invoice.client}
                        </p>
                        {invoice.description && (
                          <p className={[
                            'max-w-72.5 truncate text-xs text-(--text-secondary)',
                            invoice.isCanceled ? 'line-through' : '',
                          ].join(' ')}>
                            {invoice.description}
                          </p>
                        )}
                      </td>
                      <td className={['px-3 text-xs text-(--text-primary) md:px-4 md:text-sm', invoice.isCanceled ? 'line-through' : ''].join(' ')}>
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="px-3 md:px-4">
                        {invoice.isCanceled ? (
                          <span className="text-xs text-(--text-secondary) md:text-sm">-</span>
                        ) : invoice.paymentDate ? (
                          <span className="inline-flex rounded-full bg-[#DCFCE7] px-2 py-1 text-[11px] font-semibold text-[#15803D] md:text-xs">
                            {formatDate(invoice.paymentDate)}
                          </span>
                        ) : (
                          <AppButton
                            size="sm"
                            variant="outline"
                            onClick={() => openPaymentModal(invoice)}
                            disabled={updateMutation.isPending}
                            className="h-7 border-[#F59E0B]/35 bg-[#FFFBEB] px-2 text-[11px] text-[#92400E] hover:bg-[#FEF3C7] md:px-2.5 md:text-xs"
                            startIcon={<CreditCard className="h-3.5 w-3.5" />}
                          >
                            Attente
                          </AppButton>
                        )}
                      </td>
                      <td className="px-3 text-right md:px-4">
                        <div className="flex flex-col items-end leading-tight">
                          <div className="relative inline-flex flex-col items-end">
                            <button
                              type="button"
                              className={[
                                "cursor-help bg-transparent p-0 text-right text-sm font-['Space_Grotesk'] text-(--text-primary) md:text-sm",
                                invoice.isCanceled ? 'line-through' : '',
                              ].join(' ')}
                              onMouseEnter={() => setHoveredVatInvoiceId(invoice.id)}
                              onMouseLeave={() => setHoveredVatInvoiceId((current) => (current === invoice.id ? null : current))}
                              onFocus={() => setHoveredVatInvoiceId(invoice.id)}
                              onBlur={() => setHoveredVatInvoiceId((current) => (current === invoice.id ? null : current))}
                            >
                              {formatCurrency(invoice.amountHt)} HT
                            </button>
                            {hoveredVatInvoiceId === invoice.id && (
                              <span className="pointer-events-none absolute right-0 top-0 z-20 -translate-y-[120%] whitespace-nowrap rounded-md bg-[#111827] px-2 py-1 text-[10px] font-medium text-white shadow-lg">
                                TVA ({parseFloat(invoice.taxRate)}%): {formatCurrency(parseFloat(invoice.amountTtc) - parseFloat(invoice.amountHt))}
                              </span>
                            )}
                          </div>
                          <span
                            className={[
                              'font-mono text-[11px] text-(--text-secondary)',
                              invoice.isCanceled ? 'line-through' : '',
                            ].join(' ')}
                          >
                            {formatCurrency(invoice.amountTtc)} TTC
                          </span>
                        </div>
                      </td>
                      <td className="px-3 md:px-4">
                        <div className="flex justify-end gap-1">
                          {invoice.isCanceled ? (
                            <AppButton
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => handleToggleCanceled(invoice)}
                              title="Restaurer la facture"
                              disabled={updateMutation.isPending}
                              className="text-[#059669] hover:bg-[#ECFDF5]"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </AppButton>
                          ) : (
                            <>
                              <AppButton
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => openEditModal(invoice)}
                                title="Modifier"
                              >
                                <Pencil className="h-4 w-4" />
                              </AppButton>
                              {!invoice.paymentDate && (
                                <AppButton
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => handleToggleCanceled(invoice)}
                                  title="Annuler la facture"
                                  disabled={updateMutation.isPending}
                                  className="text-[#B45309] hover:bg-[#FFFBEB]"
                                >
                                  <Ban className="h-4 w-4" />
                                </AppButton>
                              )}
                            </>
                          )}
                          <AppButton
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(invoice.id)}
                            title="Supprimer"
                            className="text-(--color-error) hover:bg-[#FEE2E2]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </AppButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </FinanceTable>
              </section>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              {editingInvoice ? 'Modifier la facture' : 'Nouvelle facture'}
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
                    <span className="label-text">Client *</span>
                  </label>
                  <ComboSelect
                    value={formData.client}
                    options={clientsData?.clients || []}
                    onChange={(value) => updateFormField('client', value)}
                    placeholder="Sélectionner un client..."
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">N° Facture</span>
                  </label>
                  <div className="join w-full">
                    <input
                      type="text"
                      className="input input-bordered join-item flex-1"
                      value={formData.invoiceNumber}
                      onChange={(e) => updateFormField('invoiceNumber', e.target.value)}
                      placeholder="FAC-YYYYMM-XXX"
                    />
                    <button
                      type="button"
                      className="btn join-item"
                      onClick={async () => {
                        const { data } = await refetchNextNumber()
                        if (data?.invoiceNumber) {
                          updateFormField('invoiceNumber', data.invoiceNumber)
                        }
                      }}
                      title="Générer automatiquement"
                    >
                      Auto
                    </button>
                  </div>
                </div>

                <div className="form-control md:col-span-2">
                  <label className="label">
                    <span className="label-text">Description</span>
                  </label>
                  <ComboSelect
                    value={formData.description}
                    options={descriptionsData?.descriptions || []}
                    onChange={(value) => updateFormField('description', value)}
                    placeholder="Sélectionner une description..."
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Date de facturation *</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered w-full"
                    value={formData.invoiceDate}
                    onChange={(e) => updateFormField('invoiceDate', e.target.value)}
                    required
                  />
                </div>

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

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Montant HT (€) *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input input-bordered w-full"
                    value={formData.amountHt}
                    onChange={(e) => updateFormField('amountHt', e.target.value)}
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Taux TVA (%) *</span>
                  </label>
                  <select
                    className="select select-bordered w-full"
                    value={formData.taxRate}
                    onChange={(e) => updateFormField('taxRate', e.target.value)}
                  >
                    <option value="0">0% (Exonéré)</option>
                    <option value="5.5">5.5%</option>
                    <option value="10">10%</option>
                    <option value="20">20% (Taux normal)</option>
                  </select>
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

              {/* Calculated TTC */}
              {formData.amountHt && (
                <div className="mt-4 p-4 bg-base-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-base-content/70">Montant TTC calculé :</span>
                    <span className="text-xl font-bold">{formatCurrency(calculatedTtc)}</span>
                  </div>
                </div>
              )}

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
                  ) : editingInvoice ? (
                    'Enregistrer'
                  ) : (
                    'Créer'
                  )}
                </button>
              </div>
            </form>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={closeModal}></div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && paymentInvoice && (
        <div className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">Enregistrer le paiement</h3>
            <p className="text-base-content/70 mb-4">
              Facture <span className="font-mono">{paymentInvoice.invoiceNumber || '-'}</span> pour{' '}
              <span className="font-medium">{paymentInvoice.client}</span>
            </p>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Date de paiement</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="modal-action">
              <button type="button" className="btn" onClick={closePaymentModal}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleConfirmPayment}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Confirmer'
                )}
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={closePaymentModal}></div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title="Supprimer la facture"
        message="Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible."
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
