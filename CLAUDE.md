# Regras de trabalho neste projeto

Este arquivo é lido automaticamente no início de toda sessão. Os outros três
(`PROJECT_STATE.md`, `DECISIONS.md`, `TODO.md`) não são — leia-os explicitamente
antes de começar qualquer tarefa. Mantê-los pequenos e atualizados é o que evita
reabrir o histórico completo da conversa a cada sessão nova.

## Fluxo por sessão

1. Leia `PROJECT_STATE.md` (estado atual) e `TODO.md` (pendências) antes de
   escrever qualquer código.
2. Implemente a tarefa.
3. Verifique de verdade: `npx tsc -b`, `npm run lint`, e para mudança visível
   na UI, abra no navegador e confirme — não reporte "pronto" sem checar.
4. Atualize `PROJECT_STATE.md` (o que mudou) e, se a mudança envolveu uma
   escolha não óbvia, acrescente uma entrada em `DECISIONS.md`.
5. Se a sessão for de features grandes, acrescente uma entrada nova no topo do
   `CHANGELOG.md` (histórico de versão, visível ao usuário) — é diferente de
   `PROJECT_STATE.md` (estado interno, para retomar contexto).

## Regras específicas deste projeto

- **Nenhum componente importa `db` direto.** Tudo passa por
  `src/db/repositories/*`, e toda função de repositório recebe `profileId`
  explícito. Isso é o que impede dado de um perfil vazar para o outro.
- **`null` não é indexável no IndexedDB.** Campo que precisa ir em índice usa
  sentinela numérica (`NO_WEEK`, `NO_WEEKDAY`, `IN_PROGRESS`, todos `= 0`), nunca
  `null`. Ver `DECISIONS.md`.
- **Nunca `trim()` dentro de `onChange`.** Apaga o espaço que o usuário acabou
  de digitar a cada tecla — a limpeza acontece só no `onBlur` ou na gravação
  final. Já causou bug real (veja histórico do commit
  `75c7805`).
- **Commit no `onBlur`, não a cada tecla**, em qualquer campo ligado a
  `useLiveQuery`. Gravar por tecla recarrega a query e joga o cursor para o
  fim do campo.
- **PDF é lido inteiramente no navegador** (pdf.js + tesseract.js
  auto-hospedado) — nunca enviar arquivo do usuário para servidor nenhum.
- Ao mexer no schema do Dexie (`src/db/schema.ts` + `src/db/db.ts`), só o
  *esquema de índices* precisa de `version()` nova. Campo novo não indexado
  não exige subir a versão.
- Estilo: paleta e tipografia em `src/index.css` (tokens `--color-*`,
  `--font-*`). Não usar cor "crua" fora dos tokens; não usar fonte fora de
  `font-display`/`font-mono`/padrão do corpo.

## Deploy

```bash
npx tsc -b && npm run lint && npm run build   # sempre antes de publicar
git add -A && git commit -m "..." && git push origin main
vercel deploy --prod --yes
```

Repositório: `github.com/marcosw170398/training-app` (público — ver
`DECISIONS.md` #9). Produção:
`treino-app-marcosw170398s-projects.vercel.app`.

## O que NÃO duplicar aqui

- `README.md` — arquitetura e rationale técnico completo (import de PDF, OCR,
  decisões de schema). Fonte da verdade para "como" e "por quê" do código.
- `CHANGELOG.md` — histórico de versões voltado ao usuário.

Este `CLAUDE.md` e os três arquivos irmãos são para **retomar contexto entre
sessões**, não para documentar o produto.
