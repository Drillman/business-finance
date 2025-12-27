import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: '📊' },
  { to: '/invoices', label: 'Chiffre d\'affaire', icon: '📄' },
  { to: '/expenses', label: 'Dépenses', icon: '💰' },
  { to: '/tva', label: 'TVA', icon: '🧾' },
  { to: '/urssaf', label: 'Urssaf', icon: '🏛️' },
  { to: '/account', label: 'Compte entreprise', icon: '🏦' },
  { to: '/income-tax', label: 'Impôts', icon: '📋' },
  { to: '/calculator', label: 'Calculateur', icon: '🔢' },
]

const settingsItems = [
  { to: '/settings', label: 'Configuration', icon: '⚙️' },
  { to: '/passkeys', label: 'Passkeys', icon: '🔐' },
]

export default function Sidebar() {
  const { user, logout, isLoggingOut } = useAuth()

  return (
    <aside className="w-64 bg-base-100 shadow-lg flex flex-col">
      <div className="p-4 border-b border-base-300">
        <h1 className="text-xl font-bold text-primary">Finances Entreprise</h1>
      </div>
      <nav className="p-2 flex-1">
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
        <div className="divider my-2"></div>
        <ul className="menu menu-compact gap-1">
          {settingsItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'active' : ''
                }
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t border-base-300">
        <div className="text-sm text-base-content/70 mb-2 truncate">
          {user?.email}
        </div>
        <button
          onClick={logout}
          disabled={isLoggingOut}
          className="btn btn-sm btn-outline btn-error w-full"
        >
          {isLoggingOut ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            'Déconnexion'
          )}
        </button>
      </div>
    </aside>
  )
}
