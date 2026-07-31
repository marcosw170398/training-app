# Estado do projeto

> Atualizado em 31/07/2026, ao final da sessão que fechou v0.4.0. Editar este
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

## Em desenvolvimento

Nada em andamento no momento — v0.4.0 está publicada em produção.

## Problemas conhecidos

- **OCR em PDF digitalizado é rascunho, não importação fiel.** Nos PDFs de
  teste, ~10 de 35 exercícios ficam sem série (OCR perdeu a linha) — o app
  marca isso na conferência, não esconde. PDF com camada de texto é fiel.
- **Backup JSON não inclui fotos** (blob binário, decisão explícita do
  usuário — não é lacuna, é escolha).
- **Vercel Deployment Protection está desligada de propósito** — necessário
  para o service worker instalar. App é público, mas sem login nem dado no
  servidor; quem abrir o link só vê o app vazio.
- Alguns itens de lista clicáveis (`Card` com `onClick`) não têm
  `aria-label` explícito — apoiam-se no texto visível interno. Padrão
  pré-existente, não regressão introduzida recentemente.

## Próximo passo

Nenhuma tarefa pendente definida pelo usuário. Ver `TODO.md` para backlog
não priorizado (inclui o gerador de treino por questionário, explicitamente
adiado, não descartado).
