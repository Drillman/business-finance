import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: '📊' },
  { to: '/invoices', label: 'Factures', icon: '📄' },
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

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

export default function Sidebar() {
  const { user, logout, isLoggingOut } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return saved === 'true'
  })

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed))
  }, [isCollapsed])

  const toggleSidebar = () => setIsCollapsed(!isCollapsed)

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-56'} bg-base-100 shadow-lg flex flex-col transition-all duration-300`}>
      <div className={`p-4 border-b border-base-300 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <h1 className="text-lg font-bold text-primary truncate">Finances</h1>
        )}
        <button
          onClick={toggleSidebar}
          className="btn btn-ghost btn-sm btn-square"
          title={isCollapsed ? 'Agrandir' : 'Réduire'}
        >
          {isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>
      <nav className="p-2 flex-1 overflow-hidden">
        <ul className={`menu menu-compact gap-1 w-full ${isCollapsed ? 'items-center' : ''}`}>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-0 min-w-8' : ''}`
                }
                end={item.to === '/'}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="divider my-2"></div>
        <ul className={`menu menu-compact gap-1 w-full ${isCollapsed ? 'items-center' : ''}`}>
          {settingsItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-0 min-w-8' : ''}`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className={`p-2 border-t border-base-300 ${isCollapsed ? 'flex flex-col items-center' : 'p-4'}`}>
        {!isCollapsed && (
          <div className="text-sm text-base-content/70 mb-2 truncate">
            {user?.email}
          </div>
        )}
        <button
          onClick={logout}
          disabled={isLoggingOut}
          className={`btn btn-sm btn-outline btn-error ${isCollapsed ? 'btn-square' : 'w-full'}`}
          title={isCollapsed ? 'Déconnexion' : undefined}
        >
          {isLoggingOut ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          ) : (
            'Déconnexion'
          )}
        </button>
      </div>
    </aside>
  )
}
