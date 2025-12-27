import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: '📊' },
  { to: '/invoices', label: 'Chiffre d\'affaire', icon: '📄' },
  { to: '/expenses', label: 'Dépenses', icon: '💰' },
  { to: '/tva', label: 'TVA', icon: '🧾' },
  { to: '/urssaf', label: 'Urssaf', icon: '🏛️' },
  { to: '/account', label: 'Compte entreprise', icon: '🏦' },
  { to: '/income-tax', label: 'Impôts', icon: '📋' },
  { to: '/calculator', label: 'Calculateur', icon: '🔢' },
  { to: '/settings', label: 'Configuration', icon: '⚙️' },
]

export default function Sidebar() {
  return (
    <aside className="w-64 bg-base-100 shadow-lg">
      <div className="p-4 border-b border-base-300">
        <h1 className="text-xl font-bold text-primary">Finances Entreprise</h1>
      </div>
      <nav className="p-2">
        <ul className="menu menu-compact gap-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
                end={item.to === '/'}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
