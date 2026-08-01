# Notas de versão

## v0.6.0 — 01/08/2026

### Foto de perfil

Cada perfil pode ter uma foto, além da cor/inicial de sempre. Ao criar ou
editar um perfil, dá pra escolher uma imagem da galeria (ou tirar uma foto);
ela substitui o círculo de inicial em toda a tela onde o avatar aparece —
seleção de perfil, gerenciar perfis, home e "Mais". "Remover foto" volta
para a inicial. Como a foto de treino, fica só no IndexedDB do aparelho e
não entra no backup JSON (blob binário).

### 1RM estimado

O histórico de cada exercício ganhou um terceiro cartão de estatística, ao
lado de "melhor carga" e "recordes batidos": o 1RM estimado pela fórmula de
Epley (`peso × (1 + reps/30)`), calculado sobre a maior estimativa entre
todas as séries "principal" já registradas naquele movimento. Só confiável
até 12 repetições — séries mais longas não entram na conta.

### Sugestão de progressão de carga

Na execução, uma série pendente mostra "💡 bateu o topo 3x — considere subir
a carga" quando as últimas 3 execuções daquela mesma série já bateram o topo
da faixa prescrita (ex: fez 12 três vezes seguidas numa faixa "8-12"). Só
para séries "principal" com alvo numérico — "até a falha" não tem topo para
comparar.

### Sequência de semanas treinando

A home mostra "🔥 N semanas seguidas treinando" a partir de 2 semanas
consecutivas (segunda a domingo) com pelo menos um treino, contadas para
trás a partir da última semana que teve treino — não da semana corrente, que
zeraria a sequência assim que a pessoa ainda não tivesse treinado nesta
semana.

## v0.5.0 — 31/07/2026

### Execução mais fluida

- **O próximo exercício abre sozinho** assim que o atual é concluído — nunca
  mais precisa tocar para avançar.
- **Retomar um treino em andamento abre no lugar certo**: o exercício logo
  após o último concluído, ou o que ficou pela metade (ex.: 2 de 4 séries) —
  não sempre o primeiro da lista.
- **Carga vazia herda a última usada na sessão**: se uma série for concluída
  sem carga preenchida, usa a da série anterior do mesmo exercício em vez de
  gravar em branco. Só entra quando o campo está vazio — nunca sobrescreve o
  que foi digitado.
- **Treino encerra sozinho** ao concluir o último exercício pendente — vai
  direto para a tela de foto, sem precisar tocar em "Encerrar".

### Foto do treino, também depois de encerrado

O histórico agora permite acrescentar foto a um treino já finalizado, direto
do card expandido do dia — antes só era possível na hora de encerrar.

## v0.4.0 — 31/07/2026

### Evolução por exercício

Nova aba "Exercícios" no Histórico: lista os movimentos já treinados e abre
um gráfico de carga ao longo do tempo para cada um (`/historico/ex/:chave`).
SVG desenhado à mão, sem biblioteca de gráfico — o eixo X é por sessão, não
por data corrida, para meses sem treino não esticarem a linha e esconderem a
tendência recente. O ponto plotado é a maior carga do dia naquele movimento,
não cada série solta — uma pirâmide de 15-20-8-12 não deveria parecer
instável no gráfico.

### Recorde pessoal (PR)

Ao concluir uma série que bate a maior carga já registrada naquele
movimento, o app celebra: um aviso passageiro no topo da tela e um selo 🏆
na série, no histórico e no gráfico. Empate no mesmo peso não conta — só
supera, nunca iguala. Só vale para exercícios "principal"; aproximação e
preparação não entram na comparação, consistente com o resto do app.

### Notas de sessão

Campo "+ Adicionar nota" na execução e no histórico ("senti dor no ombro",
"treino puxado hoje"), editável nos dois lugares. Recolhido por padrão
quando vazio — a maioria dos treinos não tem nota.

### Editar série já registrada

Botão "editar" ao lado de "desfazer" em toda série concluída: corrige um
número digitado errado sem precisar apagar e refazer.

## v0.3.0 — 31/07/2026

### Direção visual "Ferro & Cronômetro"

Passe de identidade visual guiado pela skill `frontend-design`, para sair do
padrão "fundo quase-preto + acento azul genérico" que o app tinha até aqui —
um dos clichês mais comuns de UI gerada por IA.

- **Paleta**: grafite quente (`#141210`) em vez de preto-azulado, acento único
  Ember (`#e8551f`, disco de ferro / fita de aviso) em vez de azul-céu
  genérico. Todo par texto/fundo medido por contraste WCAG antes de entrar
  (7:1 a 16:1 nos principais).
- **Tipografia**: `Space Grotesk` para nomes de treino/exercício e títulos de
  tela; `JetBrains Mono` com algarismos tabulares em **todo número do app** —
  carga, reps, cronômetro, datas — para não pular de largura enquanto o dígito
  muda, e para dar uma "voz" visual só para dado, separada da prosa.
  Auto-hospedadas (Fontsource), sem CDN — consistente com o app funcionar
  offline.
- **Cronômetro de descanso redesenhado**: dígitos grandes em mono, marcação a
  cada 10s na trilha de progresso, como um cronômetro físico de parede de
  academia. É o único elemento com essa ousadia visual — o resto do app segue
  quieto ao redor disso, de propósito.
- **Bordas mais contidas**: cards e botões perderam um degrau de arredondamento
  (`rounded-2xl/3xl` → `rounded-xl` e afins) — menos "app de consumo", mais
  ferramenta.

### Modo claro

Antes o app só existia em escuro. Agora: `Mais → Aparência` alterna entre
Sistema / Claro / Escuro, persistido no aparelho (não no perfil — duas pessoas
no mesmo celular veem a mesma aparência). Sem flash da cor errada na abertura:
um script inline aplica a preferência salva antes do primeiro paint.

As quatro cores de seção/estado (preparação, aproximação, principal, aviso)
foram recalibradas para o claro — os tons vivos do escuro caem para
1,5–2,5:1 de contraste em fundo claro (medido), bem abaixo do mínimo de
leitura; o claro usa versões escurecidas das mesmas cores.

### Ponto de restauração

Tag `backup/pre-redesign-visual`, local e no GitHub, apontando para o estado
imediatamente anterior a este redesign — `git checkout backup/pre-redesign-visual`
reverte por completo se necessário.

## v0.2.0 — 30/07/2026

### Calendário e foto do treino

- **Calendário mensal** no Histórico, com os dias treinados destacados e a
  contagem de dias do mês. Tocar num dia filtra o histórico para ele.
- **Foto do treino**: ao encerrar, o app oferece registrar uma foto (a câmera
  abre direto no celular). Sem foto, o dia continua marcado como treinado.
  A imagem é reduzida para 1280 px antes de gravar — foto de celular tem 3–5 MB
  e aqui não há servidor para onde mandar; na prática cai para ~15 KB.
- Fotos aparecem como miniatura no dia do calendário e em tamanho cheio ao
  abrir o treino no histórico.

### Execução do treino

- **Repetições pré-preenchidas** com o topo da faixa prescrita: "8-12" sugere
  12. Quando o alvo não descreve repetições ("até a falha", "2 antes de
  falhar", "5 minutos"), o campo fica vazio em vez de receber um chute.
- **Concluir todas as séries de uma vez**, por exercício, usando os valores que
  já estavam em cada linha — as edições feitas campo a campo são preservadas.
  Não dispara cronômetro: registrar em lote é lançamento retroativo.
- **Cards recolhíveis**, com o nome do exercício em destaque e o progresso
  ("2/3 séries") visível mesmo fechado. O card recolhe sozinho ao completar.
- **Rótulos acima dos campos** ("Carga (kg)", "Repetições"): dentro do input a
  unidade ficava atrás do número assim que era preenchido.

### Compartilhar plano

- Botão **Compartilhar** em cada plano, que exporta só a prescrição — sem
  perfil e sem histórico de cargas. A outra pessoa importa em Mais → Importar
  e recebe o plano no perfil dela, com ids novos.

## v0.1.0 — 29/07/2026

Primeira versão publicada. PWA de treino multi-perfil, offline-first, sem
backend: todos os dados ficam no IndexedDB do próprio navegador.

### Importação de PDF

O plano chega como PDF do treinador e o app faz o resto — não existe passo
manual de conversão.

- **PDF com camada de texto**: importação fiel. O `Treino novo.pdf` de 14
  páginas foi lido em 0,5 s, produzindo 4 semanas, 24 treinos, 269 exercícios e
  666 séries, sem erro de estrutura.
- **PDF digitalizado**: OCR embutido (tesseract.js auto-hospedado, funciona
  offline). No plano "Além da Genética": 35 exercícios e 115 séries.
- **Dois layouts reconhecidos**: tabela com colunas por série, e cartões
  ancorados na linha "Intervalo:".
- **Segmentação por cor**: nos PDFs digitalizados, o nome do exercício é
  detectado pela faixa dourada nos pixels, não pelo texto. Cor não se corrompe
  quando o OCR erra letra, e é isso que impede as séries de escorregarem para o
  exercício vizinho.
- **Dicionário de exercícios**: o nome lido é encaixado no vocabulário do plano
  ("Pulleyfrente supinado" → "Pulley frente supinado"). Limiar alto de
  propósito — nome torto o usuário percebe na conferência, nome errado passa.
- **Reparos de OCR medidos**: `I`/`l`/`O` dentro da parte numérica, faixa colada
  quando o "a" vira dígito (`10315` → `10-15`), separador duplicado
  (`2xX15320` → 2 séries de 15-20), e token que quebra de linha.
- **Nada é gravado sem conferência.** A tela de revisão permite corrigir nome,
  seção, técnica, séries e descanso, mover exercícios entre treinos e remover o
  que não presta. Exercício identificado mas sem série legível entra vazio e
  marcado, em vez de sumir em silêncio.

Precisão medida contra transcrição manual de uma página: nome, séries e
descanso 5/5.

### Execução do treino

- Cronômetro de descanso que dispara ao concluir a série, com som e vibração.
  Guarda o instante de término em vez de decrementar um contador, porque Android
  e iOS estrangulam `setInterval` com a tela apagada.
- Carga pré-preenchida com a última usada naquele exercício e série — inclusive
  de semanas anteriores do ciclo.
- Preparação separada dos exercícios principais, sem registrar carga, para não
  sujar o histórico de evolução.
- Bi-set agrupado, com opção de marcar que foi executado separado.
- Séries extras além do prescrito.
- Tela mantida acesa durante o treino.

### Plano e perfis

- Dois formatos no mesmo schema: fixo (Treino A/B/C) e periodizado (semanas
  numeradas).
- Alvo de série em texto livre ("8-12", "até a falha", "100 reps", "2 antes de
  falhar").
- Descanso numérico e/ou nota em texto ("um lado após o outro").
- Três seções: preparação, aproximação e principal — só a principal alimenta a
  evolução.
- Multi-perfil sem senha, com dados isolados por perfil.
- Editor de plano com duplicar treino e copiar semana.
- Histórico por sessão.
- Export e import de backup.

### Onboarding

- Tutorial de primeiro acesso, mostrado uma vez por perfil — o celular é
  compartilhado, então a segunda pessoa precisa ver a introdução dela.
  Revisitável em Mais → Ajuda.
