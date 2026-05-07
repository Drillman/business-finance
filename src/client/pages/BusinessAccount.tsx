import { useState, useEffect } from 'react'
import { useAccountBalance, useUpdateAccountBalance, useAccountSummary } from '../hooks/useAccount'

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num)
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
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-(--text-primary)">Compte entreprise</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="min-h-44 rounded-[10px] border border-(--border-default) bg-(--card-bg) p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">Solde actuel</h2>
          <p className="mt-3 text-[13px] text-(--text-secondary)">
            Entrez le solde actuel de votre compte bancaire professionnel
          </p>

          <div className="mt-4 flex w-full">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              className="h-10 w-full rounded-l-lg border-y border-l border-(--border-default) px-3 text-sm text-(--text-primary) outline-none focus:border-(--color-primary)"
              value={inputBalance}
              onChange={(e) => setInputBalance(e.target.value)}
            />
            <button
              className="inline-flex h-10 min-w-34 items-center justify-center rounded-r-lg bg-(--color-primary) px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleUpdateBalance}
              disabled={updateBalance.isPending}
            >
              {updateBalance.isPending ? <span className="loading loading-spinner loading-sm" /> : 'Mettre à jour'}
            </button>
          </div>

          {error ? (
            <p className="mt-2 text-xs text-(--color-error)">{error}</p>
          ) : null}
          {successMessage ? (
            <p className="mt-2 text-xs text-(--color-success)">{successMessage}</p>
          ) : null}

          {balance ? (
            <p className="mt-3 text-[11px] text-(--text-tertiary)">
              Dernière mise à jour : {new Date(balance.updatedAt).toLocaleDateString('fr-FR')}
            </p>
          ) : null}
        </section>

        <section
          className="flex min-h-44 flex-col items-center justify-center rounded-[10px] border border-(--border-default) border-l-[3px] bg-(--card-bg) px-6 py-6 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
          style={{ borderLeftColor: isAvailablePositive ? '#34D399' : 'var(--color-error)' }}
        >
          <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">Fonds disponibles</h2>
          <p className={`mt-3 font-['Space_Grotesk'] text-[36px] leading-none font-bold tracking-[-0.03em] ${isAvailablePositive ? 'text-[#34D399]' : 'text-(--color-error)'}`}>
            {summary ? formatCurrency(summary.availableFunds) : '0 €'}
          </p>
          <p className="mt-3 text-[13px] text-(--text-secondary)">
            Après déduction de toutes les obligations et du salaire réservé
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <section className="overflow-hidden rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="px-6 py-4">
            <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">Détail des obligations</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-155 table-fixed border-collapse">
              <thead>
                <tr className="h-10.5 border-b border-(--border-default) bg-(--color-base-200)">
                  <th className="px-6 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Type</th>
                  <th className="w-30 px-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">En attente</th>
                  <th className="w-30 px-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Estimé</th>
                  <th className="w-30 px-6 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-10 border-b border-(--border-default)">
                  <td className="px-6">
                    <span className="inline-flex h-5.5 items-center rounded-full bg-[#DBEAFE] px-2 text-[11px] font-semibold text-[#3B82F6]">TVA</span>
                  </td>
                  <td className="px-3 text-right text-[13px] text-(--text-primary)">{summary ? formatCurrency(summary.pendingTva) : '0 €'}</td>
                  <td className="px-3 text-right text-[13px] text-(--text-secondary)">{summary ? formatCurrency(summary.estimatedTva) : '0 €'}</td>
                  <td className="px-6 text-right text-[13px] font-medium text-(--text-primary)">{formatCurrency(totalTva)}</td>
                </tr>

                <tr className="h-10 border-b border-(--border-default) bg-(--color-base-200)/45">
                  <td className="px-6">
                    <span className="inline-flex h-5.5 items-center rounded-full bg-[#E0F2FE] px-2 text-[11px] font-semibold text-[#0284C7]">Urssaf</span>
                  </td>
                  <td className="px-3 text-right text-[13px] text-(--text-primary)">{summary ? formatCurrency(summary.pendingUrssaf) : '0 €'}</td>
                  <td className="px-3 text-right text-[13px] text-(--text-secondary)">{summary ? formatCurrency(summary.estimatedUrssaf) : '0 €'}</td>
                  <td className="px-6 text-right text-[13px] font-medium text-(--text-primary)">{formatCurrency(totalUrssaf)}</td>
                </tr>

                <tr className="h-10 border-b border-(--border-default)">
                  <td className="px-6">
                    <span className="inline-flex h-5.5 items-center rounded-full bg-[#FEE2E2] px-2 text-[11px] font-semibold text-[#DC2626]" title={expensesTypicalLabel}>
                      Dépenses (médiane {expensesSampleMonths || 6} mois)
                    </span>
                  </td>
                  <td className="px-3 text-right text-[13px] text-(--text-secondary)">—</td>
                  <td className="px-3 text-right text-[13px] text-(--text-secondary)">{summary ? formatCurrency(summary.typicalMonthlyExpenses) : '0 €'}</td>
                  <td className="px-6 text-right text-[13px] font-medium text-(--text-primary)">{summary ? formatCurrency(summary.typicalMonthlyExpenses) : '0 €'}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="h-11 bg-(--color-base-200)">
                  <td className="px-6 text-[13px] font-semibold text-(--text-primary)">Total des obligations</td>
                  <td className="px-3" />
                  <td className="px-3" />
                  <td className="px-6 text-right text-sm font-bold text-[#FBBF24]">{summary ? formatCurrency(summary.totalObligations) : '0 €'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="px-6 py-4">
            <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">Calcul des fonds disponibles</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-105 table-fixed border-collapse">
              <tbody>
                <tr className="h-10 border-b border-(--border-default)">
                  <td className="px-6 text-sm text-(--text-primary)">Solde du compte</td>
                  <td className="w-30 px-6 text-right text-sm text-(--text-primary)">
                    {summary ? formatCurrency(summary.currentBalance) : '0 €'}
                  </td>
                </tr>

                <tr className="h-10 border-b border-(--border-default)">
                  <td className="px-6 text-sm text-(--color-error)">- Total des obligations</td>
                  <td className="w-30 px-6 text-right text-sm text-(--color-error)">
                    {summary ? formatCurrency(summary.totalObligations) : '0 €'}
                  </td>
                </tr>

                <tr className="h-11 border-y border-(--border-default) border-t-2 bg-(--color-base-200)">
                  <td className="px-6 text-sm font-semibold text-(--text-primary)">= Fonds hors salaire</td>
                  <td className={`w-30 px-6 text-right text-sm font-semibold ${availableBeforeSalary >= 0 ? 'text-[#34D399]' : 'text-(--color-error)'}`}>
                    {formatCurrency(availableBeforeSalary)}
                  </td>
                </tr>

                <tr className="h-10 border-b border-(--border-default)">
                  <td className="px-6 text-sm text-[#3B82F6]">- Salaire réservé</td>
                  <td className="w-30 px-6 text-right text-sm text-[#3B82F6]">
                    {summary ? formatCurrency(summary.nextMonthSalary) : '0 €'}
                  </td>
                </tr>

                <tr className="h-11 border-t-2 border-(--border-default) bg-(--color-base-200)">
                  <td className="px-6 text-sm font-semibold text-(--text-primary)">= Fonds disponibles</td>
                  <td className={`w-30 px-6 text-right text-sm font-bold ${isAvailablePositive ? 'text-[#34D399]' : 'text-(--color-error)'}`}>
                    {summary ? formatCurrency(summary.availableFunds) : '0 €'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
