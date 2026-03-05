import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard,
  FileText,
  FileCog,
  Wallet,
  Receipt,
  Landmark,
  Building2,
  ClipboardList,
  Calculator,
  Settings,
  KeyRound,
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
  { to: '/invoices/settings', label: 'Param. factures', icon: FileCog },
  { to: '/passkeys', label: 'Passkeys', icon: KeyRound },
]

function SidebarLogo() {
  return (
    <div className="relative h-9 w-9 rounded-[10px] bg-gradient-to-br from-[#4F46E5] via-[#2563EB] to-[#1E40AF]">
      <span className="absolute left-[9px] top-[7px] h-[26px] w-[4px] rounded-[2px] bg-white" />
      <span className="absolute left-[9px] top-[7px] h-[4px] w-[12px] rounded-[2px] bg-white" />
      <span className="absolute left-[9px] top-[18px] h-[4px] w-[16px] rounded-[2px] bg-white" />
      <span className="absolute left-[9px] top-[29px] h-[4px] w-[16px] rounded-[2px] bg-white" />
      <span className="absolute left-[17px] top-[7px] h-[15px] w-[4px] rounded-[2px] bg-white" />
      <span className="absolute left-[21px] top-[18px] h-[15px] w-[4px] rounded-[2px] bg-white" />
      <span className="absolute left-[29px] top-[11px] h-[22px] w-[3px] rounded-[2px] bg-white/35" />
    </div>
  )
}

interface SidebarLinkProps {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

function SidebarLink({ to, label, icon: Icon, end = false }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex h-10 w-full items-center gap-2.5 rounded-lg px-3 transition-colors',
          isActive
            ? 'bg-[#334155] font-semibold text-white'
            : 'text-[#CBD5E1] hover:bg-[#334155] hover:text-white',
        ].join(' ')
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate text-sm font-medium">{label}</span>
    </NavLink>
  )
}

export default function Sidebar() {
  const { user, logout, isLoggingOut } = useAuth()

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 bg-gradient-to-br from-[#1E3A5F] via-[#1A1F4B] to-[#0F172A] px-5 py-7">
      <div className="flex h-11 items-center gap-2.5 px-1">
        <SidebarLogo />
        <h1 className="truncate text-xl font-bold tracking-tight text-white">Finance</h1>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              end={item.to === '/'}
            />
          ))}
        </div>

        <div className="my-2 h-px w-full bg-[#334155]" />

        <div className="space-y-0.5">
          {settingsItems.map((item) => (
            <SidebarLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
          ))}
        </div>
      </nav>

      <div className="space-y-2.5">
        <p className="truncate px-1 text-xs text-[#CBD5E1]">{user?.email}</p>
        <button
          onClick={logout}
          disabled={isLoggingOut}
          className="flex h-9 w-full items-center justify-center rounded-lg border border-[#F87171] px-3 text-sm font-medium text-[#F87171] transition-colors hover:bg-[#7F1D1D]/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoggingOut ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <span className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Déconnexion
            </span>
          )}
        </button>
      </div>
    </aside>
  )
}
