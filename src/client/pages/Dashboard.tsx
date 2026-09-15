import { useState } from 'react'
import { useYearlyDashboard } from '../hooks/useDashboard'
import { useAccountSummary } from '../hooks/useAccount'
import { Link } from 'react-router-dom'
import { YEARS } from '../utils/years'
import { ArrowUpRight, Landmark, Receipt, Wallet } from 'lucide-react'
import { Badge, DataTable, Spinner, StatCard, YearSwitch, type DataTableColumn } from '@drillman/dashboard-ui'

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num)
}

function formatRoundedCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(num))
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
]

// Remaining already has the income tax subtracted: add it back
function getRemainingBeforeTax(month: { remaining: string; incomeTax: string }): number {
  return parseFloat(month.remaining) + parseFloat(month.incomeTax)
}

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

  const averageRemainingBeforeTax = yearlyData?.months && yearlyData.months.length > 0
    ? yearlyData.months.reduce((sum, m) => sum + getRemainingBeforeTax(m), 0) / yearlyData.months.length
    : 0

  type DashboardMonth = NonNullable<typeof yearlyData>['months'][number]

  const amountTone = (amount: number) => (amount >= 0 ? 'text-success' : 'text-danger')

  const monthlyColumns: DataTableColumn<DashboardMonth>[] = [
    {
      key: 'month',
      header: 'Mois',
      cell: (month) => {
        const isCurrentMonth = month.month === yearlyData?.currentMonth
        return (
          <>
            <span className={isCurrentMonth ? 'font-semibold' : undefined}>{MONTHS[month.month - 1]}</span>
            {isCurrentMonth && (
              <Badge tone="accent" className="ml-2">
                En cours
              </Badge>
            )}
          </>
        )
      },
    },
    { key: 'revenue', header: 'CA HT', align: 'right', cell: (month) => formatCurrency(month.revenue) },
    { key: 'expenses', header: 'Dépenses', align: 'right', className: 'text-text-secondary', cell: (month) => formatCurrency(month.expensesHt) },
    {
      key: 'urssaf',
      header: 'Urssaf',
      align: 'right',
      cell: (month) => (
        <span className={month.urssafIsPaid ? 'text-success' : 'text-text-secondary'}>
          {formatRoundedCurrency(month.urssaf)}
          {month.urssafIsPaid && <span className="ml-1">✓</span>}
        </span>
      ),
    },
    {
      key: 'tva',
      header: 'TVA',
      align: 'right',
      cell: (month) => (
        <span className={month.tvaIsPaid ? 'text-success' : 'text-text-secondary'}>
          {formatRoundedCurrency(month.tva)}
          {month.tvaIsPaid && <span className="ml-1">✓</span>}
        </span>
      ),
    },
    {
      key: 'remaining-before-tax',
      header: 'Restant',
      align: 'right',
      cell: (month) => {
        const remainingBeforeTax = getRemainingBeforeTax(month)
        return <span className={`font-medium ${amountTone(remainingBeforeTax)}`}>{formatCurrency(remainingBeforeTax)}</span>
      },
      footer: <span className={amountTone(averageRemainingBeforeTax)}>{formatCurrency(averageRemainingBeforeTax)}</span>,
    },
    { key: 'income-tax', header: 'Impôts', align: 'right', className: 'text-text-secondary', cell: (month) => formatCurrency(month.incomeTax) },
    {
      key: 'remaining',
      header: 'Après impôts',
      align: 'right',
      cell: (month) => (
        <span className={`font-medium ${amountTone(parseFloat(month.remaining))}`}>{formatCurrency(month.remaining)}</span>
      ),
      footer: <span className={amountTone(averageRemaining)}>{formatCurrency(averageRemaining)}</span>,
    },
  ]

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">Tableau de bord</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Vue d&apos;ensemble de votre activite financiere
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <YearSwitch years={[...YEARS]} value={selectedYear} onChange={setSelectedYear} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Yearly KPIs */}
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">Bilan {selectedYear}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-4">
              <StatCard
                label="Chiffre d'affaires"
                value={yearlyData ? formatCurrency(yearlyData.kpis.totalRevenue) : '0 €'}
                description="Total encaisse sur l'annee"
                color="var(--dui-series-1)"
              />
              <StatCard
                label="Urssaf"
                value={yearlyData ? formatRoundedCurrency(yearlyData.kpis.totalUrssaf) : '0 €'}
                description={`Payé: ${yearlyData ? formatRoundedCurrency(yearlyData.kpis.totalUrssafPaid) : '0 €'} | Est.: ${yearlyData ? formatRoundedCurrency(yearlyData.kpis.totalUrssafEstimated) : '0 €'}`}
                color="var(--dui-series-3)"
              />
              <StatCard
                label="Impôts sur le revenu"
                value={yearlyData ? formatCurrency(yearlyData.kpis.totalIncomeTaxEstimated) : '0 €'}
                description={`Payé: ${yearlyData ? formatCurrency(yearlyData.kpis.totalIncomeTaxPaid) : '0 €'}`}
                color="var(--dui-series-5)"
              />
              <StatCard
                label="Restant net"
                value={yearlyData ? formatCurrency(yearlyData.kpis.totalRemaining) : '0 €'}
                description="Après charges et impôts"
                color="var(--dui-series-2)"
                tone={yearlyData && parseFloat(yearlyData.kpis.totalRemaining) < 0 ? 'danger' : 'success'}
              />
            </div>
          </div>

          {/* Monthly Breakdown Table */}
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">Détail mensuel</h2>
            <DataTable
              columns={monthlyColumns}
              rows={sortedMonths}
              getRowKey={(month) => month.month}
              footerLabel="Moyenne"
              minWidth="min-w-270"
            />
          </div>

          {/* Account Overview */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Compte entreprise</h2>
              <Link to="/account" className="inline-flex h-control-sm items-center gap-2 rounded-control px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
                Voir détails <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-card border border-border bg-white p-5 ">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">Solde actuel</p>
                  <Wallet className="h-4 w-4 text-accent" />
                </div>
                <div className="font-display text-2xl font-semibold tracking-tight text-text-primary">
                  {accountSummary ? formatCurrency(accountSummary.currentBalance) : '0 €'}
                </div>
              </div>
              <div className="rounded-card border border-border bg-white p-5 ">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">Obligations</p>
                  <Landmark className="h-4 w-4 text-warning" />
                </div>
                <div className="font-display text-2xl font-semibold tracking-tight text-warning">
                  {accountSummary ? formatCurrency(accountSummary.totalObligations) : '0 €'}
                </div>
                <p className="mt-2 text-xs text-text-secondary">TVA + Urssaf + Impôts</p>
              </div>
              <div className="rounded-card border border-border bg-white p-5 ">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">Salaire réservé</p>
                  <Receipt className="h-4 w-4 text-info" />
                </div>
                <div className="font-display text-2xl font-semibold tracking-tight text-info">
                  {accountSummary ? formatCurrency(accountSummary.nextMonthSalary) : '0 €'}
                </div>
                <p className="mt-2 text-xs text-text-secondary">Prochain mois</p>
              </div>
              <div className="rounded-card border border-border bg-white p-5 ">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">Fonds disponibles</p>
                  <ArrowUpRight className={`h-4 w-4 ${accountSummary && parseFloat(accountSummary.availableFunds) >= 0 ? 'text-success' : 'text-danger'}`} />
                </div>
                <div className={`font-display text-2xl font-semibold tracking-tight ${accountSummary && parseFloat(accountSummary.availableFunds) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {accountSummary ? formatCurrency(accountSummary.availableFunds) : '0 €'}
                </div>
                <p className="mt-2 text-xs text-text-secondary">Après déductions</p>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Accès rapide</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Link to="/invoices" className="group rounded-card border border-border bg-white px-4 py-4 transition-colors hover:bg-accent-soft">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Factures</span>
                  <ArrowUpRight className="h-4 w-4 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
              <Link to="/expenses" className="group rounded-card border border-border bg-white px-4 py-4 transition-colors hover:bg-accent-soft">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Dépenses</span>
                  <ArrowUpRight className="h-4 w-4 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
              <Link to="/tva" className="group rounded-card border border-border bg-white px-4 py-4 transition-colors hover:bg-accent-soft">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">TVA</span>
                  <ArrowUpRight className="h-4 w-4 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
              <Link to="/urssaf" className="group rounded-card border border-border bg-white px-4 py-4 transition-colors hover:bg-accent-soft">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Urssaf</span>
                  <ArrowUpRight className="h-4 w-4 text-text-secondary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
