export interface TutorialStep {
  icon: string
  title: string
  body: string
  /** Detalhe que só se aprende errando — vale destacar. */
  tip?: string
}

/**
 * O tutorial cobre só o que NÃO é adivinhável olhando a tela. Botão que já diz
 * o que faz não vira passo; convenção invisível (preparação que não registra
 * carga, cronômetro que não dispara) vira.
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    icon: '👤',
    title: 'Cada pessoa tem seu perfil',
    body: 'Planos e histórico de cargas ficam separados por perfil, mesmo usando o mesmo celular. Toque no avatar, no canto superior direito, para trocar de pessoa a qualquer momento.',
  },
  {
    icon: '📋',
    title: 'Monte ou importe seu plano',
    body: 'Em Planos, crie um plano fixo (Treino A, B, C… que se repetem) ou periodizado (Semana 01 a 06, com um treino por dia). Se você já tem o plano num arquivo JSON, use Mais → Importar.',
    tip: 'No plano periodizado, monte a Semana 01 e use "Copiar semana" — depois é só ajustar o que mudou.',
  },
  {
    icon: '🏋️',
    title: 'Treinar é tocar no treino do dia',
    body: 'A tela de execução separa a Preparação (aquecimento, mobilidade) dos exercícios principais. A preparação só tem um "feito" para marcar — ela não registra carga, para não sujar seu histórico de evolução.',
  },
  {
    icon: '⚖️',
    title: 'A carga já vem preenchida',
    body: 'Cada série mostra a última carga que você usou naquele mesmo exercício e série — inclusive de semanas anteriores do ciclo. Ajuste nos botões − e +, informe as repetições e toque no ✓.',
    tip: 'Precisa de uma série além do previsto? Use "+ série extra" no fim do exercício.',
  },
  {
    icon: '⏱️',
    title: 'O descanso começa sozinho',
    body: 'Ao concluir uma série, o cronômetro dispara com o intervalo do plano e avisa com som e vibração no fim. Dá para somar 30s ou pular.',
    tip: 'Quando o plano define o descanso só em texto (ex: "um lado após o outro"), não há cronômetro — a instrução aparece escrita na série.',
  },
  {
    icon: '💾',
    title: 'Faça backup de vez em quando',
    body: 'Os dados ficam apenas neste celular, sem servidor. Em Mais → Backup você exporta um arquivo JSON — é o que permite trocar de aparelho ou recuperar tudo se limpar os dados do navegador.',
  },
]
