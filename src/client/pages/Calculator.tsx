import { useState, useMemo } from 'react'
import { useSettings } from '../hooks/useSettings'

type InputMode = 'ht' | 'ttc'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export default function Calculator() {
  const [inputMode, setInputMode] = useState<InputMode>('ht')
  const [amount, setAmount] = useState('')
  const [taxRate, setTaxRate] = useState('20')

  const { data: settings, isLoading: isLoadingSettings } = useSettings()

  const calculations = useMemo(() => {
    const inputAmount = parseFloat(amount) || 0
    const rate = parseFloat(taxRate) || 0
    const urssafRate = settings ? parseFloat(settings.urssafRate) : 22
    const estimatedTaxRate = settings ? parseFloat(settings.estimatedTaxRate) : 10

    let amountHt: number
    let amountTtc: number
    let tvaAmount: number

    if (inputMode === 'ht') {
      amountHt = inputAmount
      tvaAmount = amountHt * (rate / 100)
      amountTtc = amountHt + tvaAmount
    } else {
      amountTtc = inputAmount
      amountHt = amountTtc / (1 + rate / 100)
      tvaAmount = amountTtc - amountHt
    }

    const urssafAmount = amountHt * (urssafRate / 100)
    const estimatedTax = amountHt * (estimatedTaxRate / 100)
    const totalDeductions = urssafAmount + estimatedTax
    const netRemaining = amountHt - totalDeductions

    return {
      amountHt,
      amountTtc,
      tvaAmount,
      urssafAmount,
      urssafRate,
      estimatedTax,
      estimatedTaxRate,
      totalDeductions,
      netRemaining,
    }
  }, [amount, taxRate, inputMode, settings])

  const handleInputModeChange = (mode: InputMode) => {
    if (mode === inputMode) return

    const currentAmount = parseFloat(amount) || 0
    if (currentAmount === 0) {
      setInputMode(mode)
      return
    }

    const rate = parseFloat(taxRate) || 0
    let newAmount: number

    if (mode === 'ttc') {
      // Converting from HT to TTC
      newAmount = currentAmount * (1 + rate / 100)
    } else {
      // Converting from TTC to HT
      newAmount = currentAmount / (1 + rate / 100)
    }

    setAmount(newAmount.toFixed(2))
    setInputMode(mode)
  }

  const handleReset = () => {
    setAmount('')
    setTaxRate('20')
    setInputMode('ht')
  }

  if (isLoadingSettings) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Calculateur de prestation</h1>
      <p className="text-base-content/70 mb-6">
        Calcul rapide pour estimer le net restant après déductions sur une prestation.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Card */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-lg mb-4">Montant de la prestation</h2>

            {/* Input Mode Toggle */}
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Type de montant</span>
              </label>
              <div className="join w-full">
                <button
                  type="button"
                  className={`btn join-item flex-1 ${inputMode === 'ht' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => handleInputModeChange('ht')}
                >
                  Montant HT
                </button>
                <button
                  type="button"
                  className={`btn join-item flex-1 ${inputMode === 'ttc' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => handleInputModeChange('ttc')}
                >
                  Montant TTC
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">
                  Montant {inputMode === 'ht' ? 'HT' : 'TTC'} (€)
                </span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input input-bordered input-lg text-xl w-full"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>

            {/* Tax Rate */}
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">Taux TVA</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              >
                <option value="0">0% (Exonéré)</option>
                <option value="5.5">5.5%</option>
                <option value="10">10%</option>
                <option value="20">20% (Taux normal)</option>
              </select>
            </div>

            {/* Reset Button */}
            <div className="mt-4">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleReset}
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Results Card */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-lg mb-4">Résultat</h2>

            {/* Conversion Section */}
            <div className="bg-base-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-base-content/70">Montant HT</span>
                <span className="font-mono text-lg font-semibold">
                  {formatCurrency(calculations.amountHt)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-base-content/70">TVA ({taxRate}%)</span>
                <span className="font-mono text-info">
                  + {formatCurrency(calculations.tvaAmount)}
                </span>
              </div>
              <div className="divider my-2"></div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Montant TTC</span>
                <span className="font-mono text-lg font-bold">
                  {formatCurrency(calculations.amountTtc)}
                </span>
              </div>
            </div>

            {/* Deductions Section */}
            <div className="space-y-3">
              <h3 className="font-medium text-base-content/80">Déductions sur le CA HT</h3>

              <div className="flex justify-between items-center">
                <span className="text-base-content/70">
                  Urssaf ({calculations.urssafRate}%)
                </span>
                <span className="font-mono text-warning">
                  - {formatCurrency(calculations.urssafAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-base-content/70">
                  Impôts estimés ({calculations.estimatedTaxRate}%)
                </span>
                <span className="font-mono text-error">
                  - {formatCurrency(calculations.estimatedTax)}
                </span>
              </div>

              <div className="divider my-2"></div>

              <div className="flex justify-between items-center">
                <span className="text-base-content/70">Total déductions</span>
                <span className="font-mono">
                  - {formatCurrency(calculations.totalDeductions)}
                </span>
              </div>
            </div>

            {/* Net Remaining */}
            <div className="mt-4 p-4 bg-success/10 rounded-lg border border-success/30">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Net restant</span>
                <span className="font-mono text-2xl font-bold text-success">
                  {formatCurrency(calculations.netRemaining)}
                </span>
              </div>
              <div className="text-sm text-base-content/60 mt-1">
                {calculations.amountHt > 0
                  ? `${((calculations.netRemaining / calculations.amountHt) * 100).toFixed(1)}% du CA HT`
                  : '0% du CA HT'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="card bg-base-100 shadow mt-6">
        <div className="card-body">
          <h2 className="card-title text-lg">Informations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-base-content/70">Taux Urssaf configuré :</span>
              <span className="font-semibold ml-2">{calculations.urssafRate}%</span>
            </div>
            <div>
              <span className="text-base-content/70">Taux d'impôt estimé :</span>
              <span className="font-semibold ml-2">{calculations.estimatedTaxRate}%</span>
            </div>
            <div>
              <span className="text-base-content/70">Pourcentage net :</span>
              <span className="font-semibold ml-2">
                {(100 - calculations.urssafRate - calculations.estimatedTaxRate).toFixed(1)}%
              </span>
            </div>
          </div>
          <p className="text-base-content/60 text-sm mt-2">
            Ces taux sont configurables dans les paramètres. Le calcul est basé sur le montant HT.
          </p>
        </div>
      </div>
    </div>
  )
}
