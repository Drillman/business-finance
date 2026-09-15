import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Building2,
  Calculator,
  ClipboardList,
  FileCog,
  FileText,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  Receipt,
  Settings,
  Wallet,
} from 'lucide-react'
import { AppShell, type NavItem, type NavSection, Sidebar, SidebarUserMenu } from '@drillman/dashboard-ui'
import { useAuth } from '../contexts/AuthContext'

const navSections: NavSection[] = [
  { items: [{ to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true }] },
  {
    label: 'Activité',
    items: [
      { to: '/invoices', label: 'Factures', icon: FileText, end: true },
      { to: '/expenses', label: 'Dépenses', icon: Wallet },
    ],
  },
  {
    label: 'Déclarations & paiements',
    items: [
      { to: '/tva', label: 'TVA', icon: Receipt },
      { to: '/urssaf', label: 'Urssaf', icon: Landmark },
      { to: '/income-tax', label: 'Impôts', icon: ClipboardList },
    ],
  },
  {
    label: 'Trésorerie',
    items: [
      { to: '/account', label: 'Compte entreprise', icon: Building2 },
      { to: '/calculator', label: 'Calculateur', icon: Calculator },
    ],
  },
]

const accountLinks: NavItem[] = [
  { to: '/settings', label: 'Configuration', icon: Settings, end: true },
  { to: '/invoices/settings', label: 'Param. factures', icon: FileCog },
  { to: '/passkeys', label: 'Passkeys', icon: KeyRound },
]

/** "F" monogram of the app, drawn with bars. */
function LogoMark() {
  return (
    <div className="relative size-8 shrink-0 rounded-control bg-linear-to-br from-[#4F46E5] via-accent to-[#1E40AF] ring-1 ring-white/20">
      <span className="absolute top-1.5 left-2 h-5 w-0.75 rounded-xs bg-white" />
      <span className="absolute top-1.5 left-2 h-0.75 w-2.5 rounded-xs bg-white" />
      <span className="absolute top-3.5 left-2 h-0.75 w-3.5 rounded-xs bg-white" />
      <span className="absolute top-5.75 left-2 h-0.75 w-3.5 rounded-xs bg-white" />
      <span className="absolute top-1.5 left-3.75 h-3 w-0.75 rounded-xs bg-white" />
      <span className="absolute top-3.5 left-4.75 h-3 w-0.75 rounded-xs bg-white" />
    </div>
  )
}

function Brand({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className={`font-display text-lg font-bold tracking-tight ${onDark ? 'text-white' : 'text-text-primary'}`}>
        Finance
      </span>
    </span>
  )
}

export default function Layout() {
  const { user, logout, isLoggingOut } = useAuth()
  const { pathname } = useLocation()

  return (
    <AppShell
      closeMobileNavOn={pathname}
      mobileBrand={<Brand />}
      contentClassName="max-w-300 px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8"
      sidebar={
        <Sidebar
          logo={<Brand onDark />}
          collapsedLogo={<LogoMark />}
          sections={navSections}
          currentPath={pathname}
          linkComponent={Link}
          collapsible
          collapsedStorageKey="business-finance.sidebar.collapsed"
          footer={
            <SidebarUserMenu
              name={user?.email ?? 'Compte utilisateur'}
              links={accountLinks}
              actions={[
                { label: 'Déconnexion', icon: LogOut, tone: 'danger', loading: isLoggingOut, onClick: () => logout() },
              ]}
            />
          }
        />
      }
    >
      <Outlet />
    </AppShell>
  )
}
