import { useState, useEffect, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { Save, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface UserSettings {
  id: string
  userId: string
  urssafRate: string
  estimatedTaxRate: string
  revenueDeductionRate: string
  monthlySalary: string
  createdAt: string
  updatedAt: string
}

interface UpdateSettingsData {
  urssafRate?: number
  estimatedTaxRate?: number
  revenueDeductionRate?: number
  monthlySalary?: number
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [urssafRate, setUrssafRate] = useState('')
  const [estimatedTaxRate, setEstimatedTaxRate] = useState('')
  const [revenueDeductionRate, setRevenueDeductionRate] = useState('')
  const [monthlySalary, setMonthlySalary] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<UserSettings>('/settings'),
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

  useEffect(() => {
    if (settings) {
      setUrssafRate(settings.urssafRate)
      setEstimatedTaxRate(settings.estimatedTaxRate)
      setRevenueDeductionRate(settings.revenueDeductionRate)
      setMonthlySalary(settings.monthlySalary)
    }
  }, [settings])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    updateMutation.mutate({
      urssafRate: parseFloat(urssafRate),
      estimatedTaxRate: parseFloat(estimatedTaxRate),
      revenueDeductionRate: parseFloat(revenueDeductionRate),
      monthlySalary: parseFloat(monthlySalary),
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
                  <span className="label-text">Taux Urssaf (%)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="22.00"
                  className="input input-bordered w-full"
                  value={urssafRate}
                  onChange={(e) => setUrssafRate(e.target.value)}
                  required
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
                  value={estimatedTaxRate}
                  onChange={(e) => setEstimatedTaxRate(e.target.value)}
                  required
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    Taux marginal d'imposition estimé
                  </span>
                </label>
              </div>

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
    </div>
  )
}
