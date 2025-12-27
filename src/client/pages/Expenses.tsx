export default function Expenses() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dépenses</h1>
        <button className="btn btn-primary">Ajouter une dépense</button>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <p className="text-base-content/60">Aucune dépense pour le moment.</p>
        </div>
      </div>
    </div>
  )
}
