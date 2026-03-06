import type { ReactNode } from 'react'

interface KpiCardProps {
  title: string
  value: ReactNode
  description?: ReactNode
  accentColor?: string
  valueColor?: string
  valueClassName?: string
}

export function KpiCard({
  title,
  value,
  description,
  accentColor = 'var(--color-primary)',
  valueColor = 'var(--text-primary)',
  valueClassName = '',
}: KpiCardProps) {
  return (
    <article
      className="min-h-31 rounded-[10px] border border-(--border-default) border-l-[3px] bg-(--card-bg) px-6 py-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      style={{ borderLeftColor: accentColor }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">{title}</p>
      <p
        className={["mt-1 font-['Space_Grotesk'] text-[28px] leading-none font-semibold tracking-[-0.02em]", valueClassName].join(' ')}
        style={{ color: valueColor }}
      >
        {value}
      </p>
      {description ? <p className="mt-2 text-xs text-(--text-secondary)">{description}</p> : null}
    </article>
  )
}
