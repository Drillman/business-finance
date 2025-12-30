import { useState } from 'react'
import { useDashboardSummary } from '../hooks/useDashboard'
import { useAccountSummary } from '../hooks/useAccount'
import { Link } from 'react-router-dom'

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num)
}

function getCurrentMonthYear() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

export default function Dashboard() {
  const { month: currentMonth, year: currentYear } = getCurrentMonthYear()
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(selectedYear, selectedMonth)
  const { data: accountSummary, isLoading: accountLoading } = useAccountSummary()

  const years = [2025, 2026]

  const isLoading = summaryLoading || accountLoading

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <div className="flex gap-2">
          <select
            className="select select-bordered select-sm"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {MONTHS.map((name, index) => (
              <option key={index} value={index + 1}>{name}</option>
            ))}
          </select>
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <>
          {/* Monthly Summary */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Résumé du mois - {MONTHS[selectedMonth - 1]} {selectedYear}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Chiffre d'affaire HT</div>
                <div className="stat-value text-lg text-primary">
                  {summary ? formatCurrency(summary.revenueHt) : '0 €'}
                </div>
                <div className="stat-desc">
                  TTC: {summary ? formatCurrency(summary.revenueTtc) : '0 €'}
                </div>
              </div>
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">TVA nette</div>
                <div className="stat-value text-lg text-secondary">
                  {summary ? formatCurrency(summary.netTva) : '0 €'}
                </div>
                <div className="stat-desc">
                  Collectée: {summary ? formatCurrency(summary.tvaCollected) : '0 €'} | Récup.: {summary ? formatCurrency(summary.tvaRecoverable) : '0 €'}
                </div>
              </div>
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Urssaf estimé</div>
                <div className="stat-value text-lg text-accent">
                  {summary ? formatCurrency(summary.urssafEstimate) : '0 €'}
                </div>
                <div className="stat-desc">Cotisations sociales</div>
              </div>
              <div className="stat bg-base-100 rounded-box shadow">
                <div className="stat-title">Restant net</div>
                <div className="stat-value text-lg text-success">
                  {summary ? formatCurrency(summary.netRemaining) : '0 €'}
                </div>
                <div className="stat-desc">
                  Après charges et impôts ({summary ? formatCurrency(summary.incomeTaxEstimate) : '0 €'})
                </div>
              </div>
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

          {/* Pending Payments */}
          {summary && summary.upcomingPayments.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Paiements à venir</h2>
              <div className="overflow-x-auto">
                <table className="table table-sm bg-base-100 rounded-box shadow">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Échéance</th>
                      <th className="text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.upcomingPayments.map((payment, index) => (
                      <tr key={index}>
                        <td>
                          <span className={`badge badge-sm ${payment.type === 'tva' ? 'badge-secondary' : payment.type === 'urssaf' ? 'badge-accent' : 'badge-info'}`}>
                            {payment.type === 'tva' ? 'TVA' : payment.type === 'urssaf' ? 'Urssaf' : 'Impôts'}
                          </span>
                        </td>
                        <td>{payment.description}</td>
                        <td>{payment.dueDate || '-'}</td>
                        <td className="text-right font-medium">{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
