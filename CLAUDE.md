# Regras de trabalho neste projeto

Este arquivo é lido automaticamente no início de toda sessão. Os outros três
(`PROJECT_STATE.md`, `DECISIONS.md`, `TODO.md`) não são — leia-os explicitamente
antes de começar qualquer tarefa. Mantê-los pequenos e atualizados é o que evita
reabrir o histórico completo da conversa a cada sessão nova.

## Ao começar uma tarefa nova

1. Leia `CLAUDE.md` (este arquivo), `PROJECT_STATE.md` e `TODO.md`.
2. Use **somente** essas informações como contexto do projeto. Não presuma
   nada sobre conversas anteriores que não esteja registrado nesses arquivos
   — se não está escrito lá, trate como não sabido.
3. Implemente a tarefa, verificando de verdade antes de dizer "pronto":
   `npx tsc -b`, `npm run lint`, e para mudança visível na UI, abrir no
   navegador e confirmar.

## Ao terminar uma tarefa

1. Atualize `PROJECT_STATE.md` para refletir o **estado final atual** —
   remova o que ficou obsoleto. Não descreva o processo ("tentei X, depois Y,
   corrigi Z"); descreva só como as coisas são agora. Processo/histórico é
   assunto do `git log` e do `CHANGELOG.md`, não deste arquivo.
2. Atualize `TODO.md` (marque concluído, remova, ou acrescente o que surgiu).
3. Se a tarefa envolveu uma decisão arquitetural não óbvia, registre em
   `DECISIONS.md` com o motivo.
4. Se a sessão foi de feature grande visível ao usuário, acrescente uma
   entrada no topo do `CHANGELOG.md`.

## Se a conversa ficar muito grande

Sugira ao usuário abrir um chat novo. Na sessão nova, leia os quatro:
`CLAUDE.md`, `PROJECT_STATE.md`, `TODO.md`, `DECISIONS.md` — o quarto entra
aqui porque decisão arquitetural importa para retomar um projeto grande,
mesmo não sendo necessário para toda tarefa pequena do dia a dia.

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
