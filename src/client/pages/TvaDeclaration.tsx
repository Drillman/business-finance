import { useState } from 'react'
import { useTvaDeclaration } from '../hooks/useTva'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { TvaTabs } from '../components/TvaTabs'
import { Alert, DataTable, MonthSwitch, Spinner, type DataTableColumn } from '@drillman/dashboard-ui'

function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(num)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
}

type Declaration = NonNullable<ReturnType<typeof useTvaDeclaration>['data']>
type DeclarationInvoice = Declaration['details']['invoicesPaid'][number]
type IntraEuExpense = Declaration['details']['expensesIntraEu'][number]
type DeductibleExpense = Declaration['details']['expensesWithTva'][number]

const invoiceColumns: DataTableColumn<DeclarationInvoice>[] = [
  { key: 'client', header: 'Client', cell: (inv) => inv.client },
  {
    key: 'payment-date',
    header: 'Date paiement',
    align: 'right',
    numeric: false,
    className: 'text-text-secondary',
    cell: (inv) => (inv.paymentDate ? formatDate(inv.paymentDate) : '-'),
  },
  { key: 'amount', header: 'Montant HT', align: 'right', className: 'font-medium', cell: (inv) => formatCurrency(parseFloat(inv.amountHt)) },
]

const intraEuColumns: DataTableColumn<IntraEuExpense>[] = [
  { key: 'description', header: 'Description', cell: (exp) => exp.description },
  { key: 'date', header: 'Date', align: 'right', numeric: false, className: 'text-text-secondary', cell: (exp) => formatDate(exp.date) },
  { key: 'amount', header: 'Montant HT', align: 'right', className: 'font-medium', cell: (exp) => formatCurrency(parseFloat(exp.amountHt)) },
]

const deductibleColumns: DataTableColumn<DeductibleExpense>[] = [
  { key: 'description', header: 'Description', cell: (exp) => exp.description },
  { key: 'date', header: 'Date', align: 'right', numeric: false, className: 'text-text-secondary', cell: (exp) => formatDate(exp.date) },
  { key: 'ht', header: 'HT', align: 'right', className: 'font-medium', cell: (exp) => formatCurrency(parseFloat(exp.amountHt)) },
  { key: 'tva', header: 'TVA', align: 'right', className: 'font-medium', cell: (exp) => formatCurrency(parseFloat(exp.taxAmount)) },
  {
    key: 'recoverable',
    header: 'Recuperable',
    align: 'right',
    className: 'font-semibold text-success',
    cell: (exp) => formatCurrency((parseFloat(exp.taxAmount) * parseFloat(exp.taxRecoveryRate)) / 100),
  },
]

interface CollapsibleSectionProps {
  title: string
  count: number
  total: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function CollapsibleSection({ title, count, total, children, defaultOpen = false }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface ">
      <button
        className="flex w-full items-center justify-between px-5 py-3 transition-colors hover:bg-surface-hover"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          {isOpen ? <ChevronUp className="h-4 w-4 text-text-secondary" /> : <ChevronDown className="h-4 w-4 text-text-secondary" />}
          <span className="text-sm font-semibold text-text-primary">{title}</span>
          <span className="inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-accent-soft px-2 text-[11px] font-semibold text-accent">
            {count}
          </span>
        </div>
        <span className="font-display text-sm font-semibold text-text-primary">{total}</span>
      </button>
      {isOpen && (
        <div className="border-t border-border">
          {children}
        </div>
      )}
    </div>
  )
}

interface CaseCardProps {
  label: string
  value: string
  description: string
  variant?: 'default' | 'primary' | 'success'
}

function CaseCard({ label, value, description, variant = 'default' }: CaseCardProps) {
  const variantStyles = {
    default: {
      card: 'border-border bg-surface',
      text: 'text-text-primary',
      label: 'text-text-muted',
      desc: 'text-text-secondary',
    },
    primary: {
      card: 'border-accent bg-accent-soft',
      text: 'text-accent',
      label: 'text-accent',
      desc: 'text-accent/70',
    },
    success: {
      card: 'border-success bg-success-soft',
      text: 'text-success',
      label: 'text-success',
      desc: 'text-success/70',
    },
  }

  const styles = variantStyles[variant]

  return (
    <div className={`rounded-card border p-4 ${styles.card}`}>
      <p className={`text-label font-semibold uppercase ${styles.label}`}>{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold tracking-tight ${styles.text}`}>{value}</p>
      <p className={`mt-1 text-xs ${styles.desc}`}>{description}</p>
    </div>
  )
}

interface SummaryCardProps {
  label: string
  value: string
  description: string
  tone: 'warning' | 'success' | 'error'
}

function SummaryCard({ label, value, description, tone }: SummaryCardProps) {
  const toneStyles = {
    warning: {
      card: 'border-warning bg-warning-soft',
      text: 'text-warning',
    },
    success: {
      card: 'border-success bg-success-soft',
      text: 'text-success',
    },
    error: {
      card: 'border-danger bg-danger-soft',
      text: 'text-danger',
    },
  }

  const styles = toneStyles[tone]

  return (
    <div className={`rounded-card border p-4 ${styles.card}`}>
      <p className={`text-label font-semibold uppercase ${styles.text}`}>{label}</p>
      <p className={`mt-1 font-display text-kpi-sm font-semibold ${styles.text}`}>{value}</p>
      <p className={`mt-1 text-xs ${styles.text} opacity-70`}>{description}</p>
    </div>
  )
}

export default function TvaDeclaration() {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())

  const { data: declaration, isLoading, error } = useTvaDeclaration(selectedMonth)

  const currentYear = new Date().getFullYear()

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">TVA</h1>
        <MonthSwitch
          value={selectedMonth}
          onChange={setSelectedMonth}
          min={`${currentYear - 2}-01`}
          max={`${currentYear + 1}-12`}
        />
      </div>

      <TvaTabs active="assistant" />

      {isLoading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <Alert tone="danger">Erreur lors du chargement des données</Alert>
      )}

      {declaration && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <CaseCard
              label="Case A1"
              value={formatCurrency(declaration.cases.A1)}
              description="CA encaisse HT"
            />
            <CaseCard
              label="Case B2"
              value={formatCurrency(declaration.cases.B2)}
              description="Achats intra-UE"
            />
            <CaseCard
              label="Case 08"
              value={formatCurrency(declaration.cases.case08)}
              description="Base HT 20%"
              variant="primary"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <CaseCard
              label="Case 17"
              value={formatCurrency(declaration.cases.case17)}
              description="TVA intra-UE"
            />
            <CaseCard
              label="Case 19"
              value={formatCurrency(declaration.cases.case19)}
              description="TVA immobilisations"
              variant="success"
            />
            <CaseCard
              label="Case 20"
              value={formatCurrency(declaration.cases.case20)}
              description="Autre TVA deductible"
              variant="success"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SummaryCard
              label="TVA COLLECTEE"
              value={formatCurrency(declaration.summary.tvaCollected)}
              description="20% de case 08"
              tone="warning"
            />
            <SummaryCard
              label="TVA DEDUCTIBLE"
              value={formatCurrency(declaration.summary.tvaDeductible)}
              description="Case 19 + Case 20"
              tone="success"
            />
            <SummaryCard
              label="TVA NETTE"
              value={formatCurrency(Math.abs(declaration.summary.tvaNet))}
              description={declaration.summary.tvaNet >= 0 ? 'A payer' : 'Credit de TVA'}
              tone={declaration.summary.tvaNet >= 0 ? 'error' : 'success'}
            />
          </div>

          {/* Details Sections */}
          <div className="space-y-3">
            <CollapsibleSection
              title="Encaissements"
              count={declaration.details.invoicesPaid.length}
              total={formatCurrency(declaration.cases.A1)}
              defaultOpen={true}
            >
              {declaration.details.invoicesPaid.length === 0 ? (
                <p className="px-5 py-4 text-sm text-text-secondary">Aucun encaissement ce mois</p>
              ) : (
                <DataTable
                  variant="plain"
                  columns={invoiceColumns}
                  rows={declaration.details.invoicesPaid}
                  getRowKey={(inv) => inv.id}
                  minWidth="min-w-160"
                />
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Achats intra-UE"
              count={declaration.details.expensesIntraEu.length}
              total={formatCurrency(declaration.cases.B2)}
            >
              {declaration.details.expensesIntraEu.length === 0 ? (
                <p className="px-5 py-4 text-sm text-text-secondary">Aucun achat intra-UE ce mois</p>
              ) : (
                <DataTable
                  variant="plain"
                  columns={intraEuColumns}
                  rows={declaration.details.expensesIntraEu}
                  getRowKey={(exp) => exp.id}
                  minWidth="min-w-160"
                />
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Immobilisations"
              count={declaration.details.expensesOver500.length}
              total={formatCurrency(declaration.cases.case19)}
            >
              {declaration.details.expensesOver500.length === 0 ? (
                <p className="px-5 py-4 text-sm text-text-secondary">Aucune immobilisation ce mois</p>
              ) : (
                <DataTable
                  variant="plain"
                  columns={deductibleColumns}
                  rows={declaration.details.expensesOver500}
                  getRowKey={(exp) => exp.id}
                  minWidth="min-w-190"
                />
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Autres depenses avec TVA"
              count={declaration.details.expensesWithTva.length}
              total={formatCurrency(declaration.cases.case20 - declaration.cases.case17)}
            >
              {declaration.details.expensesWithTva.length === 0 ? (
                <p className="px-5 py-4 text-sm text-text-secondary">Aucune autre depense avec TVA ce mois</p>
              ) : (
                <DataTable
                  variant="plain"
                  columns={deductibleColumns}
                  rows={declaration.details.expensesWithTva}
                  getRowKey={(exp) => exp.id}
                  minWidth="min-w-190"
                />
              )}
            </CollapsibleSection>

            <div className="mt-1 rounded-card border border-info bg-accent-soft px-5 py-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-info" />
                <div>
                  <p className="text-compact font-semibold text-info">Note sur le calcul</p>
                  <p className="mt-1 text-xs leading-5 text-info/80">
                    Case 20 inclut la TVA auto-liquidee (case 17) pour neutraliser l&apos;effet des achats intra-UE.
                    Les montants sont arrondis a l&apos;euro le plus proche.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
