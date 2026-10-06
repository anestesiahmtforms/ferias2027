# FÉRIAS-2027 — fase atual, fase 2 e convites pelo WhatsApp

**Status:** aprovada, implementada e verificada. Backend implantado na versão 10 em 2026-10-06; publicação do PWA autorizada pelo responsável pelo workflow GitHub Pages.

Esta especificação substitui as regras conflitantes da especificação-base `docs/specs/2026-10-04-pwa-ferias-2027.md` sobre cotas e notificações. O app prepara e abre a conversa com texto e link; a pessoa usuária revisa e envia a mensagem no WhatsApp.

## Regras da fase em andamento

- A fila usa a sequência já definida: CR, AD, LH, FR, DE, LE, RO, AA, MA, RA, LU, LC, FL, L2, RL, MH, RC, LD, DN, WE, BA, GU, JA, IG, AL, GB.
- Nesta fase, BA, FR, GB, L2, LD, LC, LU, MA, RA, RC, RO, WE, DN e AL — o grupo que já marcou janeiro ou julho — podem registrar uma semana adicional. As demais siglas podem registrar duas semanas.
- A contagem considera somente as escolhas desta rodada; as escolhas antigas de janeiro e julho não consomem a cota atual.
- A próxima sigla da fila é liberada depois que a sigla atual completa sua cota desta fase.
- CH, PR, LA, LO e RU ficam fora da fila de convites. Não recebem convite automático e não impedem o avanço da fila.

## Transição e regras da fase 2

- A fase 2 começa imediatamente quando a última vaga permitida da coluna SIGLA 1 for preenchida. Janeiro e julho continuam excluídos de novas escolhas nesta rodada.
- A mudança de fase vale imediatamente para qualquer reserva feita depois desse preenchimento, inclusive eventual semana ainda pendente da sigla que preencheu a última vaga SIGLA 1.
- Na fase 2, todas as siglas, incluindo as que já marcaram janeiro ou julho, podem escolher duas semanas nesta fase.
- A fase 2 começa pela próxima sigla da sequência definida após o fechamento de todas as vagas SIGLA 1, sem reiniciar a ordem.
- SIGLA 2 só pode ser preenchida depois de SIGLA 1 na semana. SIGLA 3 pode ser preenchida assim que SIGLA 1 e SIGLA 2 estiverem ocupadas, sem uma espera adicional por posição de coluna.
- SIGLA 2 pode acrescentar coincidências até o total de três dias úteis, considerando o par SIGLA 1 × SIGLA 2.
- SIGLA 3 só fica liberada se o par SIGLA 1 × SIGLA 2 ainda somar menos de três dias úteis. Depois da entrada, o total entre os pares SIGLA 1 × SIGLA 2, SIGLA 1 × SIGLA 3 e SIGLA 2 × SIGLA 3, somado por par, deve permanecer em no máximo três dias úteis. Se SIGLA 1 × SIGLA 2 já atingir três dias, SIGLA 3 fica bloqueada mesmo que sua entrada não acrescente coincidência. O mesmo dia coincidente em dois pares conta duas vezes. As exceções de meio dia previamente definidas continuam aplicáveis a cada par.
- O app informa a quantidade calculada de dias coincidentes à pessoa e à administração quando a combinação ultrapassar o limite.

## Convite de WhatsApp

- O convite é iniciado ao concluir a cota da sigla atual: uma semana nesta fase para o grupo de janeiro/julho, duas para as demais; na fase 2, duas para todas.
- Após uma reserva que conclua a cota, o app abre o WhatsApp com uma conversa preparada para a próxima sigla elegível da fila. A mensagem é: `Olá! Agora voce pode marcar suas férias. Obrigado. Solicite o PIN de acesso ao Coordenador.` seguida do link do app.
- O app não envia a mensagem. A pessoa que está usando o app revisa e toca em enviar no WhatsApp.
- As cinco siglas fora da fila são ignoradas ao procurar o próximo destinatário.
- Usar os contatos fornecidos pelo usuário, preservando a correção confirmada para GB. Por autorização expressa do usuário, os números necessários à fila serão incluídos na configuração pública do PWA; CH, PR, LA, LO e RU não precisam constar nela porque não recebem convites.
- A aplicação valida a reserva no servidor e só prepara convite depois de confirmar que a reserva foi gravada e que a cota foi completada.

## Pontos a preservar

- Não alterar, exibir nem regenerar PINs.
- Não substituir nem apagar reservas preexistentes.
- A configuração de fase, cota, sequência e coincidência deve ser verificada no backend do Apps Script; a interface não é a autoridade de validação.
- Publicação do PWA no GitHub Pages e implantação do Apps Script são etapas separadas.
