# Estado do projeto

> Atualizado em 03/08/2026, ao final da sessão que fechou v0.8.0. Editar este
> arquivo sempre que uma tarefa terminar — é o primeiro arquivo a ler numa
> sessão nova.

## Arquitetura

PWA de treino multi-perfil, offline-first, **sem backend**. Tudo vive no
IndexedDB do navegador via Dexie; nenhum dado sai do aparelho.

- **Stack**: React 19 + Vite 8 + TypeScript + Tailwind v4 + Dexie 4 +
  react-router 8 + vite-plugin-pwa.
- **Import de PDF**: pdf.js (camada de texto) + tesseract.js (OCR
  auto-hospedado, para PDF digitalizado) — dois parsers (`parsePlan.ts` para
  tabela, `parseCardPlan.ts` para cartões), tudo em `src/features/import/`.
  Detalhe completo em `README.md`.
- **Banco**: `src/db/schema.ts` (tipos) + `src/db/db.ts` (Dexie, versão
  **2**). Tabelas: `profiles`, `profileState`, `plans`, `workouts`,
  `exercises`, `seriesTargets`, `sessions`, `setLogs`, `sessionPhotos`.
- **Rotas** (`src/app/routes.tsx`): `/home`, `/planos`, `/historico`,
  `/mais` (nav inferior); `/importar` (lazy — pdf.js/OCR não pesam no bundle
  principal); `/historico/ex/:exerciseKey`; `/planos/:planId`;
  `/planos/:planId/t/:workoutId`; `/treinar/:workoutId`; `/sessao/:sessionId`.
- **Design**: direção "Ferro & Cronômetro" — paleta grafite/ember, Space
  Grotesk (títulos) + JetBrains Mono (todo número), modo claro/escuro via
  `data-theme` + `prefers-color-scheme` (`src/state/theme.ts`).

## Funcionalidades prontas

Por versão — detalhe de cada uma em `CHANGELOG.md`:

- **v0.1.0**: multi-perfil, plano fixo/periodizado, importação de PDF (texto
  e OCR), execução com cronômetro, histórico, backup JSON, tutorial.
- **v0.2.0**: calendário de treinos com foto do dia, resumo do treino por
  exercício (não por série), exportar plano para outra pessoa importar,
  repetições pré-preenchidas pelo topo da faixa, "concluir todas as séries".
- **v0.3.0**: direção visual completa + modo claro.
- **v0.4.0**: gráfico de evolução por exercício, recorde pessoal (PR),
  notas de sessão, editar série já registrada sem apagar.
- **v0.5.0**: card de exercício abre sozinho (o próximo ao concluir o atual;
  ao retomar sessão, o primeiro incompleto — não sempre o primeiro da
  lista); carga vazia herda a última usada na sessão; treino encerra sozinho
  ao concluir o último exercício; foto pode ser acrescentada a treino já
  encerrado, pelo histórico.
- **v0.6.0**: foto de perfil (opcional, substitui a inicial no `Avatar` em
  toda a UI — reduzida no navegador com o mesmo utilitário da foto de
  treino, `reduzirImagem`; campo `photoBlob` não indexado em `Profile`, sem
  subir versão do Dexie); 1RM estimado (Epley) no histórico do exercício;
  sugestão de progressão de carga na execução, quando as últimas 3 séries
  bateram o topo da faixa prescrita; sequência de semanas seguidas
  treinando, exibida na home a partir de 2 semanas.
- **v0.7.0**: abrir um treino só mostra os exercícios (`WorkoutPreviewScreen`
  em `/treinar/:id`) — só inicia com clique explícito em "Iniciar treino",
  com confirmação se outro treino já estiver em andamento; sessão esquecida
  encerra sozinha (2h ociosa ou 4h de duração, checado em
  `reapStaleSession`); Histórico ganhou "Editar" (reabre a sessão) e
  "Excluir" por treino; tutorial ganhou passo de bi-set.
- **v0.8.0**: autoria Marcosoft — rodapé em "Mais" (`Treino v0.7.0 · feito
  pela Marcosoft`), selo no fim do tutorial ("um app Marcosoft"), e a marca
  (`public/marcosoft-mark.png`, traço preto sobre transparente) na tela de
  carregamento (`Splash.tsx`), invertida para branco no tema escuro via
  `.marcosoft-mark` em `index.css` — mesma cascata de `[data-theme]` /
  `prefers-color-scheme` dos tokens de cor.

## Em desenvolvimento

Nada em andamento no código — v0.7.0 e v0.8.0 estão commitadas
**localmente**, ainda não publicadas no GitHub nem em produção (deploy
pendente, aguardando confirmação do usuário).

## Problemas conhecidos

- **OCR em PDF digitalizado é rascunho, não importação fiel.** Nos PDFs de
  teste, ~10 de 35 exercícios ficam sem série (OCR perdeu a linha) — o app
  marca isso na conferência, não esconde. PDF com camada de texto é fiel.
- **Backup JSON não inclui fotos** (foto de treino nem foto de perfil — blob
  binário, decisão explícita do usuário — não é lacuna, é escolha).
- **Vercel Deployment Protection está desligada de propósito** — necessário
  para o service worker instalar. App é público, mas sem login nem dado no
  servidor; quem abrir o link só vê o app vazio.

## Próximo passo

Nenhuma tarefa pendente definida pelo usuário. Ver `TODO.md` para backlog
não priorizado (inclui o gerador de treino por questionário, explicitamente
adiado, não descartado). Peso corporal (body weight tracking) foi cogitado e
deliberadamente deixado de fora desta rodada — é o único item da lista de
sugestões que exigiria tabela e tela novas.
