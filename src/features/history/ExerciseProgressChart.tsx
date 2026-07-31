export interface ProgressPoint {
  dateKey: string
  /** Maior carga registrada NAQUELA sessão para este movimento. */
  topWeight: number
  isPR: boolean
}

const WIDTH = 640
const HEIGHT = 200
const PAD_X = 16
const PAD_TOP = 20
const PAD_BOTTOM = 28

/**
 * Gráfico de linha em SVG puro — sem biblioteca de gráfico, o app inteiro já
 * evita dependência pesada por princípio (o mesmo motivo de o cronômetro e o
 * cronômetro de OCR serem escritos à mão).
 *
 * Eixo X é por ÍNDICE de sessão, não por tempo real: treinos não são
 * igualmente espaçados no calendário, e espaçar por data faria meses sem
 * treino esticar a linha e esconder a tendência recente.
 */
export function ExerciseProgressChart({ points }: { points: ProgressPoint[] }) {
  if (points.length === 0) return null

  const pesos = points.map((p) => p.topWeight)
  const minPeso = Math.min(...pesos)
  const maxPeso = Math.max(...pesos)
  // Faixa mínima artificial quando a carga não varia, para a linha não ficar
  // colada no meio do gráfico.
  const faixa = Math.max(maxPeso - minPeso, maxPeso * 0.1, 5)
  const baixo = Math.max(0, minPeso - faixa * 0.2)
  const alto = maxPeso + faixa * 0.2

  const x = (index: number): number =>
    points.length === 1
      ? WIDTH / 2
      : PAD_X + (index / (points.length - 1)) * (WIDTH - PAD_X * 2)
  const y = (peso: number): number =>
    PAD_TOP + (1 - (peso - baixo) / (alto - baixo)) * (HEIGHT - PAD_TOP - PAD_BOTTOM)

  const linha = points.map((p, i) => `${x(i)},${y(p.topWeight)}`).join(' ')
  const primeiro = points[0]
  const ultimo = points[points.length - 1]

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Evolução de carga">
      {/* Linhas-guia de fundo, discretas — só orientação, não dado. */}
      <line x1={PAD_X} y1={y(minPeso)} x2={WIDTH - PAD_X} y2={y(minPeso)} className="stroke-border" strokeWidth="1" />
      <line x1={PAD_X} y1={y(maxPeso)} x2={WIDTH - PAD_X} y2={y(maxPeso)} className="stroke-border" strokeWidth="1" />

      <polyline points={linha} fill="none" className="stroke-accent" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <circle
          key={p.dateKey + i}
          cx={x(i)}
          cy={y(p.topWeight)}
          r={p.isPR ? 6 : 4}
          className={p.isPR ? 'fill-main stroke-bg' : 'fill-accent stroke-bg'}
          strokeWidth={p.isPR ? 2 : 1.5}
        />
      ))}

      <text x={PAD_X} y={HEIGHT - 8} className="fill-muted font-mono text-[11px]">
        {primeiro.dateKey.slice(5).replace('-', '/')}
      </text>
      <text x={WIDTH - PAD_X} y={HEIGHT - 8} textAnchor="end" className="fill-muted font-mono text-[11px]">
        {ultimo.dateKey.slice(5).replace('-', '/')}
      </text>
      <text x={PAD_X} y={y(maxPeso) - 6} className="fill-text font-mono text-[11px] font-semibold">
        {maxPeso} kg
      </text>
      {minPeso !== maxPeso ? (
        <text x={PAD_X} y={y(minPeso) + 14} className="fill-muted font-mono text-[11px]">
          {minPeso} kg
        </text>
      ) : null}
    </svg>
  )
}
