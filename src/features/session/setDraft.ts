export interface SetValues {
  weight: number | null
  reps: number | null
  durationSeconds: number | null
}

/** Texto dos campos antes de virar número — permite campo vazio. */
export interface SetDraft {
  weight: string
  reps: string
  duration: string
  showDuration: boolean
}

export const toNumber = (value: string): number | null => {
  const parsed = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(parsed) ? null : parsed
}

export function draftToValues(draft: SetDraft): SetValues {
  return {
    weight: toNumber(draft.weight),
    reps: toNumber(draft.reps),
    durationSeconds: draft.showDuration ? toNumber(draft.duration) : null,
  }
}
