# Notas de versão

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
