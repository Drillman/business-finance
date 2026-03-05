import { useState } from 'react'
import { useYearlyDashboard } from '../hooks/useDashboard'
import { useAccountSummary } from '../hooks/useAccount'
import { Link } from 'react-router-dom'
import { YearSelect } from '../components/YearSelect'
import { ArrowUpRight, Landmark, Receipt, Wallet } from 'lucide-react'

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
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#18181B]">Tableau de bord</h1>
          <p className="mt-1 text-sm text-[#71717A]">
            Vue d&apos;ensemble de votre activite financiere
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <YearSelect value={selectedYear} onChange={setSelectedYear} size="sm" />
          <Link to="/invoices" className="btn btn-primary btn-sm sm:btn-md">
            Aller aux factures
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <>
          {/* Yearly KPIs */}
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">Bilan {selectedYear}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat border-l-[3px] border-l-[#818CF8] bg-base-100 rounded-box shadow">
                <div className="stat-title">Chiffre d'affaires</div>
                <div className="stat-value text-xl text-primary">
                  {yearlyData ? formatCurrency(yearlyData.kpis.totalRevenue) : '0 €'}
                </div>
                <div className="stat-desc">Total encaisse sur l'annee</div>
              </div>
              <div className="stat border-l-[3px] border-l-[#FBBF24] bg-base-100 rounded-box shadow">
                <div className="stat-title">Urssaf</div>
                <div className="stat-value text-xl text-accent">
                  {yearlyData ? formatCurrency(yearlyData.kpis.totalUrssaf) : '0 €'}
                </div>
                <div className="stat-desc">
                  Payé: {yearlyData ? formatCurrency(yearlyData.kpis.totalUrssafPaid) : '0 €'} |
                  Est.: {yearlyData ? formatCurrency(yearlyData.kpis.totalUrssafEstimated) : '0 €'}
                </div>
              </div>
              <div className="stat border-l-[3px] border-l-[#A78BFA] bg-base-100 rounded-box shadow">
                <div className="stat-title">Impôts sur le revenu</div>
                <div className="stat-value text-xl text-warning">
                  {yearlyData ? formatCurrency(yearlyData.kpis.totalIncomeTaxEstimated) : '0 €'}
                </div>
                <div className="stat-desc">
                  Payé: {yearlyData ? formatCurrency(yearlyData.kpis.totalIncomeTaxPaid) : '0 €'}
                </div>
              </div>
              <div className="stat border-l-[3px] border-l-[#34D399] bg-base-100 rounded-box shadow">
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
            <h2 className="mb-4 text-lg font-semibold">Détail mensuel</h2>
            <div className="overflow-hidden rounded-[10px] border border-[#E2E5F0] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr className="bg-[#F5F7FB] text-[#71717A]">
                      <th className="font-semibold">Mois</th>
                      <th className="text-right font-semibold">CA HT</th>
                      <th className="text-right font-semibold">Urssaf</th>
                      <th className="text-right font-semibold">Impôts</th>
                      <th className="text-right font-semibold">TVA</th>
                      <th className="text-right font-semibold">Restant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMonths.map((month, index) => {
                      const isCurrentMonth = month.month === yearlyData?.currentMonth
                      return (
                        <tr
                          key={month.month}
                          className={[
                            index % 2 === 1 ? 'bg-[#F8F9FC]' : 'bg-white',
                            isCurrentMonth ? 'bg-[#EEF2FF]' : '',
                          ].join(' ').trim()}
                        >
                          <td className={isCurrentMonth ? 'font-semibold' : ''}>
                            {MONTHS[month.month - 1]}
                            {isCurrentMonth && <span className="badge badge-sm ml-2 border-0 bg-[#6366F1] text-white">En cours</span>}
                          </td>
                          <td className="text-right">{formatCurrency(month.revenue)}</td>
                          <td className="text-right">
                            <span className={month.urssafIsPaid ? 'text-success' : 'text-base-content/70'}>
                              {formatCurrency(month.urssaf)}
                            </span>
                            {month.urssafIsPaid && <span className="ml-1 text-success">✓</span>}
                          </td>
                          <td className="text-right text-base-content/70">
                            {formatCurrency(month.incomeTax)}
                          </td>
                          <td className="text-right">
                            <span className={month.tvaIsPaid ? 'text-success' : 'text-base-content/70'}>
                              {formatCurrency(month.tva)}
                            </span>
                            {month.tvaIsPaid && <span className="ml-1 text-success">✓</span>}
                          </td>
                          <td className={`text-right font-medium ${parseFloat(month.remaining) >= 0 ? 'text-success' : 'text-error'}`}>
                            {formatCurrency(month.remaining)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[#E2E5F0] bg-white">
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
          </div>

          {/* Account Overview */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Compte entreprise</h2>
              <Link to="/account" className="btn btn-sm btn-ghost gap-2">
                Voir détails <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-[10px] border border-[#E2E5F0] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">Solde actuel</p>
                  <Wallet className="h-4 w-4 text-[#2563EB]" />
                </div>
                <div className="font-['Space_Grotesk'] text-2xl font-semibold tracking-tight text-[#18181B]">
                  {accountSummary ? formatCurrency(accountSummary.currentBalance) : '0 €'}
                </div>
              </div>
              <div className="rounded-[10px] border border-[#E2E5F0] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">Obligations</p>
                  <Landmark className="h-4 w-4 text-[#F59E0B]" />
                </div>
                <div className="font-['Space_Grotesk'] text-2xl font-semibold tracking-tight text-[#F59E0B]">
                  {accountSummary ? formatCurrency(accountSummary.totalObligations) : '0 €'}
                </div>
                <p className="mt-2 text-xs text-[#71717A]">TVA + Urssaf + Impôts</p>
              </div>
              <div className="rounded-[10px] border border-[#E2E5F0] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">Salaire réservé</p>
                  <Receipt className="h-4 w-4 text-[#3B82F6]" />
                </div>
                <div className="font-['Space_Grotesk'] text-2xl font-semibold tracking-tight text-[#3B82F6]">
                  {accountSummary ? formatCurrency(accountSummary.nextMonthSalary) : '0 €'}
                </div>
                <p className="mt-2 text-xs text-[#71717A]">Prochain mois</p>
              </div>
              <div className="rounded-[10px] border border-[#E2E5F0] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#A1A1AA]">Fonds disponibles</p>
                  <ArrowUpRight className={`h-4 w-4 ${accountSummary && parseFloat(accountSummary.availableFunds) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`} />
                </div>
                <div className={`font-['Space_Grotesk'] text-2xl font-semibold tracking-tight ${accountSummary && parseFloat(accountSummary.availableFunds) >= 0 ? 'text-success' : 'text-error'}`}>
                  {accountSummary ? formatCurrency(accountSummary.availableFunds) : '0 €'}
                </div>
                <p className="mt-2 text-xs text-[#71717A]">Après déductions</p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Accès rapide</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Link to="/invoices" className="group rounded-[10px] border border-[#E2E5F0] bg-white px-4 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#EEF2FF]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Factures</span>
                  <ArrowUpRight className="h-4 w-4 text-[#71717A] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
              <Link to="/expenses" className="group rounded-[10px] border border-[#E2E5F0] bg-white px-4 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#EEF2FF]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Dépenses</span>
                  <ArrowUpRight className="h-4 w-4 text-[#71717A] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
              <Link to="/tva" className="group rounded-[10px] border border-[#E2E5F0] bg-white px-4 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#EEF2FF]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">TVA</span>
                  <ArrowUpRight className="h-4 w-4 text-[#71717A] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
              <Link to="/urssaf" className="group rounded-[10px] border border-[#E2E5F0] bg-white px-4 py-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#EEF2FF]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Urssaf</span>
                  <ArrowUpRight className="h-4 w-4 text-[#71717A] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
