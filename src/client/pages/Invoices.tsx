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
import { Pencil, Trash2, CreditCard } from 'lucide-react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useSnackbar } from '../contexts/SnackbarContext'
import { ComboSelect } from '../components/ComboSelect'

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

function getCurrentYear(): number {
  return new Date().getFullYear()
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

export default function Invoices() {
  const [selectedYear, setSelectedYear] = useState(getCurrentYear())
  const [clientFilter, setClientFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [formData, setFormData] = useState<InvoiceFormData>(defaultFormData)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)
  const [paymentDate, setPaymentDate] = useState('')
  const [error, setError] = useState('')

  const { showSuccess, showError } = useSnackbar()

  const { data: invoicesData, isLoading: isLoadingInvoices } = useInvoices({
    year: selectedYear,
    client: clientFilter || undefined,
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
    const remaining = totalHt - urssafAmount - estimatedTax

    return {
      totalHt,
      totalTtc: parseFloat(summary.totalTtc),
      taxTotal: parseFloat(summary.taxTotal),
      urssafAmount,
      estimatedTax,
      remaining,
      count: summary.count,
    }
  }, [summary, settings])

  // Group invoices by month
  const invoicesByMonth = useMemo(() => {
    if (!invoicesData?.data) return new Map<number, Invoice[]>()

    const grouped = new Map<number, Invoice[]>()

    invoicesData.data.forEach(invoice => {
      const month = new Date(invoice.invoiceDate).getMonth()
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

  const updateFormField = (field: keyof InvoiceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const calculatedTtc = useMemo(() => {
    const ht = parseFloat(formData.amountHt) || 0
    const rate = parseFloat(formData.taxRate) || 0
    return ht * (1 + rate / 100)
  }, [formData.amountHt, formData.taxRate])

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - i)
    }
    return years
  }, [])

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Factures</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          Ajouter une facture
        </button>
      </div>

      {/* Yearly Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">CA HT {selectedYear}</div>
          <div className="stat-value text-lg">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(calculatedSummary?.totalHt || 0)
            )}
          </div>
          <div className="stat-desc">{calculatedSummary?.count || 0} facture(s)</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">TVA collectée</div>
          <div className="stat-value text-lg text-base-content/70">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(calculatedSummary?.taxTotal || 0)
            )}
          </div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Urssaf</div>
          <div className="stat-value text-lg text-base-content/70">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(calculatedSummary?.urssafAmount || 0)
            )}
          </div>
          <div className="stat-desc">{settings ? parseFloat(settings.urssafRate) : 0}%</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Impôts (estimé)</div>
          <div className="stat-value text-lg text-base-content/70">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(calculatedSummary?.estimatedTax || 0)
            )}
          </div>
          <div className="stat-desc">{settings ? parseFloat(settings.estimatedTaxRate) : 0}%</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Restant</div>
          <div className="stat-value text-lg">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(calculatedSummary?.remaining || 0)
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="form-control">
          <label className="label">
            <span className="label-text">Année</span>
          </label>
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
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text">Client</span>
          </label>
          <input
            type="text"
            placeholder="Filtrer par client..."
            className="input input-bordered"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Invoice Timeline */}
      {isLoadingInvoices ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : invoicesByMonth.size === 0 ? (
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <p className="text-base-content/60">Aucune facture pour {selectedYear}.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(invoicesByMonth.entries()).map(([month, monthInvoices]) => {
            const monthTotal = monthInvoices.reduce((acc, inv) => acc + parseFloat(inv.amountHt), 0)
            const monthTotalTtc = monthInvoices.reduce((acc, inv) => acc + parseFloat(inv.amountTtc), 0)

            return (
              <div key={month} className="card bg-base-100 shadow">
                <div className="card-body">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="card-title">
                      {monthNames[month]} {selectedYear}
                    </h2>
                    <div className="text-right">
                      <div className="font-bold">{formatCurrency(monthTotal)} HT</div>
                      <div className="text-sm text-base-content/60">{formatCurrency(monthTotalTtc)} TTC</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>N° Facture</th>
                          <th>Client</th>
                          <th>Date</th>
                          <th>Paiement</th>
                          <th className="text-right">Montant HT</th>
                          <th className="text-right">TVA</th>
                          <th className="text-right">Montant TTC</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthInvoices.map((invoice) => (
                          <tr key={invoice.id} className="hover">
                            <td className="font-mono text-sm">
                              {invoice.invoiceNumber || '-'}
                            </td>
                            <td>
                              <div className="font-medium">{invoice.client}</div>
                              {invoice.description && (
                                <div className="text-sm text-base-content/60 truncate max-w-xs">
                                  {invoice.description}
                                </div>
                              )}
                            </td>
                            <td>{formatDate(invoice.invoiceDate)}</td>
                            <td>
                              {invoice.paymentDate ? (
                                <span className="badge badge-sm badge-success">
                                  {formatDate(invoice.paymentDate)}
                                </span>
                              ) : (
                                <button
                                  onClick={() => openPaymentModal(invoice)}
                                  className="btn btn-xs btn-warning gap-1"
                                  title="Enregistrer le paiement"
                                  disabled={updateMutation.isPending}
                                >
                                  <CreditCard className="h-3 w-3" />
                                  En attente
                                </button>
                              )}
                            </td>
                            <td className="text-right font-mono">
                              {formatCurrency(invoice.amountHt)}
                            </td>
                            <td className="text-right font-mono text-base-content/60">
                              {parseFloat(invoice.taxRate)}%
                            </td>
                            <td className="text-right font-mono font-medium">
                              {formatCurrency(invoice.amountTtc)}
                            </td>
                            <td>
                              <div className="flex gap-1">
                                <button
                                  className="btn btn-sm btn-ghost btn-square"
                                  onClick={() => openEditModal(invoice)}
                                  title="Modifier"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  className="btn btn-sm btn-ghost btn-square text-error"
                                  onClick={() => setDeleteConfirmId(invoice.id)}
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
                </div>
              </div>
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
