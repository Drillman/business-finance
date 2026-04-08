import { useEffect, useRef, useState } from 'react'
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
  CircleUserRound,
  ChevronUp,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
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
  { to: '/account', label: 'Compte entreprise', icon: Building2 },
  { to: '/calculator', label: 'Calculateur', icon: Calculator },
]

const taxItems: NavItem[] = [
  { to: '/urssaf', label: 'Urssaf', icon: Landmark },
  { to: '/tva', label: 'TVA', icon: Receipt },
  { to: '/income-tax', label: 'Impôts', icon: ClipboardList },
]

const settingsItems: NavItem[] = [
  { to: '/settings', label: 'Configuration', icon: Settings },
  { to: '/invoices/settings', label: 'Param. factures', icon: FileCog },
  { to: '/passkeys', label: 'Passkeys', icon: KeyRound },
]

function SidebarLogo() {
  return (
    <div className="relative h-10 w-10 shrink-0 rounded-[10px] bg-linear-to-br from-[#4F46E5] via-[#2563EB] to-[#1E40AF]">
      <span className="absolute left-2.25 top-1.75 h-6.5 w-1 rounded-xs bg-white" />
      <span className="absolute left-2.25 top-1.75 h-1 w-3 rounded-xs bg-white" />
      <span className="absolute left-2.25 top-4.5 h-1 w-4 rounded-xs bg-white" />
      <span className="absolute left-2.25 top-7.25 h-1 w-4 rounded-xs bg-white" />
      <span className="absolute left-4.25 top-1.75 h-3.75 w-1 rounded-xs bg-white" />
      <span className="absolute left-5.25 top-4.5 h-3.75 w-1 rounded-xs bg-white" />
      <span className="absolute left-7.25 top-2.75 h-5.5 w-0.75 rounded-xs bg-white/35" />
    </div>
  )
}

interface SidebarLinkProps {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  collapsed: boolean
}

interface UserMenuLinkProps {
  to: string
  label: string
  icon: LucideIcon
  onSelect: () => void
}

function SidebarLink({ to, label, icon: Icon, end = false, collapsed }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'flex h-10 w-full items-center rounded-lg transition-colors',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-3',
          isActive
            ? 'bg-white/20 text-white shadow-[inset_3px_0_0_#ffffff] backdrop-blur-sm'
            : 'text-[#CBD5E1] hover:bg-white/20 hover:text-white',
        ].join(' ')
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate text-sm font-medium leading-none">{label}</span>}
    </NavLink>
  )
}

function UserMenuLink({ to, label, icon: Icon, onSelect }: UserMenuLinkProps) {
  return (
    <NavLink
      to={to}
      end={to === '/settings'}
      onClick={onSelect}
      className={({ isActive }) =>
        [
          'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-colors',
          isActive ? 'bg-[#EEF2FF] text-[#1E3A8A]' : 'text-[#0F172A] hover:bg-[#F8FAFC]',
        ].join(' ')
      }
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      <span className="truncate font-medium">{label}</span>
    </NavLink>
  )
}

export default function Sidebar() {
  const { user, logout, isLoggingOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!isUserMenuOpen || !userMenuRef.current) {
        return
      }

      if (!userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isUserMenuOpen])

  useEffect(() => {
    setIsUserMenuOpen(false)
  }, [collapsed])

  return (
    <aside
      className={[
        'flex shrink-0 flex-col gap-2 bg-linear-to-br from-[#1E3A8A] via-[#2544A8] to-[#4338CA] py-7 transition-all duration-300',
        collapsed ? 'w-18 px-4' : 'w-56 px-5',
      ].join(' ')}
    >
      {/* Header */}
      <div
        className={[
          'flex h-11 items-center pb-3',
          collapsed ? 'justify-center' : 'gap-2.5 px-1',
        ].join(' ')}
      >
        <SidebarLogo />
        {!collapsed && (
          <h1 className="truncate font-['Space_Grotesk'] text-[20px] font-bold tracking-tight text-white">
            Finance
          </h1>
        )}
      </div>

      {/* Nav */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              end={item.to === '/' || item.to === '/invoices'}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="my-2 h-px w-full bg-white/20" />

        <nav className="space-y-0.5">
          {taxItems.map((item) => (
            <SidebarLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </div>

      <div ref={userMenuRef} className="relative">
        <button
          onClick={() => setIsUserMenuOpen((open) => !open)}
          title={collapsed ? user?.email ?? 'Compte utilisateur' : undefined}
          aria-label="Compte utilisateur"
          aria-haspopup="menu"
          aria-expanded={isUserMenuOpen}
          className={[
            'flex w-full items-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20',
            collapsed ? 'h-10 justify-center' : 'h-11 gap-2.5 px-3',
          ].join(' ')}
        >
          <CircleUserRound className="h-5.5 w-5.5 shrink-0" />
          {!collapsed && (
            <>
              <span className="truncate text-[13px] font-medium text-white">{user?.email ?? 'Compte utilisateur'}</span>
              <ChevronUp
                className={[
                  'ml-auto h-4 w-4 shrink-0 text-white/70 transition-transform',
                  isUserMenuOpen ? '' : 'rotate-180',
                ].join(' ')}
              />
            </>
          )}
        </button>

        {isUserMenuOpen && (
          <div
            className={[
              'absolute z-30 w-55 rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.09)]',
                collapsed ? 'bottom-0 left-full ml-3' : 'bottom-full left-0 mb-3',
            ].join(' ')}
          >
            {settingsItems.map((item) => (
              <UserMenuLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                onSelect={() => setIsUserMenuOpen(false)}
              />
            ))}

            <div className="my-1 h-px w-full bg-[#E2E8F0]" />

            <button
              onClick={async () => {
                setIsUserMenuOpen(false)
                await logout()
              }}
              disabled={isLoggingOut}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-[#DC2626] transition-colors hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingOut ? (
                <span className="loading loading-spinner loading-sm text-[#DC2626]" />
              ) : (
                <>
                  <LogOut className="h-4.5 w-4.5 shrink-0" />
                  Déconnexion
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Fold button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-white/25 bg-white/10 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
      >
        {collapsed ? (
          <ChevronsRight className="h-4.5 w-4.5 shrink-0" />
        ) : (
          <>
            <ChevronsLeft className="h-4.5 w-4.5 shrink-0" />
            Replier
          </>
        )}
      </button>
    </aside>
  )
}
