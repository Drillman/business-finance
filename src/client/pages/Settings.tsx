export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configuration</h1>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <h2 className="card-title">Paramètres généraux</h2>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Taux Urssaf (%)</span>
            </label>
            <input
              type="number"
              placeholder="22.00"
              className="input input-bordered"
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Taux d'impôt estimé (%)</span>
            </label>
            <input
              type="number"
              placeholder="11.00"
              className="input input-bordered"
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Salaire mensuel (€)</span>
            </label>
            <input
              type="number"
              placeholder="3000.00"
              className="input input-bordered"
            />
          </div>
          <div className="card-actions justify-end mt-4">
            <button className="btn btn-primary">Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  )
}
