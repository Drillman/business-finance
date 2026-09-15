import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { api } from '../api/client'
import { YEARS } from '../utils/years'
import { Badge, Button, Card, Field, Input, Select, Spinner, StatCard, TabSwitch, YearSwitch } from '@drillman/dashboard-ui'

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

const TAX_RATE_OPTIONS = [
  { value: '0', label: '0 % (exonéré)' },
  { value: '5.5', label: '5,5 %' },
  { value: '10', label: '10 %' },
  { value: '20', label: '20 % (taux normal)' },
]

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
      <div className="flex h-64 items-center justify-center text-accent">
        <Spinner size="lg" />
      </div>
    )
  }

  const totalRate = calculations.urssafRate + calculations.estimatedTaxRate
  const netRate = calculations.amountHt > 0
    ? (calculations.netRemaining / calculations.amountHt) * 100
    : 100 - totalRate
  const modeLabel = inputMode === 'ht' ? 'HT' : 'TTC'

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Calculateur</h1>
        <YearSwitch years={[...YEARS]} value={selectedYear} onChange={setSelectedYear} align="end" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <h2 className="font-display text-lg font-semibold text-text-primary">Saisie</h2>

          <div className="mt-6 flex flex-col gap-5">
            <Field label="Mode de saisie">
              <TabSwitch<InputMode>
                aria-label="Mode de saisie"
                value={inputMode}
                onChange={handleInputModeChange}
                options={[
                  { value: 'ht', label: 'Montant HT' },
                  { value: 'ttc', label: 'Montant TTC' },
                ]}
              />
            </Field>

            <Input
              label={`Montant ${modeLabel}`}
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              suffix="€"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />

            <Select
              label="Taux de TVA"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              options={TAX_RATE_OPTIONS}
            />

            <Button variant="secondary" fullWidth onClick={handleReset}>
              Réinitialiser
            </Button>
          </div>
        </Card>

        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-col gap-4 p-6">
            <h2 className="font-display text-lg font-semibold text-text-primary">Conversion HT / TTC</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard label="Montant HT" value={formatCurrency(calculations.amountHt)} />
              <StatCard label="Montant TTC" value={formatCurrency(calculations.amountTtc)} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">TVA ({formatPercent(parseFloat(taxRate) || 0)} %)</span>
              <span className="text-sm font-semibold text-text-primary">{formatCurrency(calculations.tvaAmount)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-border p-6">
            <h3 className="font-display text-lg font-semibold text-text-primary">Déductions</h3>

            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Urssaf ({formatPercent(calculations.urssafRate)} %)</span>
              <span className="text-sm font-semibold text-danger">- {formatCurrency(calculations.urssafAmount)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Impôt estimé ({formatPercent(calculations.estimatedTaxRate)} %)</span>
              <span className="text-sm font-semibold text-danger">- {formatCurrency(calculations.estimatedTax)}</span>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm font-semibold text-text-primary">Total déductions</span>
              <span className="text-sm font-bold text-danger">- {formatCurrency(calculations.totalDeductions)}</span>
            </div>
          </div>

          <div className="bg-success-soft p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-success-strong">Net restant</span>
              <span className="font-display text-kpi font-semibold text-success-strong">
                {formatCurrency(calculations.netRemaining)}
              </span>
            </div>
            <p className="mt-1 text-right text-compact text-success-strong">
              {formatPercent(calculations.amountHt > 0 ? (calculations.netRemaining / calculations.amountHt) * 100 : 0)} % du montant HT
            </p>
          </div>
        </Card>
      </div>

      <Card padding="lg" className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Info className="size-4.5 text-info" />
          <h2 className="font-display text-base font-semibold text-text-primary">
            Taux configurés pour {selectedYear}
          </h2>
          {yearlyRates?.isCustom ? (
            <Badge tone="accent" size="md">Personnalisé</Badge>
          ) : (
            <Badge size="md">Défaut</Badge>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Taux Urssaf"
            color="var(--dui-series-3)"
            value={`${formatPercent(calculations.urssafRate)} %`}
            description="Cotisations sociales"
          />
          <StatCard
            label="Taux impôt estimé"
            color="var(--dui-series-5)"
            value={`${formatPercent(calculations.estimatedTaxRate)} %`}
            description="Versement libératoire"
          />
          <StatCard
            label="Total prélevé"
            tone="danger"
            value={`${formatPercent(totalRate)} %`}
            description="Sur le montant HT"
          />
          <StatCard
            label="Net restant"
            tone="success"
            value={`${formatPercent(netRate)} %`}
            description="Du montant HT"
          />
        </div>
      </Card>
    </div>
  )
}
