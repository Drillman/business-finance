import { useState } from 'react'
import { useYearlyDashboard } from '../hooks/useDashboard'
import { useAccountSummary } from '../hooks/useAccount'
import { Link } from 'react-router-dom'

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num)
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

export default function Dashboard() {
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const { data: yearlyData, isLoading: yearlyLoading } = useYearlyDashboard(selectedYear)
  const { data: accountSummary, isLoading: accountLoading } = useAccountSummary()

  const years = [2024, 2025, 2026]

  const isLoading = yearlyLoading || accountLoading

  // Sort months with current month first, then descending
  const sortedMonths = yearlyData?.months ? [...yearlyData.months].sort((a, b) => {
    const currentMonth = yearlyData.currentMonth
    if (currentMonth) {
      if (a.month === currentMonth) return -1
      if (b.month === currentMonth) return 1
    }
    return b.month - a.month
  }) : []

  // Calculate average remaining
  const averageRemaining = yearlyData?.months && yearlyData.months.length > 0
    ? yearlyData.months.reduce((sum, m) => sum + parseFloat(m.remaining), 0) / yearlyData.months.length
    : 0

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <select
          className="select select-bordered select-sm"
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <>
          {/* Yearly KPIs */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Bilan {selectedYear}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Chiffre d'affaires</div>
                <div className="stat-value text-xl text-primary">
                  {yearlyData ? formatCurrency(yearlyData.kpis.totalRevenue) : '0 €'}
                </div>
              </div>
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Urssaf</div>
                <div className="stat-value text-xl text-accent">
                  {yearlyData ? formatCurrency(yearlyData.kpis.totalUrssaf) : '0 €'}
                </div>
                <div className="stat-desc">
                  Payé: {yearlyData ? formatCurrency(yearlyData.kpis.totalUrssafPaid) : '0 €'} |
                  Est.: {yearlyData ? formatCurrency(yearlyData.kpis.totalUrssafEstimated) : '0 €'}
                </div>
              </div>
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Impôts sur le revenu</div>
                <div className="stat-value text-xl text-warning">
                  {yearlyData ? formatCurrency(yearlyData.kpis.totalIncomeTaxEstimated) : '0 €'}
                </div>
                <div className="stat-desc">
                  Payé: {yearlyData ? formatCurrency(yearlyData.kpis.totalIncomeTaxPaid) : '0 €'}
                </div>
              </div>
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Restant net</div>
                <div className={`stat-value text-xl ${yearlyData && parseFloat(yearlyData.kpis.totalRemaining) >= 0 ? 'text-success' : 'text-error'}`}>
                  {yearlyData ? formatCurrency(yearlyData.kpis.totalRemaining) : '0 €'}
                </div>
                <div className="stat-desc">Après charges et impôts</div>
              </div>
            </div>
          </div>

          {/* Monthly Breakdown Table */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Détail mensuel</h2>
            <div className="overflow-x-auto">
              <table className="table table-sm bg-base-100 rounded-box shadow">
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th className="text-right">CA HT</th>
                    <th className="text-right">Urssaf</th>
                    <th className="text-right">Impôts</th>
                    <th className="text-right">TVA</th>
                    <th className="text-right">Restant</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMonths.map((month) => {
                    const isCurrentMonth = month.month === yearlyData?.currentMonth
                    return (
                      <tr key={month.month} className={isCurrentMonth ? 'bg-base-200' : ''}>
                        <td className={isCurrentMonth ? 'font-semibold' : ''}>
                          {MONTHS[month.month - 1]}
                          {isCurrentMonth && <span className="badge badge-sm badge-primary ml-2">En cours</span>}
                        </td>
                        <td className="text-right">{formatCurrency(month.revenue)}</td>
                        <td className="text-right">
                          <span className={month.urssafIsPaid ? 'text-success' : 'text-base-content/70'}>
                            {formatCurrency(month.urssaf)}
                          </span>
                          {month.urssafIsPaid && <span className="text-success ml-1">✓</span>}
                        </td>
                        <td className="text-right text-base-content/70">
                          {formatCurrency(month.incomeTax)}
                        </td>
                        <td className="text-right">
                          <span className={month.tvaIsPaid ? 'text-success' : 'text-base-content/70'}>
                            {formatCurrency(month.tva)}
                          </span>
                          {month.tvaIsPaid && <span className="text-success ml-1">✓</span>}
                        </td>
                        <td className={`text-right font-medium ${parseFloat(month.remaining) >= 0 ? 'text-success' : 'text-error'}`}>
                          {formatCurrency(month.remaining)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td className="font-semibold">Moyenne</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className={`text-right font-semibold ${averageRemaining >= 0 ? 'text-success' : 'text-error'}`}>
                      {formatCurrency(averageRemaining)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Account Overview */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Compte entreprise</h2>
              <Link to="/account" className="btn btn-sm btn-ghost">
                Voir détails →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Solde actuel</div>
                <div className="stat-value text-lg">
                  {accountSummary ? formatCurrency(accountSummary.currentBalance) : '0 €'}
                </div>
              </div>
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Obligations en attente</div>
                <div className="stat-value text-lg text-warning">
                  {accountSummary ? formatCurrency(accountSummary.totalObligations) : '0 €'}
                </div>
                <div className="stat-desc">TVA + Urssaf + Impôts</div>
              </div>
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Salaire réservé</div>
                <div className="stat-value text-lg text-info">
                  {accountSummary ? formatCurrency(accountSummary.nextMonthSalary) : '0 €'}
                </div>
                <div className="stat-desc">Prochain mois</div>
              </div>
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Fonds disponibles</div>
                <div className={`stat-value text-lg ${accountSummary && parseFloat(accountSummary.availableFunds) >= 0 ? 'text-success' : 'text-error'}`}>
                  {accountSummary ? formatCurrency(accountSummary.availableFunds) : '0 €'}
                </div>
                <div className="stat-desc">Après déductions</div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Accès rapide</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/invoices" className="btn btn-outline">
                Factures
              </Link>
              <Link to="/expenses" className="btn btn-outline">
                Dépenses
              </Link>
              <Link to="/tva" className="btn btn-outline">
                TVA
              </Link>
              <Link to="/urssaf" className="btn btn-outline">
                Urssaf
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
