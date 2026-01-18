import { useState, useMemo } from 'react'
import { useTvaDeclaration } from '../hooks/useTva'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Info } from 'lucide-react'

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(num)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
}

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  const date = new Date(year, monthNum - 1, 1)
  return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
}

interface CollapsibleSectionProps {
  title: string
  count: number
  total: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, count, total, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-base-300 rounded-lg">
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-base-200 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="font-medium">{title}</span>
          <span className="badge badge-sm">{count}</span>
        </div>
        <span className="font-mono font-bold">{total}</span>
      </button>
      {isOpen && (
        <div className="border-t border-base-300 p-4">
          {children}
        </div>
      )}
    </div>
  )
}

export default function TvaDeclaration() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())

  const { data: declaration, isLoading, error } = useTvaDeclaration(selectedMonth)

  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = []
    const currentYear = new Date().getFullYear()
    for (const year of [currentYear + 1, currentYear, currentYear - 1, currentYear - 2]) {
      for (let month = 12; month >= 1; month--) {
        const value = `${year}-${month.toString().padStart(2, '0')}`
        const label = formatMonthLabel(value)
        options.push({ value, label })
      }
    }
    return options
  }, [])

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const newDate = new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1)
    setSelectedMonth(`${newDate.getFullYear()}-${(newDate.getMonth() + 1).toString().padStart(2, '0')}`)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Assistant Declaration TVA</h1>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-2 mb-6">
        <button
          className="btn btn-square btn-sm"
          onClick={() => navigateMonth('prev')}
          title="Mois precedent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <select
          className="select select-bordered"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          className="btn btn-square btn-sm"
          onClick={() => navigateMonth('next')}
          title="Mois suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span>Erreur lors du chargement des donnees</span>
        </div>
      )}

      {declaration && (
        <>
          {/* Cases Grid */}
          <div className="card bg-base-100 shadow mb-6">
            <div className="card-body">
              <h2 className="card-title">Cases a remplir</h2>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="stat bg-base-200 rounded-box p-4">
                  <div className="stat-title text-xs">Case A1</div>
                  <div className="stat-value text-lg">{formatCurrency(declaration.cases.A1)}</div>
                  <div className="stat-desc text-xs">CA encaisse HT</div>
                </div>

                <div className="stat bg-base-200 rounded-box p-4">
                  <div className="stat-title text-xs">Case B2</div>
                  <div className="stat-value text-lg">{formatCurrency(declaration.cases.B2)}</div>
                  <div className="stat-desc text-xs">Achats intra-UE</div>
                </div>

                <div className="stat bg-primary/10 rounded-box p-4">
                  <div className="stat-title text-xs">Case 08</div>
                  <div className="stat-value text-lg text-primary">{formatCurrency(declaration.cases.case08)}</div>
                  <div className="stat-desc text-xs">Base HT 20%</div>
                </div>

                <div className="stat bg-base-200 rounded-box p-4">
                  <div className="stat-title text-xs">Case 17</div>
                  <div className="stat-value text-lg">{formatCurrency(declaration.cases.case17)}</div>
                  <div className="stat-desc text-xs">TVA intra-UE</div>
                </div>

                <div className="stat bg-success/10 rounded-box p-4">
                  <div className="stat-title text-xs">Case 19</div>
                  <div className="stat-value text-lg text-success">{formatCurrency(declaration.cases.case19)}</div>
                  <div className="stat-desc text-xs">TVA immobilisations</div>
                </div>

                <div className="stat bg-success/10 rounded-box p-4">
                  <div className="stat-title text-xs">Case 20</div>
                  <div className="stat-value text-lg text-success">{formatCurrency(declaration.cases.case20)}</div>
                  <div className="stat-desc text-xs">Autre TVA deductible</div>
                </div>
              </div>

              {/* Summary */}
              <div className="divider"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="stat bg-warning/10 rounded-box p-4">
                  <div className="stat-title">TVA collectee</div>
                  <div className="stat-value text-xl text-warning">{formatCurrency(declaration.summary.tvaCollected)}</div>
                  <div className="stat-desc">20% de case 08</div>
                </div>

                <div className="stat bg-success/10 rounded-box p-4">
                  <div className="stat-title">TVA deductible</div>
                  <div className="stat-value text-xl text-success">{formatCurrency(declaration.summary.tvaDeductible)}</div>
                  <div className="stat-desc">Case 19 + Case 20</div>
                </div>

                <div className={`stat rounded-box p-4 ${declaration.summary.tvaNet >= 0 ? 'bg-error/10' : 'bg-success/10'}`}>
                  <div className="stat-title">TVA nette</div>
                  <div className={`stat-value text-xl ${declaration.summary.tvaNet >= 0 ? 'text-error' : 'text-success'}`}>
                    {formatCurrency(Math.abs(declaration.summary.tvaNet))}
                  </div>
                  <div className="stat-desc">
                    {declaration.summary.tvaNet >= 0 ? 'A payer' : 'Credit de TVA'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Sections */}
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title">Details du mois</h2>

              <div className="space-y-4">
                {/* Invoices Paid */}
                <CollapsibleSection
                  title="Encaissements"
                  count={declaration.details.invoicesPaid.length}
                  total={formatCurrency(declaration.cases.A1) + ' HT'}
                  defaultOpen={true}
                >
                  {declaration.details.invoicesPaid.length === 0 ? (
                    <p className="text-base-content/60">Aucun encaissement ce mois</p>
                  ) : (
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Client</th>
                          <th>Date paiement</th>
                          <th className="text-right">Montant HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {declaration.details.invoicesPaid.map((inv) => (
                          <tr key={inv.id}>
                            <td>{inv.client}</td>
                            <td>{inv.paymentDate ? formatDate(inv.paymentDate) : '-'}</td>
                            <td className="text-right font-mono">{formatCurrency(parseFloat(inv.amountHt))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CollapsibleSection>

                {/* Intra-EU Expenses */}
                <CollapsibleSection
                  title="Achats intra-UE"
                  count={declaration.details.expensesIntraEu.length}
                  total={formatCurrency(declaration.cases.B2) + ' HT'}
                >
                  {declaration.details.expensesIntraEu.length === 0 ? (
                    <p className="text-base-content/60">Aucun achat intra-UE ce mois</p>
                  ) : (
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Date</th>
                          <th className="text-right">Montant HT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {declaration.details.expensesIntraEu.map((exp) => (
                          <tr key={exp.id}>
                            <td>{exp.description}</td>
                            <td>{formatDate(exp.date)}</td>
                            <td className="text-right font-mono">{formatCurrency(parseFloat(exp.amountHt))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CollapsibleSection>

                {/* Expenses > 500 EUR (Immobilisations) */}
                <CollapsibleSection
                  title="Immobilisations (> 500 EUR HT)"
                  count={declaration.details.expensesOver500.length}
                  total={formatCurrency(declaration.cases.case19) + ' TVA'}
                >
                  {declaration.details.expensesOver500.length === 0 ? (
                    <p className="text-base-content/60">Aucune immobilisation ce mois</p>
                  ) : (
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Date</th>
                          <th className="text-right">HT</th>
                          <th className="text-right">TVA</th>
                          <th className="text-right">Recuperable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {declaration.details.expensesOver500.map((exp) => {
                          const recoverable = parseFloat(exp.taxAmount) * parseFloat(exp.taxRecoveryRate) / 100
                          return (
                            <tr key={exp.id}>
                              <td>{exp.description}</td>
                              <td>{formatDate(exp.date)}</td>
                              <td className="text-right font-mono">{formatCurrency(parseFloat(exp.amountHt))}</td>
                              <td className="text-right font-mono">{formatCurrency(parseFloat(exp.taxAmount))}</td>
                              <td className="text-right font-mono text-success">{formatCurrency(recoverable)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </CollapsibleSection>

                {/* Other Expenses with TVA */}
                <CollapsibleSection
                  title="Autres depenses avec TVA (< 500 EUR HT)"
                  count={declaration.details.expensesWithTva.length}
                  total={formatCurrency(declaration.cases.case20 - declaration.cases.case17) + ' TVA'}
                >
                  {declaration.details.expensesWithTva.length === 0 ? (
                    <p className="text-base-content/60">Aucune autre depense avec TVA ce mois</p>
                  ) : (
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Date</th>
                          <th className="text-right">HT</th>
                          <th className="text-right">TVA</th>
                          <th className="text-right">Recuperable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {declaration.details.expensesWithTva.map((exp) => {
                          const recoverable = parseFloat(exp.taxAmount) * parseFloat(exp.taxRecoveryRate) / 100
                          return (
                            <tr key={exp.id}>
                              <td>{exp.description}</td>
                              <td>{formatDate(exp.date)}</td>
                              <td className="text-right font-mono">{formatCurrency(parseFloat(exp.amountHt))}</td>
                              <td className="text-right font-mono">{formatCurrency(parseFloat(exp.taxAmount))}</td>
                              <td className="text-right font-mono text-success">{formatCurrency(recoverable)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </CollapsibleSection>
              </div>

              {/* Info box */}
              <div className="alert alert-info mt-4">
                <Info className="h-5 w-5" />
                <div>
                  <div className="font-medium">Note sur le calcul</div>
                  <div className="text-sm">
                    Case 20 inclut la TVA auto-liquidee (case 17) pour neutraliser l'effet des achats intra-UE.
                    Les montants sont arrondis a l'euro le plus proche.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
