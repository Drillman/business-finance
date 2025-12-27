import { useState, useMemo } from 'react'
import {
  useInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useInvoiceYearlySummary,
} from '../hooks/useInvoices'
import { useSettings } from '../hooks/useSettings'
import type { Invoice, CreateInvoiceInput } from '@shared/types'

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

function generateInvoiceNumber(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `FAC-${year}${month}-${random}`
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
  const [error, setError] = useState('')

  const { data: invoicesData, isLoading: isLoadingInvoices } = useInvoices({
    year: selectedYear,
    client: clientFilter || undefined,
  })

  const { data: summary, isLoading: isLoadingSummary } = useInvoiceYearlySummary(selectedYear)
  const { data: settings } = useSettings()

  const createMutation = useCreateInvoice()
  const updateMutation = useUpdateInvoice()
  const deleteMutation = useDeleteInvoice()

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

  const openCreateModal = () => {
    setEditingInvoice(null)
    setFormData({
      ...defaultFormData,
      invoiceNumber: generateInvoiceNumber(),
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
      } else {
        await createMutation.mutateAsync(data)
      }
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      setDeleteConfirmId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
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
          <div className="stat-value text-lg text-info">
            {isLoadingSummary ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              formatCurrency(calculatedSummary?.taxTotal || 0)
            )}
          </div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Urssaf</div>
          <div className="stat-value text-lg text-warning">
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
          <div className="stat-value text-lg text-error">
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
          <div className="stat-value text-lg text-success">
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
                                <span className="badge badge-success badge-sm">
                                  {formatDate(invoice.paymentDate)}
                                </span>
                              ) : (
                                <span className="badge badge-warning badge-sm">En attente</span>
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
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                {deleteConfirmId === invoice.id ? (
                                  <div className="flex gap-1">
                                    <button
                                      className="btn btn-sm btn-error"
                                      onClick={() => handleDelete(invoice.id)}
                                      disabled={deleteMutation.isPending}
                                    >
                                      Oui
                                    </button>
                                    <button
                                      className="btn btn-sm btn-ghost"
                                      onClick={() => setDeleteConfirmId(null)}
                                    >
                                      Non
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="btn btn-sm btn-ghost btn-square text-error"
                                    onClick={() => setDeleteConfirmId(invoice.id)}
                                    title="Supprimer"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
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
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.client}
                    onChange={(e) => updateFormField('client', e.target.value)}
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
                      onClick={() => updateFormField('invoiceNumber', generateInvoiceNumber())}
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
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.description}
                    onChange={(e) => updateFormField('description', e.target.value)}
                    placeholder="Description de la prestation..."
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Date de facturation *</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered"
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
                    className="input input-bordered"
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
                    className="input input-bordered"
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
                    className="select select-bordered"
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
                    className="textarea textarea-bordered"
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
    </div>
  )
}
