import { useState, useEffect, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Save, Loader2, CheckCircle, XCircle, Plus, Trash2, RotateCcw } from 'lucide-react'

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

  const formatCurrency = (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return value
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configuration</h1>

      {successMessage && (
        <div className="alert alert-success mb-4">
          <CheckCircle className="h-5 w-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-error mb-4">
          <XCircle className="h-5 w-5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">Paramètres généraux</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Abattement forfaitaire (%)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="34.00"
                  className="input input-bordered w-full"
                  value={revenueDeductionRate}
                  onChange={(e) => setRevenueDeductionRate(e.target.value)}
                  required
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    Abattement pour frais professionnels (34% pour BNC)
                  </span>
                </label>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Salaire mensuel cible (€)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="3000.00"
                  className="input input-bordered w-full"
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  required
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    Objectif de rémunération mensuelle nette
                  </span>
                </label>
              </div>
            </div>

            <div className="card-actions justify-end mt-4">
              <button
                type="submit"
                className="btn btn-primary gap-2"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Yearly Rates Configuration */}
      <div className="card bg-base-100 shadow mt-6">
        <div className="card-body">
          <div className="flex justify-between items-center">
            <h2 className="card-title">Taux annuels</h2>
            <div className="flex gap-2 items-center">
              <select
                className="select select-bordered select-sm"
                value={ratesYear}
                onChange={(e) => setRatesYear(parseInt(e.target.value))}
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
              {yearlyRatesData?.isCustom && (
                <span className="badge badge-warning badge-sm">Personnalisé</span>
              )}
            </div>
          </div>

          <p className="text-sm text-base-content/60 mb-4">
            Configurez les taux Urssaf et d'impôt estimé par année.
          </p>

          {isLoadingRates ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Taux Urssaf (%)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="22.00"
                    className="input input-bordered w-full"
                    value={yearlyUrssafRate}
                    onChange={(e) => {
                      setYearlyUrssafRate(e.target.value)
                      setRatesModified(true)
                    }}
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/60">
                      Taux de cotisations sociales pour micro-entrepreneur
                    </span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Taux d'impôt estimé (%)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="11.00"
                    className="input input-bordered w-full"
                    value={yearlyEstimatedTaxRate}
                    onChange={(e) => {
                      setYearlyEstimatedTaxRate(e.target.value)
                      setRatesModified(true)
                    }}
                  />
                  <label className="label">
                    <span className="label-text-alt text-base-content/60">
                      Taux marginal d'imposition estimé
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                {yearlyRatesData?.isCustom && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm gap-2"
                    onClick={() => resetYearlyRatesMutation.mutate(ratesYear)}
                    disabled={resetYearlyRatesMutation.isPending}
                  >
                    {resetYearlyRatesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Réinitialiser
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm gap-2"
                  onClick={saveYearlyRates}
                  disabled={!ratesModified || saveYearlyRatesMutation.isPending}
                >
                  {saveYearlyRatesMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Enregistrer les taux
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tax Brackets Configuration */}
      <div className="card bg-base-100 shadow mt-6">
        <div className="card-body">
          <div className="flex justify-between items-center">
            <h2 className="card-title">Tranches d'imposition</h2>
            <div className="flex gap-2 items-center">
              <select
                className="select select-bordered select-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
              {taxBracketsData?.isCustom && (
                <span className="badge badge-warning badge-sm">Personnalisé</span>
              )}
            </div>
          </div>

          <p className="text-sm text-base-content/60 mb-4">
            Configurez les tranches du barème progressif de l'impôt sur le revenu.
            Laissez le maximum vide pour la dernière tranche.
          </p>

          {isLoadingBrackets ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Minimum (€)</th>
                      <th>Maximum (€)</th>
                      <th>Taux (%)</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableBrackets.map((bracket, index) => (
                      <tr key={index}>
                        <td>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            className="input input-bordered input-sm w-full"
                            value={bracket.minIncome}
                            onChange={(e) => updateBracket(index, 'minIncome', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            className="input input-bordered input-sm w-full"
                            value={bracket.maxIncome}
                            onChange={(e) => updateBracket(index, 'maxIncome', e.target.value)}
                            placeholder="∞"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            className="input input-bordered input-sm w-24"
                            value={bracket.rate}
                            onChange={(e) => updateBracket(index, 'rate', e.target.value)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-square text-error"
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

              <div className="flex justify-between mt-4">
                <button
                  type="button"
                  className="btn btn-outline btn-sm gap-2"
                  onClick={addBracket}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une tranche
                </button>

                <div className="flex gap-2">
                  {taxBracketsData?.isCustom && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm gap-2"
                      onClick={() => resetBracketsMutation.mutate()}
                      disabled={resetBracketsMutation.isPending}
                    >
                      {resetBracketsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Réinitialiser
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary btn-sm gap-2"
                    onClick={saveBrackets}
                    disabled={!bracketsModified || saveBracketsMutation.isPending}
                  >
                    {saveBracketsMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Enregistrer les tranches
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
