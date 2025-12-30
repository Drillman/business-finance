import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  FileText,
  FileText as FileTextSettings,
  Wallet,
  Receipt,
  Landmark,
  Building2,
  ClipboardList,
  Calculator,
  Settings,
  KeyRound,
  ChevronsRight,
  ChevronsLeft,
  LogOut,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/invoices', label: 'Factures', icon: FileText },
  { to: '/expenses', label: 'Dépenses', icon: Wallet },
  { to: '/tva', label: 'TVA', icon: Receipt },
  { to: '/urssaf', label: 'Urssaf', icon: Landmark },
  { to: '/account', label: 'Compte entreprise', icon: Building2 },
  { to: '/income-tax', label: 'Impôts', icon: ClipboardList },
  { to: '/calculator', label: 'Calculateur', icon: Calculator },
]

const settingsItems: NavItem[] = [
  { to: '/settings', label: 'Configuration', icon: Settings },
  { to: '/invoices/settings', label: 'Param. factures', icon: FileTextSettings },
  { to: '/passkeys', label: 'Passkeys', icon: KeyRound },
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
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <ChevronsLeft className="h-5 w-5" />
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
                  `${isActive ? 'bg-base-200 text-base-content' : ''} ${isCollapsed ? 'justify-center px-0 min-w-8' : ''}`
                }
                end={item.to === '/'}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5" />
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
                  `${isActive ? 'bg-base-200 text-base-content' : ''} ${isCollapsed ? 'justify-center px-0 min-w-8' : ''}`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5" />
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
            <LogOut className="h-4 w-4" />
          ) : (
            'Déconnexion'
          )}
        </button>
      </div>
    </aside>
  )
}
