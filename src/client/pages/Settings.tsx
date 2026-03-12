import { useState, useEffect, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Save, Loader2, CheckCircle, XCircle, Plus, Trash2, RotateCcw } from 'lucide-react'
import { AppButton } from '../components/ui/AppButton'
import { YearSelect } from '../components/YearSelect'

interface UserSettings {
  id: string
  userId: string
  urssafRate: string
  estimatedTaxRate: string
  revenueDeductionRate: string
  monthlySalary: string
  additionalTaxableIncome: string
  createdAt: string
  updatedAt: string
}

interface UpdateSettingsData {
  urssafRate?: number
  estimatedTaxRate?: number
  revenueDeductionRate?: number
  monthlySalary?: number
  additionalTaxableIncome?: number
}

interface TaxBracket {
  id: string
  minIncome: string
  maxIncome: string | null
  rate: string
}

interface TaxBracketsResponse {
  year: number
  brackets: TaxBracket[]
  isCustom: boolean
}

interface YearlyRatesResponse {
  year: number
  urssafRate: string
  estimatedTaxRate: string
  isCustom: boolean
}

interface EditableBracket {
  minIncome: string
  maxIncome: string
  rate: string
}

const SETTINGS_YEARS = [2024, 2025, 2026]

export default function Settings() {
  const queryClient = useQueryClient()
  const [revenueDeductionRate, setRevenueDeductionRate] = useState('')
  const [monthlySalary, setMonthlySalary] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Tax brackets state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [editableBrackets, setEditableBrackets] = useState<EditableBracket[]>([])
  const [bracketsModified, setBracketsModified] = useState(false)

  // Yearly rates state
  const [ratesYear, setRatesYear] = useState(new Date().getFullYear())
  const [yearlyUrssafRate, setYearlyUrssafRate] = useState('')
  const [yearlyEstimatedTaxRate, setYearlyEstimatedTaxRate] = useState('')
  const [ratesModified, setRatesModified] = useState(false)

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<UserSettings>('/settings'),
  })

  const { data: taxBracketsData, isLoading: isLoadingBrackets } = useQuery({
    queryKey: ['taxBrackets', selectedYear],
    queryFn: () => api.get<TaxBracketsResponse>(`/settings/tax-brackets?year=${selectedYear}`),
  })

  const { data: yearlyRatesData, isLoading: isLoadingRates } = useQuery({
    queryKey: ['yearlyRates', ratesYear],
    queryFn: () => api.get<YearlyRatesResponse>(`/settings/yearly-rates?year=${ratesYear}`),
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateSettingsData) => api.put<UserSettings>('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setSuccessMessage('Paramètres enregistrés avec succès')
      setErrorMessage('')
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde')
      setSuccessMessage('')
    },
  })

  const saveBracketsMutation = useMutation({
    mutationFn: (data: { year: number; brackets: { minIncome: number; maxIncome: number | null; rate: number }[] }) =>
      api.post<TaxBracketsResponse>('/settings/tax-brackets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxBrackets'] })
      queryClient.invalidateQueries({ queryKey: ['incomeTaxSummary'] })
      setSuccessMessage('Tranches d\'imposition enregistrées')
      setBracketsModified(false)
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde')
    },
  })

  const resetBracketsMutation = useMutation({
    mutationFn: () => api.delete<void>('/settings/tax-brackets'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxBrackets'] })
      queryClient.invalidateQueries({ queryKey: ['incomeTaxSummary'] })
      setSuccessMessage('Tranches réinitialisées aux valeurs officielles')
      setBracketsModified(false)
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Erreur lors de la réinitialisation')
    },
  })

  const saveYearlyRatesMutation = useMutation({
    mutationFn: (data: { year: number; urssafRate: number; estimatedTaxRate: number }) =>
      api.post<YearlyRatesResponse>('/settings/yearly-rates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yearlyRates'] })
      queryClient.invalidateQueries({ queryKey: ['urssafSummary'] })
      queryClient.invalidateQueries({ queryKey: ['incomeTaxSummary'] })
      setSuccessMessage('Taux annuels enregistrés')
      setRatesModified(false)
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde')
    },
  })

  const resetYearlyRatesMutation = useMutation({
    mutationFn: (year: number) => api.delete<void>(`/settings/yearly-rates?year=${year}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yearlyRates'] })
      queryClient.invalidateQueries({ queryKey: ['urssafSummary'] })
      queryClient.invalidateQueries({ queryKey: ['incomeTaxSummary'] })
      setSuccessMessage('Taux réinitialisés aux valeurs par défaut')
      setRatesModified(false)
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Erreur lors de la réinitialisation')
    },
  })

  useEffect(() => {
    if (settings) {
      setRevenueDeductionRate(settings.revenueDeductionRate)
      setMonthlySalary(settings.monthlySalary)
    }
  }, [settings])

  useEffect(() => {
    if (taxBracketsData?.brackets) {
      setEditableBrackets(
        taxBracketsData.brackets.map((b) => ({
          minIncome: b.minIncome,
          maxIncome: b.maxIncome || '',
          rate: b.rate,
        }))
      )
      setBracketsModified(false)
    }
  }, [taxBracketsData])

  useEffect(() => {
    if (yearlyRatesData) {
      setYearlyUrssafRate(yearlyRatesData.urssafRate)
      setYearlyEstimatedTaxRate(yearlyRatesData.estimatedTaxRate)
      setRatesModified(false)
    }
  }, [yearlyRatesData])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    updateMutation.mutate({
      revenueDeductionRate: parseFloat(revenueDeductionRate),
      monthlySalary: parseFloat(monthlySalary),
    })
  }

  const updateBracket = (index: number, field: keyof EditableBracket, value: string) => {
    setEditableBrackets((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setBracketsModified(true)
  }

  const addBracket = () => {
    const lastBracket = editableBrackets[editableBrackets.length - 1]
    const newMinIncome = lastBracket?.maxIncome
      ? (parseFloat(lastBracket.maxIncome) + 1).toString()
      : '0'
    setEditableBrackets((prev) => [
      ...prev,
      { minIncome: newMinIncome, maxIncome: '', rate: '0' },
    ])
    setBracketsModified(true)
  }

  const removeBracket = (index: number) => {
    if (editableBrackets.length <= 1) return
    setEditableBrackets((prev) => prev.filter((_, i) => i !== index))
    setBracketsModified(true)
  }

  const saveBrackets = () => {
    const brackets = editableBrackets.map((b) => ({
      minIncome: parseFloat(b.minIncome) || 0,
      maxIncome: b.maxIncome ? parseFloat(b.maxIncome) : null,
      rate: parseFloat(b.rate) || 0,
    }))
    saveBracketsMutation.mutate({ year: selectedYear, brackets })
  }

  const saveYearlyRates = () => {
    saveYearlyRatesMutation.mutate({
      year: ratesYear,
      urssafRate: parseFloat(yearlyUrssafRate) || 0,
      estimatedTaxRate: parseFloat(yearlyEstimatedTaxRate) || 0,
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-['Space_Grotesk'] text-[24px] font-semibold text-(--text-primary)">Configuration</h1>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2 text-sm text-[#166534]">
          <CheckCircle className="h-4 w-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B91C1C]">
          <XCircle className="h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-[10px] border border-(--border-default) bg-(--card-bg) p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
        >
          <div className="flex flex-col gap-4">
            <h2 className="font-['Space_Grotesk'] text-sm font-semibold text-(--text-primary)">Paramètres généraux</h2>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-(--text-primary)">Abattement forfaitaire (%)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="34.00"
                  className="h-8 w-full rounded-lg border border-(--border-default) bg-(--card-bg) px-3 text-sm text-(--text-primary) outline-none focus:border-(--color-primary)"
                  value={revenueDeductionRate}
                  onChange={(e) => setRevenueDeductionRate(e.target.value)}
                  required
                />
                <span className="text-[10px] text-(--text-tertiary)">Abattement pour frais professionnels (34% pour BNC)</span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-(--text-primary)">Salaire mensuel cible (EUR)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="3000.00"
                  className="h-8 w-full rounded-lg border border-(--border-default) bg-(--card-bg) px-3 text-sm text-(--text-primary) outline-none focus:border-(--color-primary)"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  required
                />
                <span className="text-[10px] text-(--text-tertiary)">Objectif de rémunération mensuelle nette</span>
              </label>
            </div>

            <div className="flex justify-end">
              <AppButton
                type="submit"
                startIcon={updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                disabled={updateMutation.isPending}
              >
                Enregistrer
              </AppButton>
            </div>
          </div>
        </form>

        <div className="rounded-[10px] border border-(--border-default) bg-(--card-bg) p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-['Space_Grotesk'] text-sm font-semibold text-(--text-primary)">Taux annuels</h2>
              <div className="flex items-center gap-2">
                {yearlyRatesData?.isCustom && (
                  <span className="inline-flex h-6 items-center rounded-full bg-[#FEF3C7] px-2 text-[10px] font-semibold text-[#92400E]">Personnalisé</span>
                )}
                <YearSelect value={ratesYear} onChange={setRatesYear} years={SETTINGS_YEARS} />
              </div>
            </div>

            <p className="text-xs text-(--text-secondary)">Configurez les taux Urssaf et d'impôt estimé par année.</p>

            {isLoadingRates ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-(--text-primary)">Taux Urssaf (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="22.00"
                      className="h-8 w-full rounded-lg border border-(--border-default) bg-(--card-bg) px-3 text-sm text-(--text-primary) outline-none focus:border-(--color-primary)"
                      value={yearlyUrssafRate}
                      onChange={(e) => {
                        setYearlyUrssafRate(e.target.value)
                        setRatesModified(true)
                      }}
                    />
                    <span className="text-[10px] text-(--text-tertiary)">Taux de cotisations sociales pour micro-entrepreneur</span>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-(--text-primary)">Taux d'impôt estimé (%)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="11.00"
                      className="h-8 w-full rounded-lg border border-(--border-default) bg-(--card-bg) px-3 text-sm text-(--text-primary) outline-none focus:border-(--color-primary)"
                      value={yearlyEstimatedTaxRate}
                      onChange={(e) => {
                        setYearlyEstimatedTaxRate(e.target.value)
                        setRatesModified(true)
                      }}
                    />
                    <span className="text-[10px] text-(--text-tertiary)">Taux marginal d'imposition estimé</span>
                  </label>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {yearlyRatesData?.isCustom && (
                    <AppButton
                      variant="ghost"
                      startIcon={resetYearlyRatesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      onClick={() => resetYearlyRatesMutation.mutate(ratesYear)}
                      disabled={resetYearlyRatesMutation.isPending}
                    >
                      Réinitialiser
                    </AppButton>
                  )}
                  <AppButton
                    startIcon={saveYearlyRatesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    onClick={saveYearlyRates}
                    disabled={!ratesModified || saveYearlyRatesMutation.isPending}
                  >
                    Enregistrer les taux
                  </AppButton>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border-default) px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-['Space_Grotesk'] text-base font-semibold text-(--text-primary)">Tranches d'imposition</h2>
            {taxBracketsData?.isCustom && (
              <span className="inline-flex h-6 items-center rounded-full bg-[#FEF3C7] px-2 text-[10px] font-semibold text-[#92400E]">Personnalisé</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <YearSelect value={selectedYear} onChange={setSelectedYear} years={SETTINGS_YEARS} />

            <AppButton startIcon={<Plus className="h-4 w-4" />} onClick={addBracket}>
              Ajouter
            </AppButton>
          </div>
        </div>

        <div className="px-6 py-3 text-xs text-(--text-secondary)">
          Configurez les tranches du barème progressif de l'impôt sur le revenu. Laissez le maximum vide pour la dernière tranche.
        </div>

        {isLoadingBrackets ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-190 table-fixed border-collapse">
                <thead>
                  <tr className="h-10 border-y border-(--border-default) bg-(--color-base-200)">
                    <th className="px-6 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Minimum (EUR)</th>
                    <th className="px-6 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Maximum (EUR)</th>
                    <th className="w-30 px-6 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Taux (%)</th>
                    <th className="w-20 px-6 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {editableBrackets.map((bracket, index) => (
                    <tr key={index} className={index % 2 === 1 ? 'h-12 border-b border-(--border-default) bg-(--color-base-200)/40' : 'h-12 border-b border-(--border-default)'}>
                      <td className="px-6">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-(--text-primary) outline-none focus:border-(--border-default)"
                          value={bracket.minIncome}
                          onChange={(e) => updateBracket(index, 'minIncome', e.target.value)}
                        />
                      </td>
                      <td className="px-6">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-right text-sm text-(--text-primary) outline-none focus:border-(--border-default)"
                          value={bracket.maxIncome}
                          onChange={(e) => updateBracket(index, 'maxIncome', e.target.value)}
                          placeholder="∞"
                        />
                      </td>
                      <td className="px-6">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          className="h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-right text-sm text-(--text-primary) outline-none focus:border-(--border-default)"
                          value={bracket.rate}
                          onChange={(e) => updateBracket(index, 'rate', e.target.value)}
                        />
                      </td>
                      <td className="px-6 text-center">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#DC2626] transition-colors hover:bg-[#FEE2E2] disabled:cursor-not-allowed disabled:opacity-40"
                          onClick={() => removeBracket(index)}
                          disabled={editableBrackets.length <= 1}
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 px-6 py-4">
              {taxBracketsData?.isCustom && (
                <AppButton
                  variant="ghost"
                  startIcon={resetBracketsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  onClick={() => resetBracketsMutation.mutate()}
                  disabled={resetBracketsMutation.isPending}
                >
                  Réinitialiser
                </AppButton>
              )}
              <AppButton
                startIcon={saveBracketsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                onClick={saveBrackets}
                disabled={!bracketsModified || saveBracketsMutation.isPending}
              >
                Enregistrer les tranches
              </AppButton>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
