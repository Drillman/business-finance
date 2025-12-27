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

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Compte entreprise</h1>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success mb-4">
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Balance Input Card */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">Solde actuel</h2>
            <p className="text-sm text-base-content/60 mb-4">
              Entrez le solde actuel de votre compte bancaire professionnel
            </p>
            <div className="form-control">
              <div className="join">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Entrez le solde"
                  className="input input-bordered join-item w-full"
                  value={inputBalance}
                  onChange={(e) => setInputBalance(e.target.value)}
                />
                <button
                  className="btn btn-primary join-item"
                  onClick={handleUpdateBalance}
                  disabled={updateBalance.isPending}
                >
                  {updateBalance.isPending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Mettre à jour'
                  )}
                </button>
              </div>
            </div>
            {balance && (
              <p className="text-sm text-base-content/60 mt-2">
                Dernière mise à jour: {new Date(balance.updatedAt).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>

        {/* Available Funds Card */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">Fonds disponibles</h2>
            <p className={`text-4xl font-bold ${summary && parseFloat(summary.availableFunds) >= 0 ? 'text-success' : 'text-error'}`}>
              {summary ? formatCurrency(summary.availableFunds) : '0 €'}
            </p>
            <p className="text-sm text-base-content/60">
              Après déduction de toutes les obligations et du salaire réservé
            </p>
          </div>
        </div>
      </div>

      {/* Obligations Breakdown */}
      <div className="card bg-base-100 shadow mb-8">
        <div className="card-body">
          <h2 className="card-title mb-4">Détail des obligations</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th className="text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="badge badge-secondary mr-2">TVA</span>
                    Paiements en attente
                  </td>
                  <td className="text-right font-medium">
                    {summary ? formatCurrency(summary.pendingTva) : '0 €'}
                  </td>
                </tr>
                <tr>
                  <td>
                    <span className="badge badge-accent mr-2">Urssaf</span>
                    Cotisations en attente
                  </td>
                  <td className="text-right font-medium">
                    {summary ? formatCurrency(summary.pendingUrssaf) : '0 €'}
                  </td>
                </tr>
                <tr>
                  <td>
                    <span className="badge badge-info mr-2">Impôts</span>
                    Paiements en attente
                  </td>
                  <td className="text-right font-medium">
                    {summary ? formatCurrency(summary.pendingIncomeTax) : '0 €'}
                  </td>
                </tr>
                <tr className="border-t-2">
                  <td className="font-semibold">Total des obligations</td>
                  <td className="text-right font-bold text-warning">
                    {summary ? formatCurrency(summary.totalObligations) : '0 €'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Summary Calculation */}
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title mb-4">Calcul des fonds disponibles</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <tbody>
                <tr>
                  <td>Solde du compte</td>
                  <td className="text-right font-medium">
                    {summary ? formatCurrency(summary.currentBalance) : '0 €'}
                  </td>
                </tr>
                <tr>
                  <td className="text-error">- Total des obligations</td>
                  <td className="text-right font-medium text-error">
                    {summary ? formatCurrency(summary.totalObligations) : '0 €'}
                  </td>
                </tr>
                <tr>
                  <td className="text-info">- Salaire réservé (mois prochain)</td>
                  <td className="text-right font-medium text-info">
                    {summary ? formatCurrency(summary.nextMonthSalary) : '0 €'}
                  </td>
                </tr>
                <tr className="border-t-2">
                  <td className="font-semibold">= Fonds disponibles</td>
                  <td className={`text-right font-bold ${summary && parseFloat(summary.availableFunds) >= 0 ? 'text-success' : 'text-error'}`}>
                    {summary ? formatCurrency(summary.availableFunds) : '0 €'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <p className="text-sm text-base-content/60">
              Le salaire réservé est configuré dans vos paramètres. Modifiez-le dans la page
              <a href="/settings" className="link link-primary ml-1">Paramètres</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
