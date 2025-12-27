import { useState } from 'react'

export default function Calculator() {
  const [amountHT, setAmountHT] = useState('')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Calculateur de prestation</h1>
      <div className="card bg-base-100 shadow max-w-md">
        <div className="card-body">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Montant HT</span>
            </label>
            <input
              type="number"
              placeholder="0.00"
              className="input input-bordered"
              value={amountHT}
              onChange={(e) => setAmountHT(e.target.value)}
            />
          </div>
          <div className="divider">Résultat</div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Urssaf:</span>
              <span className="font-semibold">0 €</span>
            </div>
            <div className="flex justify-between">
              <span>Impôts (estimé):</span>
              <span className="font-semibold">0 €</span>
            </div>
            <div className="flex justify-between text-lg">
              <span>Net restant:</span>
              <span className="font-bold text-success">0 €</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
