export default function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Chiffre d'affaire (mois)</div>
          <div className="stat-value text-primary">0 €</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">TVA à payer</div>
          <div className="stat-value text-secondary">0 €</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Urssaf à payer</div>
          <div className="stat-value text-accent">0 €</div>
        </div>
        <div className="stat bg-base-100 rounded-box shadow">
          <div className="stat-title">Disponible</div>
          <div className="stat-value text-success">0 €</div>
        </div>
      </div>
    </div>
  )
}
