import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'

export const YEARS = [2025, 2026] as const

interface SelectOption {
  value: string
  label: string
}

interface SelectorDropdownProps {
  value: string
  options: SelectOption[]
  isOpen: boolean
  onToggle: () => void
  onSelect: (value: string) => void
  triggerClassName: string
  dropdownWidthClass: string
  scrollClassName?: string
}

function SelectorDropdown({
  value,
  options,
  isOpen,
  onToggle,
  onSelect,
  triggerClassName,
  dropdownWidthClass,
  scrollClassName,
}: SelectorDropdownProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const selectedOption = options.find((option) => option.value === value)

  useEffect(() => {
    if (!isOpen) return

    requestAnimationFrame(() => {
      const selectedNode = listRef.current?.querySelector<HTMLElement>(`[data-option-value="${value}"]`)
      selectedNode?.scrollIntoView({ block: 'nearest' })
    })
  }, [isOpen, value])

  return (
    <div className="relative h-full">
      <button
        type="button"
        className={triggerClassName}
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selectedOption?.label ?? value}
      </button>

      {isOpen && (
        <div className={`absolute left-1/2 top-[calc(100%+4px)] z-30 -translate-x-1/2 rounded-[10px] border border-[var(--border-default)] bg-[var(--card-bg)] p-1 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.08)] ${dropdownWidthClass}`}>
          <div
            ref={listRef}
            className={scrollClassName ?? ''}
            role="listbox"
          >
            {options.map((option) => {
              const selected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-option-value={option.value}
                  className={`flex w-full items-center justify-between rounded-md px-3 text-left text-[13px] transition-colors ${selected ? 'h-9.5 bg-[var(--color-primary)]/10 font-semibold text-[var(--color-primary)]' : 'h-9.5 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}
                  onClick={() => onSelect(option.value)}
                >
                  <span>{option.label}</span>
                  {selected && <Check className="h-3.5 w-3.5" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Shared wrapper ---

interface PeriodSelectShellProps {
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  prevTitle: string
  nextTitle: string
  children: React.ReactNode
  isOpen?: boolean
}

function PeriodSelectShell({
  onPrev,
  onNext,
  canPrev,
  canNext,
  prevTitle,
  nextTitle,
  children,
  isOpen = false,
}: PeriodSelectShellProps) {
  return (
    <div className={`group inline-flex h-10 items-stretch rounded-lg bg-[var(--card-bg)] transition-colors ${isOpen ? 'border-[1.5px] border-[var(--color-primary)]' : 'border border-[var(--border-default)] focus-within:border-[1.5px] focus-within:border-[var(--color-primary)]'}`}>
      <button
        type="button"
        className="flex w-9 items-center justify-center rounded-l-lg text-[var(--text-secondary)] transition-colors cursor-pointer disabled:cursor-not-allowed hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:bg-[var(--bg-active)] active:text-[var(--text-primary)] disabled:opacity-30"
        onClick={onPrev}
        disabled={!canPrev}
        title={prevTitle}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className={`relative flex items-center justify-center border-x ${isOpen ? 'border-[var(--color-primary)]' : 'border-[var(--border-default)] group-focus-within:border-[var(--color-primary)]'}`}>
        {children}
      </div>
      <button
        type="button"
        className="flex w-9 items-center justify-center rounded-r-lg text-[var(--text-secondary)] transition-colors cursor-pointer disabled:cursor-not-allowed hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:bg-[var(--bg-active)] active:text-[var(--text-primary)] disabled:opacity-30"
        onClick={onNext}
        disabled={!canNext}
        title={nextTitle}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// --- Year Select ---

interface YearSelectProps {
  value: number
  onChange: (year: number) => void
  years?: number[]
}

export function YearSelect({ value, onChange, years }: YearSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const availableYears = useMemo(() => {
    const sourceYears = years && years.length > 0 ? years : [...YEARS]
    return [...new Set(sourceYears)].sort((a, b) => a - b)
  }, [years])

  const currentIndex = availableYears.indexOf(value)
  const canPrev = currentIndex > 0
  const canNext = currentIndex >= 0 && currentIndex < availableYears.length - 1
  const options = availableYears.map((year) => ({ value: String(year), label: String(year) }))

  return (
    <div ref={rootRef}>
      <PeriodSelectShell
        onPrev={() => canPrev && onChange(availableYears[currentIndex - 1])}
        onNext={() => canNext && onChange(availableYears[currentIndex + 1])}
        canPrev={canPrev}
        canNext={canNext}
        prevTitle="Annee precedente"
        nextTitle="Annee suivante"
        isOpen={isOpen}
      >
        <SelectorDropdown
          value={String(value)}
          options={options}
          isOpen={isOpen}
          onToggle={() => setIsOpen((open) => !open)}
          onSelect={(nextValue) => {
            setIsOpen(false)
            onChange(parseInt(nextValue))
          }}
          triggerClassName="h-full w-20 cursor-pointer bg-transparent text-center font-['Space_Grotesk'] text-sm font-semibold text-[var(--text-primary)]"
          dropdownWidthClass="w-[152px]"
        />
      </PeriodSelectShell>
    </div>
  )
}

// --- Month Select ---

interface MonthSelectProps {
  value: string
  onChange: (month: string) => void
  years?: number[]
}

function formatMonthValue(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
}

function buildMonthOptions(years: number[]): SelectOption[] {
  return [...years]
    .sort((a, b) => b - a)
    .flatMap((year) => {
      const options: SelectOption[] = []
      for (let month = 12; month >= 1; month--) {
        const date = new Date(year, month - 1, 1)
        options.push({
          value: formatMonthValue(date),
          label: date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }),
        })
      }
      return options
    })
}

export function MonthSelect({ value, onChange, years }: MonthSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const currentYear = new Date().getFullYear()
  const availableYears = years ?? [currentYear + 1, currentYear, currentYear - 1]

  const options = useMemo(() => buildMonthOptions(availableYears), [availableYears])
  const currentIndex = options.findIndex((option) => option.value === value)
  const canPrev = currentIndex >= 0 && currentIndex < options.length - 1
  const canNext = currentIndex > 0

  const goToPreviousMonth = () => {
    if (currentIndex >= 0 && canPrev) {
      onChange(options[currentIndex + 1].value)
      return
    }
    const [year, month] = value.split('-').map(Number)
    if (!year || !month) return
    onChange(formatMonthValue(new Date(year, month - 2, 1)))
  }

  const goToNextMonth = () => {
    if (currentIndex >= 0 && canNext) {
      onChange(options[currentIndex - 1].value)
      return
    }
    const [year, month] = value.split('-').map(Number)
    if (!year || !month) return
    onChange(formatMonthValue(new Date(year, month, 1)))
  }

  return (
    <div ref={rootRef}>
      <PeriodSelectShell
        onPrev={goToPreviousMonth}
        onNext={goToNextMonth}
        canPrev={canPrev || currentIndex < 0}
        canNext={canNext || currentIndex < 0}
        prevTitle="Mois precedent"
        nextTitle="Mois suivant"
        isOpen={isOpen}
      >
        <SelectorDropdown
          value={value}
          options={options}
          isOpen={isOpen}
          onToggle={() => setIsOpen((open) => !open)}
          onSelect={(nextValue) => {
            setIsOpen(false)
            onChange(nextValue)
          }}
          triggerClassName="h-full w-[7.5rem] cursor-pointer bg-transparent text-center font-['Space_Grotesk'] text-sm font-semibold capitalize text-[var(--text-primary)]"
          dropdownWidthClass="w-[192px]"
          scrollClassName="max-h-[348px] overflow-y-auto"
        />
      </PeriodSelectShell>
    </div>
  )
}
