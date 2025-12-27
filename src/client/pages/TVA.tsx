export default function TVA() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">TVA</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">TVA collectée</h2>
            <p className="text-3xl font-bold text-primary">0 €</p>
          </div>
        </div>
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title">TVA récupérable</h2>
            <p className="text-3xl font-bold text-success">0 €</p>
          </div>
        </div>
      </div>
    </div>
  )
}
