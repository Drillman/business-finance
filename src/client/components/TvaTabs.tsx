import { useNavigate } from 'react-router-dom'
import { PageTabs } from '@drillman/dashboard-ui'

const tabs = [
  { key: 'suivi', label: 'Suivi', to: '/tva' },
  { key: 'assistant', label: 'Assistant déclaration', to: '/tva/declaration' },
] as const

export type TvaTab = (typeof tabs)[number]['key']

export function TvaTabs({ active }: { active: TvaTab }) {
  const navigate = useNavigate()

  return (
    <PageTabs<TvaTab>
      aria-label="Sections TVA"
      value={active}
      onChange={(key) => {
        const tab = tabs.find((t) => t.key === key)
        if (tab && key !== active) navigate(tab.to)
      }}
      tabs={tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
    />
  )
}
