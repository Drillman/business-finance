export default function Invoices() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Chiffre d'affaire</h1>
        <button className="btn btn-primary">Ajouter une facture</button>
      </div>
      <div className="card bg-base-100 shadow">
        <div className="card-body">
          <p className="text-base-content/60">Aucune facture pour le moment.</p>
        </div>
      </div>
    </div>
  )
}
