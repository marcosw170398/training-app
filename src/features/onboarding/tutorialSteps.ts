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
    icon: '📄',
    title: 'Importe o PDF do treinador',
    body: 'Em Planos, toque em "Importar PDF do treinador" e escolha o arquivo que você recebeu. O app lê o PDF aqui no celular, sem enviar nada para lugar nenhum, e mostra o que entendeu para você conferir antes de salvar.',
    tip: 'Na conferência dá para corrigir nome, técnica, séries e descanso, e mover exercícios de um treino para outro.',
  },
  {
    icon: '📋',
    title: 'Ou monte o plano à mão',
    body: 'Também é possível criar do zero: um plano fixo (Treino A, B, C… que se repetem) ou periodizado (Semana 01 a 06, com um treino por dia).',
    tip: 'No plano periodizado, monte a Semana 01 e use "Copiar semana" — depois é só ajustar o que mudou.',
  },
  {
    icon: '🔗',
    title: 'Bi-set: dois exercícios juntos',
    body: 'Ao criar ou editar um exercício, preencha "Grupo de bi-set" com a mesma letra nos dois que devem ser feitos em sequência (ex: A nos dois). Na execução eles aparecem juntos, alternando uma série de cada.',
    tip: 'Fez os dois separados dessa vez? Na execução, ao lado de "Em bi-set" tem o botão "Separado" — muda a qualquer momento, sem editar o plano.',
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
    tip: 'Precisa de uma série além do previsto? Use "+ série extra" no fim do exercício. E se deixar a carga em branco ao confirmar, o app usa a última que você registrou NESSA sessão, em vez de gravar vazio.',
  },
  {
    icon: '⏱️',
    title: 'O descanso começa sozinho',
    body: 'Ao concluir uma série, o cronômetro dispara com o intervalo do plano e avisa com som e vibração no fim. Dá para somar 30s ou pular.',
    tip: 'Quando o plano define o descanso só em texto (ex: "um lado após o outro"), não há cronômetro — a instrução aparece escrita na série.',
  },
  {
    icon: '➡️',
    title: 'O treino avança e encerra sozinho',
    body: 'Ao concluir a última série de um exercício, o próximo card já abre sozinho — não precisa tocar para avançar. E quando o último exercício pendente é concluído, o treino encerra automaticamente e a tela de foto aparece, sem precisar tocar em "Encerrar".',
    tip: 'Esqueceu a foto na hora de encerrar? Dá para acrescentar depois, no Histórico, abrindo o card daquele dia.',
  },
  {
    icon: '📈',
    title: 'Acompanhe sua evolução',
    body: 'Na aba "Exercícios" do Histórico, cada movimento tem um gráfico de carga ao longo do tempo, o 1RM estimado e o selo 🏆 de recorde pessoal. Se as últimas 3 séries baterem o topo da faixa prescrita, o app sugere subir a carga na próxima.',
    tip: 'Treinou toda semana sem furo? A partir da segunda semana seguida, a home mostra "🔥 N semanas seguidas treinando".',
  },
  {
    icon: '💾',
    title: 'Faça backup de vez em quando',
    body: 'Os dados ficam apenas neste celular, sem servidor. Em Mais → Backup você exporta um arquivo de backup — é o que permite trocar de aparelho ou recuperar tudo se limpar os dados do navegador.',
    tip: 'O backup não inclui fotos (de treino nem de perfil) — são blobs binários grandes, ficam só no aparelho.',
  },
]
