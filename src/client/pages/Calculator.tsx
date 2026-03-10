import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { api } from '../api/client'
import { YearSelect } from '../components/PeriodSelect'
import { AppButton } from '../components/ui/AppButton'

type InputMode = 'ht' | 'ttc'

interface YearlyRatesResponse {
  year: number
  urssafRate: string
  estimatedTaxRate: string
  isCustom: boolean
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)
}

export default function Calculator() {
  const [inputMode, setInputMode] = useState<InputMode>('ht')
  const [amount, setAmount] = useState('')
  const [taxRate, setTaxRate] = useState('20')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const { data: yearlyRates, isLoading: isLoadingRates } = useQuery({
    queryKey: ['yearlyRates', selectedYear],
    queryFn: () => api.get<YearlyRatesResponse>(`/settings/yearly-rates?year=${selectedYear}`),
  })

  const calculations = useMemo(() => {
    const inputAmount = parseFloat(amount) || 0
    const rate = parseFloat(taxRate) || 0
    const urssafRate = yearlyRates ? parseFloat(yearlyRates.urssafRate) : 22
    const estimatedTaxRate = yearlyRates ? parseFloat(yearlyRates.estimatedTaxRate) : 11

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
  }, [amount, taxRate, inputMode, yearlyRates])

  const handleInputModeChange = (mode: InputMode) => {
    if (mode === inputMode) return

    const currentAmount = parseFloat(amount) || 0
    if (currentAmount === 0) {
      setInputMode(mode)
      return
    }

    const rate = parseFloat(taxRate) || 0
    const newAmount = mode === 'ttc'
      ? currentAmount * (1 + rate / 100)
      : currentAmount / (1 + rate / 100)

    setAmount(newAmount.toFixed(2))
    setInputMode(mode)
  }

  const handleReset = () => {
    setAmount('')
    setTaxRate('20')
    setInputMode('ht')
  }

  if (isLoadingRates) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  const totalRate = calculations.urssafRate + calculations.estimatedTaxRate
  const netRate = calculations.amountHt > 0
    ? (calculations.netRemaining / calculations.amountHt) * 100
    : 100 - totalRate

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-(--text-primary)">Calculateur</h1>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <YearSelect value={selectedYear} onChange={setSelectedYear} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-[10px] border border-(--border-default) bg-(--card-bg) p-7 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <h2 className="font-['Space_Grotesk'] text-[18px] font-semibold text-(--text-primary)">Saisie</h2>

          <div className="mt-6 space-y-6">
            <div>
              <label className="mb-2 block text-[13px] font-medium text-(--text-secondary)">Mode de saisie</label>
              <div className="flex h-10 w-full rounded-lg border border-(--border-default) bg-(--color-base-200) p-1">
                <button
                  type="button"
                  className={[
                    'flex-1 rounded-md text-[13px] font-medium transition-colors',
                    inputMode === 'ht'
                      ? 'bg-(--card-bg) font-semibold text-(--text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                      : 'text-(--text-secondary) hover:text-(--text-primary)',
                  ].join(' ')}
                  onClick={() => handleInputModeChange('ht')}
                >
                  Montant HT
                </button>
                <button
                  type="button"
                  className={[
                    'flex-1 rounded-md text-[13px] font-medium transition-colors',
                    inputMode === 'ttc'
                      ? 'bg-(--card-bg) font-semibold text-(--text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                      : 'text-(--text-secondary) hover:text-(--text-primary)',
                  ].join(' ')}
                  onClick={() => handleInputModeChange('ttc')}
                >
                  Montant TTC
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-(--text-secondary)">
                Montant {inputMode === 'ht' ? 'HT' : 'TTC'} (EUR)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="h-10.5 w-full rounded-lg border border-(--border-default) bg-(--card-bg) px-3.5 text-[15px] text-(--text-primary) focus:border-(--border-focus) focus:outline-none"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="mb-2 block text-[13px] font-medium text-(--text-secondary)">Taux de TVA</label>
              <select
                className="h-10.5 w-full rounded-lg border border-(--border-default) bg-(--card-bg) px-3.5 text-sm text-(--text-primary) focus:border-(--border-focus) focus:outline-none"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              >
                <option value="0">0% (Exonere)</option>
                <option value="5.5">5.5%</option>
                <option value="10">10%</option>
                <option value="20">20% (Taux normal)</option>
              </select>
            </div>

            <div>
              <AppButton variant="outline" className="w-full" onClick={handleReset}>
                Reinitialiser
              </AppButton>
            </div>
          </div>
        </section>

        <section className="rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="space-y-3 p-7">
            <h2 className="font-['Space_Grotesk'] text-[18px] font-semibold text-(--text-primary)">Conversion HT / TTC</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-(--border-default) bg-[#FAFAFA] p-4">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-(--text-tertiary)">MONTANT HT</p>
                <p className="mt-1 font-['Space_Grotesk'] text-[22px] font-semibold text-(--text-primary)">
                  {formatCurrency(calculations.amountHt)}
                </p>
              </div>

              <div className="rounded-lg border border-(--border-default) bg-[#FAFAFA] p-4">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-(--text-tertiary)">MONTANT TTC</p>
                <p className="mt-1 font-['Space_Grotesk'] text-[22px] font-semibold text-(--text-primary)">
                  {formatCurrency(calculations.amountTtc)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-(--text-secondary)">TVA ({taxRate}%)</span>
              <span className="text-sm font-semibold text-(--text-primary)">{formatCurrency(calculations.tvaAmount)}</span>
            </div>
          </div>

          <div className="h-px w-full bg-(--border-default)"></div>

          <div className="space-y-4 p-7">
            <h3 className="font-['Space_Grotesk'] text-[18px] font-semibold text-(--text-primary)">Deductions</h3>

            <div className="flex items-center justify-between">
              <span className="text-sm text-(--text-secondary)">Urssaf ({calculations.urssafRate}%)</span>
              <span className="text-sm font-semibold text-(--color-error)">- {formatCurrency(calculations.urssafAmount)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-(--text-secondary)">Impot estime ({calculations.estimatedTaxRate}%)</span>
              <span className="text-sm font-semibold text-(--color-error)">- {formatCurrency(calculations.estimatedTax)}</span>
            </div>

            <div className="h-px w-full bg-(--border-default)"></div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-(--text-primary)">Total deductions</span>
              <span className="text-sm font-bold text-(--color-error)">- {formatCurrency(calculations.totalDeductions)}</span>
            </div>
          </div>

          <div className="rounded-b-[10px] bg-[#ECFDF5] p-7">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-(--color-success)">Net restant</span>
              <span className="font-['Space_Grotesk'] text-[26px] font-bold text-(--color-success)">
                {formatCurrency(calculations.netRemaining)}
              </span>
            </div>
            <p className="text-right text-[13px] text-(--color-success)">
              {formatPercent(calculations.amountHt > 0 ? (calculations.netRemaining / calculations.amountHt) * 100 : 0)}% du montant HT
            </p>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-[10px] border border-(--border-default) bg-(--card-bg) p-7 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center gap-3">
          <Info className="h-4.5 w-4.5 text-(--color-info)" />
          <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">
            Taux configures pour {selectedYear}
          </h2>
          {yearlyRates?.isCustom ? (
            <span className="inline-flex h-6 items-center rounded-full bg-[#EEF2FF] px-2.5 text-[11px] font-semibold text-(--color-info)">
              Personnalise
            </span>
          ) : (
            <span className="inline-flex h-6 items-center rounded-full bg-[#F5F7FB] px-2.5 text-[11px] font-semibold text-(--text-secondary)">
              Defaut
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-(--border-default) bg-[#FAFAFA] p-4">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-(--text-tertiary)">TAUX URSSAF</p>
            <p className="mt-1 font-['Space_Grotesk'] text-xl font-semibold text-(--text-primary)">
              {formatPercent(calculations.urssafRate)}%
            </p>
            <p className="mt-1 text-xs text-(--text-secondary)">Cotisations sociales</p>
          </article>

          <article className="rounded-lg border border-(--border-default) bg-[#FAFAFA] p-4">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-(--text-tertiary)">TAUX IMPOT ESTIME</p>
            <p className="mt-1 font-['Space_Grotesk'] text-xl font-semibold text-(--text-primary)">
              {formatPercent(calculations.estimatedTaxRate)}%
            </p>
            <p className="mt-1 text-xs text-(--text-secondary)">Versement liberatoire</p>
          </article>

          <article className="rounded-lg border border-(--border-default) bg-[#FAFAFA] p-4">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-(--text-tertiary)">TOTAL PRELEVE</p>
            <p className="mt-1 font-['Space_Grotesk'] text-xl font-semibold text-(--color-error)">
              {formatPercent(totalRate)}%
            </p>
            <p className="mt-1 text-xs text-(--text-secondary)">Sur le montant HT</p>
          </article>

          <article className="rounded-lg border border-(--border-default) bg-[#F0FDF4] p-4">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-(--text-tertiary)">NET RESTANT</p>
            <p className="mt-1 font-['Space_Grotesk'] text-xl font-semibold text-(--color-success)">
              {formatPercent(netRate)}%
            </p>
            <p className="mt-1 text-xs text-(--text-secondary)">Du montant HT</p>
          </article>
        </div>
      </section>
    </div>
  )
}
