# Decisões arquiteturais

Cada entrada é uma escolha que não era óbvia e que vale não redescutir do
zero numa sessão futura. Motivo sempre incluído — sem ele a decisão vira
regra arbitrária que alguém "corrige" de volta por engano.

---

### 1. Sentinela numérica em vez de `null` em campo indexado

`weekNumber: 0` (`NO_WEEK`) para plano fixo, `weekday: 0` (`NO_WEEKDAY`) para
"sem dia", `finishedAt: 0` (`IN_PROGRESS`) para sessão aberta — nunca `null`.

**Motivo:** IndexedDB não indexa `null`. Um índice composto como
`[planId+weekNumber+order]` ignora a linha inteira se qualquer parte for
nula. Com sentinela numérica, a MESMA query lista treino de plano fixo e
periodizado.

---

### 2. `exerciseKey` (slug do nome), não `exerciseId`, liga a evolução

Todo histórico de carga (`SetLog`, gráfico, recorde) busca por
`exerciseKey`, não pelo `id` da linha `Exercise`.

**Motivo:** No plano periodizado, "Supino máquina" da Semana 01 e da Semana
04 são linhas `Exercise` diferentes (pertencem a `Workout`s diferentes).
Buscar por `id` devolveria vazio toda semana; buscar por `exerciseKey`
atravessa semanas e planos.

---

### 3. Três seções, só `main` alimenta gráfico/recorde

`warmup` (preparação) não gera `SetLog`; `rampup` (aproximação) gera mas
fica fora do histórico de evolução; `main` é o que conta para gráfico e PR.

**Motivo:** pedido do usuário — aquecimento não deve "sujar" a curva de
carga real.

---

### 4. `SetLog` guarda snapshot (`exerciseName`, `targetText`, `section`)

**Motivo:** renomear ou apagar um `Exercise` não pode corromper histórico já
gravado. O log é imutável por construção.

---

### 5. Cronômetro guarda o instante de término, não decrementa um contador

`useRestTimer` calcula `remaining` a partir de `endsAt` (timestamp absoluto)
a cada tick, nunca `remaining -= 1`.

**Motivo:** Android e iOS estrangulam `setInterval` com a tela apagada; um
contador decrementado atrasaria minutos ao longo do treino. Timestamp
absoluto corrige sozinho ao voltar de segundo plano.

---

### 6. `trim()` nunca dentro de `onChange`

Limpeza de string acontece no `onBlur` ou só na gravação final.

**Motivo:** aplicar `trim()` a cada tecla apaga o espaço que o usuário
acabou de digitar — a próxima letra cola na palavra anterior. Bug real,
corrigido no commit `75c7805`.

---

### 7. Dois parsers de PDF (tabela vs. cartão), não um genérico

`parsePlan.ts` reconstrói colunas por coordenada X/Y (formato tabela);
`parseCardPlan.ts` ancora na linha `"Intervalo:"` (formato cartão). A tabela
é tentada primeiro; se não reconhecer nada, cai no parser de cartão.

**Motivo:** os dois formatos de PDF reais (fornecidos pelo usuário) têm
estrutura geométrica incompatível — colunas alinhadas vs. blocos soltos. Um
parser só teria que adivinhar qual formato está lendo linha a linha, mais
frágil que dois parsers especializados com fallback.

---

### 8. Segmentação de cartão pela COR do pixel, não pelo texto do OCR

No layout de cartão digitalizado, o início de cada exercício é detectado por
uma faixa dourada nos pixels da página renderizada
(`detectarFaixasDouradas` em `ocr.ts`), não por heurística de texto.

**Motivo:** medido contra transcrição manual do usuário — quando a
segmentação dependia do texto do OCR, uma linha de série perdida fazia as
séries seguintes escorregarem para o exercício vizinho. A cor não se
corrompe quando o OCR erra uma letra.

---

### 9. OCR auto-hospedado (`public/tesseract/`), não CDN

Motor e idioma do tesseract.js são servidos pelo próprio app, fora do
precache do service worker (baixados só na primeira importação de PDF
digitalizado).

**Motivo:** CDN externo quebraria o OCR offline, que é o ponto de um PWA de
academia (sinal costuma ser ruim lá). Fora do precache para quem nunca
importa PDF digitalizado não pagar ~5 MB à toa.

---

### 10. (histórica) Não forçar `npm audit fix --force`

Numa sessão anterior o `npm audit` apontou vulnerabilidades "high", todas em
devDependency (cadeia `vite-plugin-pwa` → `workbox-build`), sem alcançar o
navegador. Decisão na época: não forçar correção, porque `--force` sobe
major do `vite-plugin-pwa` e arriscava quebrar a geração do service worker.

**Estado em 31/07/2026: `npm audit` (com e sem `--omit=dev`) reporta 0
vulnerabilidades** — resolvido por conta própria em instalação posterior de
dependência. Mantida como registro histórico da decisão, não como problema
ativo.

---

### 11. Repositório GitHub público

**Motivo:** nenhum segredo foi commitado (auditado — `.env*` e `.vercel/`
nunca entraram no histórico), e o conteúdo exposto (código + lista de
exercícios de um treinador) não é sensível. Decisão do usuário, não
recomendação técnica unilateral.

---

### 12. Tema: `@theme` (Tailwind v4) + `prefers-color-scheme` + `[data-theme]`

Cores em `src/index.css` como custom properties; escuro é o valor
incondicional do `@theme`, claro entra por `@media (prefers-color-scheme:
light)` (quando sem escolha manual) e por `[data-theme="light"]` (escolha
manual, sempre vence o sistema). Preferência persiste em `localStorage`, não
no perfil — dispositivo compartilhado deve ter a mesma aparência para
qualquer pessoa.

**Motivo:** troca de tema sem re-render de componente (só CSS), e sem flash
da cor errada — um script inline em `index.html` aplica o atributo antes do
primeiro paint.

---

### 13. Override manual de card aberto/fechado: dois conjuntos, não um flip

`SessionScreen.tsx` decide qual bloco de exercício vem aberto por padrão com
`primeiroIncompletoKey` — o primeiro, na ordem do treino, que ainda não
terminou (recalculado a cada render a partir do banco, não fixo). O toque
manual do usuário para abrir/fechar um bloco é guardado em **dois**
`Set<string>` independentes (`forcedOpen`, `forcedClosed`), não em um único
conjunto "trocado" que inverte o padrão atual.

**Motivo:** a primeira versão usava um `toggled: Set<string>` só, que
funcionava quando o padrão era ESTÁTICO (sempre o bloco 0) — "inverte o
padrão" e "força fechado" davam no mesmo resultado, porque o padrão nunca
mudava de bloco. Ao tornar o padrão dinâmico (primeiro INCOMPLETO, que muda
de bloco conforme o treino avança), esse flip quebrou: um bloco marcado
"trocado" no momento em que era o foco (force-close) reabria sozinho assim
que o foco passava para o próximo bloco no render seguinte — porque
`!defaultAberto` inverte contra o QUE FOR o padrão atual, não o padrão de
quando o toggle foi criado. Bug reproduzido no navegador (dois cards abertos
ao mesmo tempo) antes de publicar; corrigido trocando por dois conjuntos que
não referenciam o padrão dinâmico: `forcedClosed` fecha para sempre até o
usuário reabrir manualmente, independente de para onde o foco se mova.

---

### 14. Sequência de semanas: contada para trás a partir da ÚLTIMA semana com
treino, não da semana corrente

`currentWeekStreak` (`sessions.repo.ts`) agrupa sessões pela segunda-feira da
semana (`mondayOfWeek`, `lib/date.ts`) e conta semanas consecutivas para trás
a partir da mais recente que teve pelo menos um treino — não a partir de
"hoje".

**Motivo:** treino é por semana civil, não por dia — pausar num fim de
semana é normal e não deveria zerar a sequência antes mesmo da pessoa ter
tido a chance de treinar de novo. Se a contagem partisse de "hoje", a
sequência cairia para 0 assim que a semana corrente ainda não tivesse
treino, mesmo que a pessoa tenha treinado toda semana até aqui. Exibida na
home só a partir de 2 semanas — 1 semana isolada não é "sequência".

---

### 15. Campo com valor herdado/sugerido seleciona tudo ao focar

Nome de treino novo (sugestão "Treino B", a próxima letra) e os campos de
uma série nova (`addSeries` copia alvo/descanso da série anterior) chegam
com texto já preenchido, não vazio. `WorkoutFormSheet.tsx` (só quando
`!workout`, ou seja, criando) e todo campo de `SeriesRow.tsx` selecionam o
conteúdo inteiro no `onFocus`.

**Motivo:** sem isso, clicar no campo e digitar por cima GRUDA o texto
digitado no que já estava lá em vez de substituir — bug real, reproduzido
duas vezes (nome de treino virou "Treino ATreino A", alvo de série virou
"8-128-12"). O padrão "copiar do anterior para economizar digitação" é
deliberado (ver comentário em `exercises.repo.ts` → `addSeries`); o problema
era só a falta de seleção ao focar. Editar um treino já existente
(`workout` presente em `WorkoutFormSheet`) fica de fora de propósito —
apagar ali é ação deliberada do usuário, não teria o mesmo problema.

---

### 16. Abrir um treino nunca inicia/encerra sessão sozinho

`/treinar/:workoutId` (`WorkoutPreviewScreen.tsx`) só MOSTRA os exercícios.
Sessão só começa com clique explícito em "Iniciar treino"; se houver outro
treino em andamento, pede confirmação antes de encerrá-lo — o mesmo padrão
de "Encerrar treino?" que a execução já usava.

**Motivo:** bug real — a versão anterior (`StartSessionScreen.tsx`, agora
removida) chamava `startOrResumeSession` assim que a rota abria. Tocar num
treino errado por engano, com outro em andamento, encerrava o antigo e
começava um novo sem perguntar nada — irreversível pela UI (a sessão
"perdida" só reaparecia editável de novo depois da funcionalidade #17, que
não existia ainda). Pedido explícito do usuário para nunca mais iniciar ou
encerrar automaticamente por só abrir a tela.

---

### 17. Sessão esquecida: `useLiveQuery` não pode escrever — leitura e reaper separados

`getInProgressSession` (usada dentro de `useLiveQuery` em `HomeScreen` e
`WorkoutPreviewScreen`) faz só LEITURA: se a sessão passou de 2h ociosa
(sem `SetLog` novo) ou 4h de duração total, devolve `undefined` sem gravar
nada. Quem grava de fato o encerramento é `reapStaleSession`, chamada à
parte por um `useEffect` comum (com um `setInterval` de 5 min) em
`RequireProfile.tsx` — fora de qualquer query reativa.

**Motivo:** a primeira versão fazia `db.sessions.update(...)` dentro da
própria função passada pro `useLiveQuery`. Dexie proíbe escrita dentro do
contexto de uma query reativa (`Readwrite transaction in liveQuery
context`) e isso derrubava a `HomeScreen` inteira com uma tela de erro —
reproduzido no navegador simulando uma sessão de 5h. Separar leitura
(segura dentro do liveQuery) de escrita (só fora dele) é a regra geral para
qualquer auto-correção futura que dependa de `getInProgressSession`.

---

### 18. Marca Marcosoft: `filter: invert(1)` em vez de duas imagens

`public/marcosoft-mark.png` é um traço preto sobre transparente, pensado
para fundo claro. Em vez de gerar/manter uma segunda versão em branco para
o tema escuro, a classe `.marcosoft-mark` (`index.css`) aplica
`filter: invert(1)` por padrão e remove o filtro (`filter: none`) sob a
mesma cascata `@media (prefers-color-scheme: light)` /
`[data-theme='light']` que já decide as cores do resto do app.

**Motivo:** preto vira branco, transparente continua transparente — um
`invert(1)` resolve os dois temas com um arquivo só, sem depender de
recriar a arte a cada ajuste. Só funciona porque o traço é uma cor sólida
(preto); uma imagem colorida quebraria com invert simples.
