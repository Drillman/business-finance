import { useState } from 'react'
import { useTvaDeclaration } from '../hooks/useTva'
import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { MonthSelect } from '../components/PeriodSelect'

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
    <div className="overflow-hidden rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <button
        className="flex w-full items-center justify-between px-5 py-3 transition-colors hover:bg-(--bg-hover)"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          {isOpen ? <ChevronUp className="h-4 w-4 text-(--text-secondary)" /> : <ChevronDown className="h-4 w-4 text-(--text-secondary)" />}
          <span className="text-sm font-semibold text-(--text-primary)">{title}</span>
          <span className="inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-[#EFF6FF] px-2 text-[11px] font-semibold text-[#2563EB]">
            {count}
          </span>
        </div>
        <span className="font-['Space_Grotesk'] text-sm font-semibold text-(--text-primary)">{total}</span>
      </button>
      {isOpen && (
        <div className="border-t border-(--border-default)">
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
      card: 'border-(--border-default) bg-(--card-bg)',
      text: 'text-(--text-primary)',
      label: 'text-(--text-tertiary)',
      desc: 'text-(--text-secondary)',
    },
    primary: {
      card: 'border-[#2563EB] bg-[#EFF6FF]',
      text: 'text-[#2563EB]',
      label: 'text-[#2563EB]',
      desc: 'text-[#2563EB]/70',
    },
    success: {
      card: 'border-[#16A34A] bg-[#ECFDF5]',
      text: 'text-[#16A34A]',
      label: 'text-[#16A34A]',
      desc: 'text-[#16A34A]/70',
    },
  }

  const styles = variantStyles[variant]

  return (
    <div className={`rounded-[10px] border p-4 ${styles.card}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.05em] ${styles.label}`}>{label}</p>
      <p className={`mt-1 font-['Space_Grotesk'] text-2xl font-semibold tracking-tight ${styles.text}`}>{value}</p>
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
      card: 'border-[#F59E0B] bg-[#FFFBEB]',
      text: 'text-[#F59E0B]',
    },
    success: {
      card: 'border-[#16A34A] bg-[#ECFDF5]',
      text: 'text-[#16A34A]',
    },
    error: {
      card: 'border-[#DC2626] bg-[#FEF2F2]',
      text: 'text-[#DC2626]',
    },
  }

  const styles = toneStyles[tone]

  return (
    <div className={`rounded-[10px] border p-4 ${styles.card}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${styles.text}`}>{label}</p>
      <p className={`mt-1 font-['Space_Grotesk'] text-[22px] font-semibold ${styles.text}`}>{value}</p>
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
        <h1 className="text-3xl font-semibold tracking-tight text-(--text-primary)">Assistant Declaration TVA</h1>
        <MonthSelect
          value={selectedMonth}
          onChange={setSelectedMonth}
          years={[currentYear + 1, currentYear, currentYear - 1, currentYear - 2]}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span>Erreur lors du chargement des donnees</span>
        </div>
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
                <p className="px-5 py-4 text-sm text-(--text-secondary)">Aucun encaissement ce mois</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-160">
                    <thead className="h-9 border-b border-(--border-default) bg-(--color-base-200)">
                      <tr>
                        <th className="px-5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Client</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Date paiement</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Montant HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {declaration.details.invoicesPaid.map((inv, index) => (
                        <tr key={inv.id} className={`h-10 ${index % 2 === 1 ? 'bg-(--color-base-200)/45' : ''}`}>
                          <td className="px-5 text-sm text-(--text-primary)">{inv.client}</td>
                          <td className="px-5 text-right text-sm text-(--text-secondary)">{inv.paymentDate ? formatDate(inv.paymentDate) : '-'}</td>
                          <td className="px-5 text-right text-sm font-medium text-(--text-primary)">{formatCurrency(parseFloat(inv.amountHt))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Achats intra-UE"
              count={declaration.details.expensesIntraEu.length}
              total={formatCurrency(declaration.cases.B2)}
            >
              {declaration.details.expensesIntraEu.length === 0 ? (
                <p className="px-5 py-4 text-sm text-(--text-secondary)">Aucun achat intra-UE ce mois</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-160">
                    <thead className="h-9 border-b border-(--border-default) bg-(--color-base-200)">
                      <tr>
                        <th className="px-5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Description</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Date</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Montant HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {declaration.details.expensesIntraEu.map((exp, index) => (
                        <tr key={exp.id} className={`h-10 ${index % 2 === 1 ? 'bg-(--color-base-200)/45' : ''}`}>
                          <td className="px-5 text-sm text-(--text-primary)">{exp.description}</td>
                          <td className="px-5 text-right text-sm text-(--text-secondary)">{formatDate(exp.date)}</td>
                          <td className="px-5 text-right text-sm font-medium text-(--text-primary)">{formatCurrency(parseFloat(exp.amountHt))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Immobilisations"
              count={declaration.details.expensesOver500.length}
              total={formatCurrency(declaration.cases.case19)}
            >
              {declaration.details.expensesOver500.length === 0 ? (
                <p className="px-5 py-4 text-sm text-(--text-secondary)">Aucune immobilisation ce mois</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-190">
                    <thead className="h-9 border-b border-(--border-default) bg-(--color-base-200)">
                      <tr>
                        <th className="px-5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Description</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Date</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">HT</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">TVA</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Recuperable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {declaration.details.expensesOver500.map((exp, index) => {
                        const recoverable = parseFloat(exp.taxAmount) * parseFloat(exp.taxRecoveryRate) / 100
                        return (
                          <tr key={exp.id} className={`h-10 ${index % 2 === 1 ? 'bg-(--color-base-200)/45' : ''}`}>
                            <td className="px-5 text-sm text-(--text-primary)">{exp.description}</td>
                            <td className="px-5 text-right text-sm text-(--text-secondary)">{formatDate(exp.date)}</td>
                            <td className="px-5 text-right text-sm font-medium text-(--text-primary)">{formatCurrency(parseFloat(exp.amountHt))}</td>
                            <td className="px-5 text-right text-sm font-medium text-(--text-primary)">{formatCurrency(parseFloat(exp.taxAmount))}</td>
                            <td className="px-5 text-right text-sm font-semibold text-[#16A34A]">{formatCurrency(recoverable)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection
              title="Autres depenses avec TVA"
              count={declaration.details.expensesWithTva.length}
              total={formatCurrency(declaration.cases.case20 - declaration.cases.case17)}
            >
              {declaration.details.expensesWithTva.length === 0 ? (
                <p className="px-5 py-4 text-sm text-(--text-secondary)">Aucune autre depense avec TVA ce mois</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-190">
                    <thead className="h-9 border-b border-(--border-default) bg-(--color-base-200)">
                      <tr>
                        <th className="px-5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Description</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Date</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">HT</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">TVA</th>
                        <th className="px-5 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">Recuperable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {declaration.details.expensesWithTva.map((exp, index) => {
                        const recoverable = parseFloat(exp.taxAmount) * parseFloat(exp.taxRecoveryRate) / 100
                        return (
                          <tr key={exp.id} className={`h-10 ${index % 2 === 1 ? 'bg-(--color-base-200)/45' : ''}`}>
                            <td className="px-5 text-sm text-(--text-primary)">{exp.description}</td>
                            <td className="px-5 text-right text-sm text-(--text-secondary)">{formatDate(exp.date)}</td>
                            <td className="px-5 text-right text-sm font-medium text-(--text-primary)">{formatCurrency(parseFloat(exp.amountHt))}</td>
                            <td className="px-5 text-right text-sm font-medium text-(--text-primary)">{formatCurrency(parseFloat(exp.taxAmount))}</td>
                            <td className="px-5 text-right text-sm font-semibold text-[#16A34A]">{formatCurrency(recoverable)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleSection>

            <div className="mt-1 rounded-[10px] border border-[#3B82F6] bg-[#DBEAFE] px-5 py-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#3B82F6]" />
                <div>
                  <p className="text-[13px] font-semibold text-[#3B82F6]">Note sur le calcul</p>
                  <p className="mt-1 text-xs leading-5 text-[#3B82F6]/80">
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
