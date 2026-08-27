import { useNavigate } from 'react-router-dom'

const tabs = [
  { key: 'suivi', label: 'Suivi', to: '/tva' },
  { key: 'assistant', label: 'Assistant déclaration', to: '/tva/declaration' },
] as const

export type TvaTab = (typeof tabs)[number]['key']

export function TvaTabs({ active }: { active: TvaTab }) {
  const navigate = useNavigate()

  return (
    <div className="inline-flex h-10 items-center gap-1 self-start rounded-lg border border-(--border-default) bg-(--color-base-200) p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={[
            'inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors',
            tab.key === active
              ? 'bg-(--card-bg) text-(--text-primary) shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
              : 'text-(--text-secondary) hover:text-(--text-primary)',
          ].join(' ')}
          onClick={() => {
            if (tab.key !== active) navigate(tab.to)
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
