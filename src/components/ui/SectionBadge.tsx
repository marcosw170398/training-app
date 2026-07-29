import { SECTION_LABEL, type Section } from '@/db/schema'

const STYLES: Record<Section, string> = {
  warmup: 'bg-warmup/15 text-warmup',
  rampup: 'bg-rampup/15 text-rampup',
  main: 'bg-main/15 text-main',
}

export function SectionBadge({ section }: { section: Section }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STYLES[section]}`}>
      {SECTION_LABEL[section]}
    </span>
  )
}
