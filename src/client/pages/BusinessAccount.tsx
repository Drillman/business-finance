import { useState, useEffect, type ReactNode } from 'react'
import { useAccountBalance, useUpdateAccountBalance, useAccountSummary } from '../hooks/useAccount'
import { Badge, DataTable, Spinner, type DataTableColumn } from '@drillman/dashboard-ui'

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num)
}

interface ObligationRow {
  key: string
  type: ReactNode
  pending: ReactNode
  estimated: ReactNode
  total: ReactNode
}

interface FundsRow {
  key: string
  label: string
  value: string
  labelClassName?: string
  valueClassName?: string
  subtotal?: boolean
}

export default function BusinessAccount() {
  const { data: balance, isLoading: balanceLoading } = useAccountBalance()
  const { data: summary, isLoading: summaryLoading } = useAccountSummary()
  const updateBalance = useUpdateAccountBalance()

  const [inputBalance, setInputBalance] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (balance) {
      setInputBalance(balance.balance)
    }
  }, [balance])

  const handleUpdateBalance = async () => {
    setError('')
    setSuccessMessage('')

    const numericBalance = parseFloat(inputBalance)
    if (isNaN(numericBalance) || numericBalance < 0) {
      setError('Veuillez entrer un montant valide (positif)')
      return
    }

    try {
      await updateBalance.mutateAsync(numericBalance)
      setSuccessMessage('Solde mis à jour avec succès')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    }
  }

  const isLoading = balanceLoading || summaryLoading

  const availableFundsValue = summary ? parseFloat(summary.availableFunds) : 0
  const isAvailablePositive = availableFundsValue >= 0
  const totalTva = summary ? parseFloat(summary.pendingTva) + parseFloat(summary.estimatedTva) : 0
  const totalUrssaf = summary ? parseFloat(summary.pendingUrssaf) + parseFloat(summary.estimatedUrssaf) : 0
  const expensesSampleMonths = summary?.typicalMonthlyExpensesMonths ?? 0
  const expensesTypicalLabel = expensesSampleMonths === 0
    ? "Aucun mois écoulé cette année — estimation indisponible"
    : `Médiane TTC sur les ${expensesSampleMonths} derniers mois`
  const availableBeforeSalary = summary
    ? parseFloat(summary.availableFunds) + parseFloat(summary.nextMonthSalary)
    : 0

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  const obligationRows: ObligationRow[] = [
    {
      key: 'tva',
      type: <Badge tone="accent">TVA</Badge>,
      pending: summary ? formatCurrency(summary.pendingTva) : '0 €',
      estimated: summary ? formatCurrency(summary.estimatedTva) : '0 €',
      total: formatCurrency(totalTva),
    },
    {
      key: 'urssaf',
      type: <Badge tone="info">Urssaf</Badge>,
      pending: summary ? formatCurrency(summary.pendingUrssaf) : '0 €',
      estimated: summary ? formatCurrency(summary.estimatedUrssaf) : '0 €',
      total: formatCurrency(totalUrssaf),
    },
    {
      key: 'expenses',
      type: (
        <Badge tone="danger" title={expensesTypicalLabel}>
          Dépenses (médiane {expensesSampleMonths || 6} mois)
        </Badge>
      ),
      pending: <span className="text-text-secondary">—</span>,
      estimated: summary ? formatCurrency(summary.typicalMonthlyExpenses) : '0 €',
      total: summary ? formatCurrency(summary.typicalMonthlyExpenses) : '0 €',
    },
  ]

  const obligationColumns: DataTableColumn<ObligationRow>[] = [
    { key: 'type', header: 'Type', cell: (row) => row.type },
    { key: 'pending', header: 'En attente', align: 'right', width: 'w-32', cell: (row) => row.pending },
    { key: 'estimated', header: 'Estimé', align: 'right', width: 'w-32', className: 'text-text-secondary', cell: (row) => row.estimated },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      width: 'w-32',
      cell: (row) => <span className="font-medium">{row.total}</span>,
      footer: <span className="font-bold text-warning">{summary ? formatCurrency(summary.totalObligations) : '0 €'}</span>,
    },
  ]

  const fundsRows: FundsRow[] = [
    { key: 'balance', label: 'Solde du compte', value: summary ? formatCurrency(summary.currentBalance) : '0 €' },
    {
      key: 'obligations',
      label: '- Total des obligations',
      value: summary ? formatCurrency(summary.totalObligations) : '0 €',
      labelClassName: 'text-danger',
      valueClassName: 'text-danger',
    },
    {
      key: 'before-salary',
      label: '= Fonds hors salaire',
      value: formatCurrency(availableBeforeSalary),
      valueClassName: availableBeforeSalary >= 0 ? 'text-success' : 'text-danger',
      subtotal: true,
    },
    {
      key: 'salary',
      label: '- Salaire réservé',
      value: summary ? formatCurrency(summary.nextMonthSalary) : '0 €',
      labelClassName: 'text-info',
      valueClassName: 'text-info',
    },
    {
      key: 'available',
      label: '= Fonds disponibles',
      value: summary ? formatCurrency(summary.availableFunds) : '0 €',
      valueClassName: `font-bold ${isAvailablePositive ? 'text-success' : 'text-danger'}`,
      subtotal: true,
    },
  ]

  const fundsColumns: DataTableColumn<FundsRow>[] = [
    { key: 'label', cell: (row) => <span className={row.labelClassName}>{row.label}</span> },
    { key: 'value', align: 'right', width: 'w-40', cell: (row) => <span className={row.valueClassName}>{row.value}</span> },
  ]

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Compte entreprise</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="min-h-44 rounded-card border border-border bg-surface p-6 ">
          <h2 className="font-display text-base font-semibold text-text-primary">Solde actuel</h2>
          <p className="mt-3 text-compact text-text-secondary">
            Entrez le solde actuel de votre compte bancaire professionnel
          </p>

          <div className="mt-4 flex w-full">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              className="h-10 w-full rounded-l-lg border-y border-l border-border px-3 text-sm text-text-primary outline-none focus:border-accent"
              value={inputBalance}
              onChange={(e) => setInputBalance(e.target.value)}
            />
            <button
              className="inline-flex h-10 min-w-34 items-center justify-center rounded-r-lg bg-accent px-4 text-compact font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleUpdateBalance}
              disabled={updateBalance.isPending}
            >
              {updateBalance.isPending ? <Spinner size="sm" /> : 'Mettre à jour'}
            </button>
          </div>

          {error ? (
            <p className="mt-2 text-xs text-danger">{error}</p>
          ) : null}
          {successMessage ? (
            <p className="mt-2 text-xs text-success">{successMessage}</p>
          ) : null}

          {balance ? (
            <p className="mt-3 text-[11px] text-text-muted">
              Dernière mise à jour : {new Date(balance.updatedAt).toLocaleDateString('fr-FR')}
            </p>
          ) : null}
        </section>

        <section
          className="flex min-h-44 flex-col items-center justify-center rounded-card border border-border border-l-[3px] bg-surface px-6 py-6 text-center "
          style={{ borderLeftColor: isAvailablePositive ? 'var(--dui-success)' : 'var(--dui-danger)' }}
        >
          <h2 className="font-display text-base font-semibold text-text-primary">Fonds disponibles</h2>
          <p className={`mt-3 font-display text-[36px] leading-none font-bold tracking-[-0.03em] ${isAvailablePositive ? 'text-success' : 'text-danger'}`}>
            {summary ? formatCurrency(summary.availableFunds) : '0 €'}
          </p>
          <p className="mt-3 text-compact text-text-secondary">
            Après déduction de toutes les obligations et du salaire réservé
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <section className="overflow-hidden rounded-card border border-border bg-surface ">
          <div className="px-6 py-4">
            <h2 className="font-display text-base font-semibold text-text-primary">Détail des obligations</h2>
          </div>

          <DataTable
            variant="plain"
            columns={obligationColumns}
            rows={obligationRows}
            getRowKey={(row) => row.key}
            footerLabel="Total des obligations"
            minWidth="min-w-155"
          />
        </section>

        <section className="overflow-hidden rounded-card border border-border bg-surface ">
          <div className="px-6 py-4">
            <h2 className="font-display text-base font-semibold text-text-primary">Calcul des fonds disponibles</h2>
          </div>

          <DataTable
            variant="plain"
            columns={fundsColumns}
            rows={fundsRows}
            getRowKey={(row) => row.key}
            rowClassName={(row) => (row.subtotal ? 'bg-surface-subtle font-semibold' : undefined)}
            minWidth="min-w-105"
          />
        </section>
      </div>
    </div>
  )
}
