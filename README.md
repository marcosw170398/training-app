# Treino — PWA de treino multi-perfil

App de treino instalável, offline-first, sem backend. Todos os dados ficam no
IndexedDB do próprio navegador (via Dexie), sempre associados a um `profileId`.

```bash
npm run dev
```

```bash
npm run build
```

## Como está organizado

```
src/
  app/          bootstrap, rotas, guards (RequireProfile), layout
  db/           schema, instância Dexie e repositories
    repositories/   ÚNICO ponto de acesso ao banco
  features/     profiles, home, plans (editor), session (execução), history, backup, settings
  components/ui primitivos (Button, Sheet, Card, NumberStepper…)
  hooks/        useRestTimer, useWakeLock
  lib/          id, date, weekday, exerciseKey, rest, alarm, text
```

Nenhum componente importa `db` direto: tudo passa pelos repositories, e toda
função recebe `profileId` explícito. É isso que impede dado de um perfil vazar
para a tela do outro.

## Decisões que não são óbvias no código

**`null` não é indexável no IndexedDB.** Um registro com `weekNumber: null`
some de um índice sobre `weekNumber`, e um índice composto
`[planId+weekNumber+order]` ignora a linha inteira se qualquer parte for nula.
Por isso plano fixo usa `weekNumber: 0` (`NO_WEEK`) e sessão aberta usa
`finishedAt: 0` (`IN_PROGRESS`) — nunca `null`. O ganho: a **mesma query** lista
treinos de plano fixo e de plano periodizado.

**`exerciseKey` é o que liga a progressão.** No plano periodizado, "Supino
máquina" da Semana 01 e o da Semana 04 são linhas `Exercise` diferentes. Buscar
a última carga por `exerciseId` devolveria vazio toda semana. A busca é pelo
slug normalizado do nome, no índice
`[profileId+exerciseKey+section+seriesNumber+performedAt]`.

**Três seções, e só uma alimenta a evolução.**
`warmup` (preparação geral) não gera `SetLog` nenhum; `rampup` (aproximação)
gera registro mas fica fora dos gráficos; `main` é a série valendo.

**`SetLog` guarda snapshots** (`exerciseName`, `targetText`, `section`): renomear
ou apagar um exercício não corrompe o histórico já registrado.

**O cronômetro guarda o instante de término, não um contador.** Android e iOS
estrangulam `setInterval` com a tela apagada; um contador decrementado atrasaria
minutos ao longo do treino.

**Versionamento Dexie:** só o esquema de *índices* é versionado. Acrescentar um
campo não indexado depois não exige `version(2)`.

## Backup e importação

`Mais → Backup` exporta um JSON por perfil ou de todos. A importação aceita tanto
esse export quanto um plano escrito à mão no formato do `exemplo-planos.json`
(`trainingPlans`/`trainingPlanId`, `weekday: "segunda"`, `weekNumber: null`,
`section: "aquecimento" | "principal"`). Todos os ids são remapeados para UUIDs
novos, então reimportar nunca sobrescreve o que já existe.

É esse mesmo caminho que a importação de PDF vai usar no futuro: o parser produz
esse JSON e reaproveita a escrita inteira.
