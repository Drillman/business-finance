import { ChevronLeft, ChevronRight } from 'lucide-react'

export const YEARS = [2025, 2026] as const

interface YearSelectProps {
  value: number
  onChange: (year: number) => void
  size?: 'sm' | 'md'
}

export function YearSelect({ value, onChange, size = 'md' }: YearSelectProps) {
  const currentIndex = YEARS.indexOf(value as (typeof YEARS)[number])
  const canGoBack = currentIndex > 0
  const canGoForward = currentIndex < YEARS.length - 1

  return (
    <div className="join">
      <button
        className={`btn btn-ghost border border-base-content/20 join-item ${size === 'sm' ? 'btn-sm' : ''}`}
        onClick={() => canGoBack && onChange(YEARS[currentIndex - 1])}
        disabled={!canGoBack}
        title="Année précédente"
      >
        <ChevronLeft className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
      <select
        className={`select select-ghost border border-base-content/20 join-item ${size === 'sm' ? 'select-sm' : ''}`}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <button
        className={`btn btn-ghost border border-base-content/20 join-item ${size === 'sm' ? 'btn-sm' : ''}`}
        onClick={() => canGoForward && onChange(YEARS[currentIndex + 1])}
        disabled={!canGoForward}
        title="Année suivante"
      >
        <ChevronRight className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
    </div>
  )
}
