import type { ReactNode } from 'react'

export interface FinanceTableColumn {
  key: string
  label: string
  className?: string
}

interface FinanceTableProps {
  columns: FinanceTableColumn[]
  children: ReactNode
  footer?: ReactNode
  minWidthClassName?: string
}

export function FinanceTable({
  columns,
  children,
  footer,
  minWidthClassName = 'min-w-[1060px]',
}: FinanceTableProps) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-(--border-default) bg-(--card-bg) shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="overflow-x-auto">
        <table className={["w-full table-fixed border-collapse", minWidthClassName].filter(Boolean).join(' ')}>
          <thead>
            <tr className="h-10 border-b border-(--border-default) bg-(--color-base-200) text-left">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={[
                    'px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-(--text-secondary) md:px-4 md:text-xs',
                    column.className ?? '',
                  ].join(' ')}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
          {footer ? <tfoot>{footer}</tfoot> : null}
        </table>
      </div>
    </div>
  )
}
