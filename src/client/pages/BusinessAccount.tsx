export default function BusinessAccount() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Compte entreprise</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">Solde actuel</h2>
            <input
              type="number"
              placeholder="Entrez le solde"
              className="input input-bordered w-full"
            />
          </div>
        </div>
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">Fonds disponibles</h2>
            <p className="text-3xl font-bold text-success">0 €</p>
            <p className="text-sm text-base-content/60">
              Après déduction des obligations
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
