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
  features/
    profiles/   seleção, criação e remoção de perfil
    onboarding/ tutorial de primeiro acesso (uma vez por perfil)
    home/       treino do dia (fixo vs periodizado)
    plans/      editor de plano, treino, exercício e séries
    session/    execução, cronômetro de descanso, bi-set
    history/    sessões passadas
    import/     leitura de PDF, OCR, parsers e tela de conferência
    backup/     export e import de arquivo
    settings/   preferências e atalhos
  components/ui primitivos (Button, Sheet, Card, NumberStepper…)
  hooks/        useRestTimer, useWakeLock
  lib/          id, date, weekday, exerciseKey, rest, alarm, text
public/
  tesseract/    motor de OCR auto-hospedado (ver seção abaixo)
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

## Importação de PDF

O plano chega como PDF do treinador e o app faz todo o resto. `/importar` é uma
rota **lazy**: o pdf.js e o OCR pesam mais que o app inteiro, e quem nunca
importa um PDF não deve pagar por eles (bundle principal 530 kB, chunk de
importação 470 kB).

O fluxo tem um formato intermediário no meio, `PositionedText` — texto com
posição, tamanho e confiança. Camada de texto e OCR desembocam nele, e nada
abaixo desse ponto sabe de qual origem o dado veio. É o que evita manter dois
parsers em sincronia.

```
PDF ─┬─ camada de texto (pdf.js)  ─┐
     └─ imagem → OCR (tesseract)  ─┴─→ PositionedText ─→ parser ─→ conferência ─→ Dexie
```

**A decisão de usar OCR é do documento, não da página.** Basta uma página com
conteúdo textual para o arquivo inteiro ser tratado como digital. Por página, a
capa e a folha de instruções — que têm pouco texto mas não são digitalizadas —
iriam para o OCR, gastando um minuto cada e rotulando um plano perfeitamente
legível como "lido por OCR".

**Dois parsers, um por layout.** `parsePlan.ts` lê o formato em tabela
(reconstrói colunas pelas coordenadas X/Y, derivando as colunas do cabeçalho de
cada tabela para aguentar 2, 3 ou 4 colunas de série). `parseCardPlan.ts` lê o
formato em cartões, ancorado nas linhas `Intervalo:`. A tabela é tentada
primeiro; se não reconhecer nada, cai no parser de cartões.

**Nada é gravado sem conferência.** A tela de revisão permite corrigir nome,
seção, técnica, séries e descanso, mover exercícios entre treinos e remover o
que não presta. Exercício identificado mas sem série legível entra vazio e
marcado, em vez de sumir em silêncio.

## OCR (`public/tesseract/`)

Alguns planos chegam digitalizados: páginas que são imagem, sem texto nenhum.
Para esses, o app roda OCR no próprio navegador com o
[tesseract.js](https://github.com/naptha/tesseract.js).

### Por que auto-hospedado

O tesseract.js baixa motor e idioma de CDN por padrão. Isso quebraria o OCR
offline, que é o ponto de um PWA de academia — muitas academias têm sinal ruim.
Então os três arquivos são servidos pelo próprio app:

| Arquivo | Tamanho | O que é |
|---|---|---|
| `worker.min.js` | 109 KB | worker do tesseract.js |
| `tesseract-core-simd-lstm.wasm.js` | 3,8 MB | motor LSTM com SIMD |
| `por.traineddata.gz` | 986 KB | dados do idioma português |

Os caminhos ficam em `src/features/import/ocr.ts` (`TESSERACT_PATHS`).

### Fora do precache, cacheado em runtime

Esses ~4,9 MB **não** entram no precache do service worker
(`globIgnores: ['**/tesseract/**']` em `vite.config.ts`). Quem só usa PDF com
camada de texto nunca baixa esse peso. Uma regra `CacheFirst` em
`runtimeCaching` guarda os arquivos na primeira importação de um PDF
digitalizado, e a partir daí o OCR funciona offline.

O motor é encerrado (`terminateOcr`) ao fim da importação: são ~5 MB de memória
que não faz sentido segurar.

### Parâmetros escolhidos por medição, não por intuição

Medido nos PDFs digitalizados do plano:

| Configuração | Confiança média |
|---|---|
| 1700 px, sem tratamento | **40%** ← escolhido |
| 2480 px (resolução nativa do scan) | 34% |
| 2480 px binarizado | 40–42%, **mas corrompe dígitos** |

Subir a resolução só dá mais textura de fundo para o tesseract confundir com
letra. E a binarização aumentava a contagem de palavras "boas" enquanto
transformava `(1x15a20)` em `(1x15320)` — em plano de treino, número errado é
pior que palavra perdida. Por isso o padrão é o mais simples e
`threshold: 0` (binarização desligada).

### Segmentação pela cor, não pelo texto

O layout do plano pinta o nome do exercício em dourado
(`rgb(155..205, 121..161, 39..49)`). O app detecta essas faixas **nos pixels** da
página renderizada, e cada faixa marca a fronteira exata de um cartão de
exercício. Cor não se corrompe quando o OCR erra letra — e sem isso, uma linha
de série perdida fazia todas as seguintes escorregarem para o exercício vizinho.

O teste de `g - b` alto é o que separa o dourado do vermelho do rodapé
(`rgb(255,51,51)`), que passaria por qualquer teste baseado só em `r - b`.

### Reparos de leitura

Corrigidos em `parseSeriesToken.ts`, todos derivados de erros observados:

| Lido | Interpretado | Regra |
|---|---|---|
| `(Ix6alo+2 drop)` | `1x 6-10 + 2 drop` | `I`/`l`/`O` → dígito, só na parte numérica |
| `(1x10315)` | `1x 10-15` | o "a" virou dígito; divisão aceita apenas se os dois lados forem repetições plausíveis e crescentes |
| `(2xX15320)` | `2x 15-20` | separador duplicado |
| `(1x100)` | `1x 100` | **não** é reinterpretado como faixa |

`exerciseDictionary.ts` encaixa o nome lido no vocabulário do plano
(`Pulleyfrente supinado` → `Pulley frente supinado`), comparando por Levenshtein
também na forma sem espaços, porque o OCR gruda palavras. O limiar é alto (0,68)
de propósito: nome torto o usuário percebe na conferência, nome errado passa
despercebido.

### Limites conhecidos

PDF com camada de texto é lido com precisão; digitalizado é **rascunho para
revisar**. Referência medida:

| | PDF de texto | PDF digitalizado |
|---|---|---|
| Tempo | ~0,5 s (14 páginas) | ~18 s (12 páginas) |
| Confiança | exata | ~49% média |
| Resultado | 24 treinos, 269 exercícios, 666 séries | 35 exercícios, 114 séries |
| Precisão | fiel | 5/5 contra transcrição manual de uma página |

Nos digitalizados alguns exercícios saem sem séries porque o OCR perdeu a linha
inteira. Eles aparecem vazios e marcados na conferência.

### Atualizar o idioma

```bash
curl -o public/tesseract/por.traineddata.gz https://tessdata.projectnaptha.com/4.0.0_fast/por.traineddata.gz
```

Para acrescentar outro idioma, baixe o `.traineddata.gz` correspondente na mesma
URL e passe o código ao `createWorker` em `ocr.ts`.

O motor e o worker vêm do `node_modules` e são copiados na mão quando a
dependência sobe de versão:

```bash
cp node_modules/tesseract.js/dist/worker.min.js public/tesseract/
```

```bash
cp node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js public/tesseract/
```

## Backup

`Mais → Backup` exporta um arquivo por perfil ou de todos. A importação aceita
tanto esse export quanto um plano escrito à mão no formato do
`exemplo-planos.json` (`trainingPlans`/`trainingPlanId`, `weekday: "segunda"`,
`weekNumber: null`, `section: "aquecimento" | "principal"`). Todos os ids são
remapeados para UUIDs novos, então reimportar nunca sobrescreve o que já existe.
