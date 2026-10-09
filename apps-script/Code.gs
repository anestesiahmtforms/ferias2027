/**
 * Serviço da Escala de férias 2027.
 * Este arquivo é executado como Web App do Apps Script, nunca pelo navegador.
 */
const CONFIG = {
  sheetName: 'FERIAS 2027',
  rulesName: 'REGRAS',
  auditName: 'AUDITORIA_PWA',
  blockedMonths: ['janeiro', 'julho'],
  maxWeeks: 2,
  singleWeekSiglas: ['BA', 'FR', 'GB', 'L2', 'LD', 'LC', 'LU', 'MA', 'RA', 'RC', 'RO', 'WE', 'DN', 'AL'],
  bookingSequence: ['CR', 'AD', 'LH', 'FR', 'DE', 'LE', 'RO', 'AA', 'MA', 'RA', 'LU', 'LC', 'FL', 'L2', 'RL', 'MH', 'RC', 'LD', 'DN', 'WE', 'BA', 'GU', 'JA', 'IG', 'AL', 'GB'],
  phase2SequenceStartProperty: 'PHASE2_SEQUENCE_START_SIGLA',
  maxOverlapDays: 3,
  halfDayOverlapPairsByWeekday: [
    [['CH', 'FL']],
    [['RO', 'AA']],
    [['DE', 'BA'], ['LC', 'GU']],
    [['RO', 'AA']],
    [['L2', 'BA'], ['GB', 'AA']]
  ],
  rows: {
    janeiro: [5, 6, 7, 8], fevereiro: [5, 6, 7, 8], marco: [13, 14, 15, 16, 17], abril: [13, 14, 15, 16],
    maio: [22, 23, 24, 25], junho: [22, 23, 24, 25, 26], julho: [31, 32, 33, 34], agosto: [31, 32, 33, 34, 35],
    setembro: [39, 40, 41, 42, 43], outubro: [39, 40, 41, 42], novembro: [48, 49, 50, 51], dezembro: [48, 49, 50, 51, 52]
  },
  columns: {
    janeiro: [3, 4, 5], fevereiro: [9, 10, 11], marco: [3, 4, 5], abril: [9, 10, 11],
    maio: [3, 4, 5], junho: [9, 10, 11], julho: [3, 4, 5], agosto: [9, 10, 11],
    setembro: [3, 4, 5], outubro: [9, 10, 11], novembro: [3, 4, 5], dezembro: [9, 10, 11]
  }
};

function doGet() {
  const sheet = planilha_();
  return resposta_({ ok: true, codigo: 'OK', escala: carregarEscala_(), siglas: Object.keys(mapaRegras_(sheet.getSheetByName(CONFIG.rulesName))) });
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (request.action === 'sessionStart') return resposta_(iniciarSessaoMembro_(request));
    if (request.action === 'sessionSchedule') return resposta_(escalaSessaoMembro_(request));
    if (request.action === 'sessionEnd') return resposta_(encerrarSessaoMembro_(request));
    if (request.action === 'cancelOwn') return resposta_(cancelarReservaMembro_(request));
    if (request.action === 'reserve') return resposta_(processarReserva_(request));
    if (request.action === 'admin') return resposta_(processarAdmin_(request));
    return resposta_({ ok: false, codigo: 'ACAO_INVALIDA', mensagem: 'Ação não reconhecida.' });
  } catch (error) {
    return resposta_({ ok: false, codigo: 'REQUISICAO_INVALIDA', mensagem: 'Não foi possível processar a solicitação.' });
  }
}

function validarReserva_(input) {
  const data = input || {};
  const sigla = normalizar_(data.sigla);
  if (!data.allowedSiglas || !data.allowedSiglas[sigla]) return { ok: false, codigo: 'SIGLA_INVALIDA' };
  if (CONFIG.blockedMonths.includes(String(data.month || '').trim().toLowerCase())) return { ok: false, codigo: 'MES_BLOQUEADO' };
  if (normalizar_(data.currentValue)) return { ok: false, codigo: 'VAGA_OCUPADA' };
  const maxWeeks = limiteSemanas_(sigla, data.round);
  if (Number(data.weeksForSigla || 0) >= maxWeeks) return { ok: false, codigo: 'LIMITE_SEMANAS', maxWeeks };
  if (Array.isArray(data.weekValues) && data.weekValues.map(normalizar_).includes(sigla)) return { ok: false, codigo: 'SIGLA_REPETIDA' };
  if (data.round === 'individual' && Number(data.slotIndex) !== 0) return { ok: false, codigo: 'RODADA_INICIAL' };
  if (data.round === 'conjunta' && Number(data.slotIndex) === 0) return { ok: false, codigo: 'RODADA_CONJUNTA' };
  if (data.round === 'conjunta' && data.slotPrerequisitesMet === false) return { ok: false, codigo: 'VAGA_ANTECEDENTE' };
  if (data.round === 'conjunta' && Number(data.slotIndex) === 2 && (data.weekValues || []).filter(normalizar_).length >= 2) {
    return { ok: false, codigo: 'SABADO_TRES_PROFISSIONAIS' };
  }
  if (data.sequenceBlockedBy) {
    return {
      ok: false,
      codigo: 'SEQUENCIA_SIGLAS',
      sigla,
      antecedente: data.sequenceBlockedBy,
      semanasAntecedente: data.weeksForSequenceBlocker
    };
  }
  if (data.round === 'conjunta' && Number(data.slotIndex) === 2 && Number(data.existingFirstTwoOverlapDays || 0) >= CONFIG.maxOverlapDays) {
    return { ok: false, codigo: 'SIGLA3_BLOQUEADA_TOLERANCIA', overlapDays: Number(data.existingFirstTwoOverlapDays) };
  }
  if (data.round === 'conjunta' && Number(data.overlapDays || 0) > CONFIG.maxOverlapDays) return { ok: false, codigo: 'COINCIDENCIA_DIAS', overlapDays: Number(data.overlapDays) };
  return { ok: true, codigo: 'OK' };
}

function hashPin_(pin, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt) + ':' + String(pin));
  return bytes.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function verificarPin_(pin, expectedHash, salt) {
  return !!pin && hashPin_(pin, salt) === expectedHash;
}

function limiteSemanas_(sigla, round) {
  if (round === 'conjunta') return CONFIG.maxWeeks;
  return CONFIG.singleWeekSiglas.includes(normalizar_(sigla)) ? 1 : CONFIG.maxWeeks;
}

function contarSemanasPorSigla_(sheet, round) {
  const counts = {};
  Object.keys(CONFIG.rows).filter(month => !CONFIG.blockedMonths.includes(month)).forEach(month => {
    const rows = CONFIG.rows[month];
    const columns = CONFIG.columns[month];
    sheet.getRange(rows[0], columns[0], rows.length, columns.length).getDisplayValues().forEach(row => {
      row.forEach((value, slotIndex) => {
        if (round === 'conjunta' ? slotIndex === 0 : slotIndex > 0) return;
        const sigla = normalizar_(value);
        if (sigla) counts[sigla] = (counts[sigla] || 0) + 1;
      });
    });
  });
  return counts;
}

function ordemSequencia_(sheet, round) {
  const sequence = CONFIG.bookingSequence.slice();
  if (round !== 'conjunta') return sequence;
  const initialCounts = contarSemanasPorSigla_(sheet, 'individual');
  const fallbackStart = sequence.find(item => Number(initialCounts[item] || 0) < limiteSemanas_(item, 'individual')) || sequence[0];
  const start = inicioFase2Compartilhado_(sheet) || propriedade_(CONFIG.phase2SequenceStartProperty) || fallbackStart;
  const index = sequence.indexOf(normalizar_(start));
  return index > 0 ? sequence.slice(index).concat(sequence.slice(0, index)) : sequence;
}

function inicioFase2Compartilhado_(sheet) {
  const audit = sheet.getParent().getSheetByName(CONFIG.auditName);
  if (!audit || audit.getLastRow() < 2) return '';
  const entries = audit.getRange(2, 2, audit.getLastRow() - 1, 2).getDisplayValues();
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    if (normalizar_(entries[index][0]) === 'FASE2_INICIO') return normalizar_(entries[index][1]);
  }
  return '';
}

function antecedentePendenteSequencia_(sheet, weeksBySigla, sigla, round) {
  const sequence = ordemSequencia_(sheet, round);
  const index = sequence.indexOf(normalizar_(sigla));
  if (index < 0) return '';
  return sequence.slice(0, index).find(previous =>
    Number(weeksBySigla[previous] || 0) < limiteSemanas_(previous, round)
  ) || '';
}

function primeiraPendenteSequencia_(sheet, counts, round) {
  return ordemSequencia_(sheet, round).find(sigla =>
    Number(counts[sigla] || 0) < limiteSemanas_(sigla, round)
  ) || '';
}

function obterProximaSiglaConvite_(sheet, siglaAtual, round, counts) {
  const sequence = ordemSequencia_(sheet, round);
  const index = sequence.indexOf(normalizar_(siglaAtual));
  if (index < 0) return '';
  return sequence.slice(index + 1).find(sigla =>
    Number(counts[sigla] || 0) < limiteSemanas_(sigla, round)
  ) || '';
}

function proximoConviteAdministrativo_(sheet) {
  const round = faseAtual_(sheet);
  const counts = contarSemanasPorSigla_(sheet, round);
  const sigla = primeiraPendenteSequencia_(sheet, counts, round);
  if (!sigla) return null;
  const pin = propriedade_('INVITE_PIN_' + sigla);
  return { sigla, pin: /^\d{4}$/.test(pin) ? pin : '', requiresSetup: !/^\d{4}$/.test(pin) };
}

function definirInicioFase2_(sheet, siglaFinal) {
  const currentIndex = CONFIG.bookingSequence.indexOf(normalizar_(siglaFinal));
  let next = currentIndex >= 0
    ? CONFIG.bookingSequence[(currentIndex + 1) % CONFIG.bookingSequence.length]
    : '';
  if (!next) {
    const initialCounts = contarSemanasPorSigla_(sheet, 'individual');
    next = CONFIG.bookingSequence.find(sigla => Number(initialCounts[sigla] || 0) < limiteSemanas_(sigla, 'individual')) || CONFIG.bookingSequence[0];
  }
  PropertiesService.getScriptProperties().setProperty(CONFIG.phase2SequenceStartProperty, next);
  auditar_('fase2_inicio', next, '', 'OK', 'Fase 2 iniciada após o fechamento de SIGLA 1 por ' + (normalizar_(siglaFinal) || 'edição administrativa') + '.');
  return next;
}

function chaveSessaoMembro_(token) { return 'MEMBER_SESSION_SIGLA_' + String(token || ''); }
function chaveEstadoSessaoMembro_(sigla) { return 'MEMBER_SESSION_STATE_' + normalizar_(sigla); }
function chaveReservaSessao_(vaga) { return 'MEMBER_BOOKING_SESSION_' + String(vaga || ''); }

function validarSessaoMembro_(token) {
  const value = String(token || '');
  if (!value) return '';
  const sigla = propriedade_(chaveSessaoMembro_(value));
  return sigla && propriedade_(chaveEstadoSessaoMembro_(sigla)) === value ? sigla : '';
}

function iniciarSessaoMembro_(request) {
  const sigla = normalizar_(request.sigla);
  const pinResult = validarPinMembro_(sigla, request.pin);
  if (!pinResult.ok) return pinResult;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const stateKey = chaveEstadoSessaoMembro_(sigla);
    const previousState = properties.getProperty(stateKey) || '';
    if (previousState && previousState !== 'REOPENED') {
      return { ok: false, codigo: 'SESSAO_BLOQUEADA', mensagem: 'Esta sigla já encerrou a sessão de lançamento. Solicite ao administrador que a reabra.' };
    }

    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    properties.setProperty(chaveSessaoMembro_(token), sigla);
    properties.setProperty(stateKey, token);
    if (previousState === 'REOPENED') {
      const sheet = planilha_().getSheetByName(CONFIG.sheetName);
      vagas_().forEach(vaga => {
        if (normalizar_(sheet.getRange(vaga.row, vaga.column).getDisplayValue()) === sigla) {
          properties.setProperty(chaveReservaSessao_(vaga.id), token);
        }
      });
    }
    return { ok: true, codigo: 'OK', sigla, sessionToken: token };
  } finally {
    lock.releaseLock();
  }
}

function escalaSessaoMembro_(request) {
  const token = String(request.sessionToken || '');
  const sigla = validarSessaoMembro_(token);
  if (!sigla) return { ok: false, codigo: 'SESSAO_ENCERRADA', mensagem: 'A sessão foi encerrada. Solicite ao administrador que reabra o acesso.' };
  const rules = mapaRegras_(planilha_().getSheetByName(CONFIG.rulesName));
  return { ok: true, codigo: 'OK', escala: carregarEscala_(token, sigla), siglas: Object.keys(rules) };
}

function encerrarSessaoMembro_(request) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const token = String(request.sessionToken || '');
    const sigla = validarSessaoMembro_(token);
    if (!sigla) return { ok: true, codigo: 'OK' };
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(chaveEstadoSessaoMembro_(sigla), 'CLOSED');
    properties.deleteProperty(chaveSessaoMembro_(token));
    auditar_('sessao_encerrada', sigla, '', 'OK', 'Sessão de lançamento encerrada.');
    return { ok: true, codigo: 'OK', mensagem: 'Sessão encerrada.' };
  } finally {
    lock.releaseLock();
  }
}

function processarReserva_(request) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = planilha_().getSheetByName(CONFIG.sheetName);
    const vaga = localizarVaga_(request.vaga);
    if (!sheet || !vaga) return { ok: false, codigo: 'VAGA_INVALIDA', mensagem: 'Vaga não reconhecida.' };
    const cell = sheet.getRange(vaga.row, vaga.column);
    const currentValue = cell.getDisplayValue();
    const sessionToken = String(request.sessionToken || '');
    const sessionSigla = sessionToken ? validarSessaoMembro_(sessionToken) : '';
    if (sessionToken && !sessionSigla) return { ok: false, codigo: 'SESSAO_ENCERRADA', mensagem: 'A sessão foi encerrada. Solicite ao administrador que reabra o acesso.' };
    const sigla = sessionSigla || normalizar_(request.sigla);
    if (sessionSigla && request.sigla && normalizar_(request.sigla) !== sessionSigla) return { ok: false, codigo: 'SESSAO_SIGLA_DIVERGENTE', mensagem: 'A sessão está vinculada a outra sigla.' };
    if (!sessionToken) return { ok: false, codigo: 'SESSAO_NECESSARIA', mensagem: 'Inicie uma sessão de lançamento para fazer sua escolha. Atualize a página e tente novamente.' };
    const state = estadoAtual_(sheet, vaga, sigla);
    const result = validarReserva_({ ...request, sigla, month: vaga.month, slotIndex: vaga.slotIndex, currentValue, ...state });
    if (!result.ok) {
      if (result.codigo === 'COINCIDENCIA_DIAS') {
        const warning = mensagemResultado_(result);
        try { auditar_('reserva_rejeitada', sigla, request.vaga, result.codigo, warning.mensagem); } catch (_error) {}
        return warning;
      }
      return mensagemResultado_(result);
    }
    cell.setValue(sigla);
    const properties = PropertiesService.getScriptProperties();
    if (sessionToken) properties.setProperty(chaveReservaSessao_(vaga.id), sessionToken);
    auditar_('reserva', sigla, request.vaga, result.codigo);
    const roundAfter = faseAtual_(sheet);
    if (state.round === 'individual' && roundAfter === 'conjunta') {
      definirInicioFase2_(sheet, sigla);
    }
    return { ok: true, codigo: 'OK', mensagem: 'Escolha confirmada.', sessionToken, sigla, escala: carregarEscala_(sessionToken, sessionSigla || '') };
  } finally {
    lock.releaseLock();
  }
}

function cancelarReservaMembro_(request) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const token = String(request.sessionToken || '');
    const sigla = validarSessaoMembro_(token);
    if (!sigla) return { ok: false, codigo: 'SESSAO_ENCERRADA', mensagem: 'A sessão foi encerrada. Solicite ao administrador que reabra o acesso.' };
    const vaga = localizarVaga_(request.vaga);
    if (!vaga) return { ok: false, codigo: 'VAGA_INVALIDA', mensagem: 'Vaga não reconhecida.' };
    const properties = PropertiesService.getScriptProperties();
    const sheet = planilha_().getSheetByName(CONFIG.sheetName);
    const cell = sheet.getRange(vaga.row, vaga.column);
    if (normalizar_(cell.getDisplayValue()) !== sigla || properties.getProperty(chaveReservaSessao_(vaga.id)) !== token) {
      return { ok: false, codigo: 'ALTERACAO_NAO_PERMITIDA', mensagem: 'Só é possível limpar uma escolha feita pela sua sigla nesta sessão.' };
    }
    cell.clearContent();
    properties.deleteProperty(chaveReservaSessao_(vaga.id));
    if (faseAtual_(sheet) === 'individual') properties.deleteProperty(CONFIG.phase2SequenceStartProperty);
    auditar_('reserva_limpa', sigla, request.vaga, 'OK', 'Escolha removida durante a sessão de lançamento.');
    return { ok: true, codigo: 'OK', mensagem: 'Sua escolha foi limpa.', escala: carregarEscala_(token, sigla) };
  } finally {
    lock.releaseLock();
  }
}

function processarAdmin_(request) {
  if (!verificarPin_(request.pin, propriedade_('ADMIN_PIN_HASH'), propriedade_('PIN_SALT'))) {
    return { ok: false, codigo: 'PIN_INVALIDO', mensagem: 'PIN administrativo inválido.' };
  }
  if (request.operation === 'schedule') {
    const sheet = planilha_().getSheetByName(CONFIG.sheetName);
    return { ok: true, codigo: 'OK', escala: carregarEscala_(), auditoria: lerAuditoria_(), siglas: Object.keys(mapaRegras_(planilha_().getSheetByName(CONFIG.rulesName))), proximoConvite: proximoConviteAdministrativo_(sheet) };
  }
  if (request.operation === 'prepareInvite') return prepararConvite_(request);
  if (request.operation === 'changePin') return trocarPin_(request);
  if (request.operation === 'override') return overrideVaga_(request);
  if (request.operation === 'reopenMemberSession') return reabrirSessaoMembro_(request);
  return { ok: false, codigo: 'OPERACAO_ADMIN_INVALIDA', mensagem: 'Operação administrativa não reconhecida.' };
}

function prepararConvite_(request) {
  const sheet = planilha_().getSheetByName(CONFIG.sheetName);
  const expected = proximoConviteAdministrativo_(sheet);
  if (!expected) return { ok: false, mensagem: 'Não existe profissional pendente na fila.' };
  const sigla = normalizar_(request.sigla);
  const pin = String(request.invitePin || '');
  if (sigla !== expected.sigla) return { ok: false, mensagem: 'A fila mudou. Atualize a gestão administrativa.' };
  if (!/^\d{4}$/.test(pin)) return { ok: false, mensagem: 'Informe quatro dígitos para o novo PIN.' };
  const props = PropertiesService.getScriptProperties();
  props.setProperty('PIN_' + sigla, hashPin_(pin, propriedade_('PIN_SALT')));
  props.setProperty('INVITE_PIN_' + sigla, pin);
  auditar_('convite_preparado', sigla, '', 'OK', 'PIN configurado pelo administrador para convite.');
  return { ok: true, proximoConvite: { sigla, pin } };
}

function validarPinMembro_(sigla, pin) {
  const hash = propriedade_('PIN_' + sigla);
  return hash && verificarPin_(String(pin || ''), hash, propriedade_('PIN_SALT'))
    ? { ok: true, codigo: 'OK' }
    : { ok: false, codigo: 'PIN_INVALIDO', mensagem: 'Sigla ou PIN inválido.' };
}

function propriedade_(name) { return PropertiesService.getScriptProperties().getProperty(name) || ''; }
function planilha_() { return SpreadsheetApp.openById(propriedade_('SPREADSHEET_ID')); }
function resposta_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
function normalizar_(value) { return String(value || '').trim().toUpperCase(); }
function mensagemResultado_(result) {
  const overlap = Number(result.overlapDays || 0);
  const mensagem = result.codigo === 'COINCIDENCIA_DIAS'
    ? `A soma das coincidências desta semana seria de ${formatarDias_(overlap)}; o limite é ${formatarDias_(CONFIG.maxOverlapDays)}.`
    : result.codigo === 'SIGLA3_BLOQUEADA_TOLERANCIA'
      ? `SIGLA 3 está bloqueada: SIGLA 1 e SIGLA 2 já coincidem em ${formatarDias_(overlap)}; a tolerância termina em ${formatarDias_(CONFIG.maxOverlapDays)}.`
      : result.codigo === 'SABADO_TRES_PROFISSIONAIS'
        ? 'Esta semana já tem duas siglas de férias. Não é permitida uma terceira marcação, pois o sábado não pode ter três profissionais de férias.'
    : result.codigo === 'LIMITE_SEMANAS'
      ? `Esta sigla já atingiu o limite de ${result.maxWeeks || 1} ${Number(result.maxWeeks || 1) === 1 ? 'semana' : 'semanas'} nesta rodada.`
      : result.codigo === 'SEQUENCIA_SIGLAS'
        ? `Aguarde ${result.antecedente} completar a cota de ${result.semanasAntecedente} ${Number(result.semanasAntecedente) === 1 ? 'semana' : 'semanas'} desta rodada antes de liberar ${result.sigla}.`
    : (mensagens_[result.codigo] || 'A escolha não foi autorizada.');
  return { ...result, coincidenciaDias: overlap, mensagem };
}

const mensagens_ = {
  MES_BLOQUEADO: 'Janeiro e julho estão bloqueados nesta rodada.',
  VAGA_OCUPADA: 'Esta vaga já foi preenchida.',
  RODADA_INICIAL: 'As férias conjuntas ainda não estão liberadas.',
  RODADA_CONJUNTA: 'A vaga inicial desta semana ainda deve ser preenchida.',
  VAGA_ANTECEDENTE: 'Preencha as vagas anteriores desta semana antes de escolher esta sigla.',
  COINCIDENCIA_DIAS: 'A combinação ultrapassa três dias úteis coincidentes.',
  SIGLA3_BLOQUEADA_TOLERANCIA: 'SIGLA 3 está bloqueada: SIGLA 1 e SIGLA 2 já atingiram o limite de três dias úteis coincidentes.',
  SIGLA_REPETIDA: 'A sigla já está registrada nesta semana.',
  SIGLA_INVALIDA: 'A sigla não está cadastrada nas regras.'
};

function localizarVaga_(id) {
  const match = String(id || '').match(/^([a-z]+)-(\d+)-(\d+)$/i);
  if (!match || !CONFIG.rows[match[1]]) return null;
  const month = match[1].toLowerCase();
  const rowIndex = Number(match[2]);
  const slotIndex = Number(match[3]);
  const row = CONFIG.rows[month][rowIndex];
  const column = CONFIG.columns[month][slotIndex];
  return row && column ? { id: month + '-' + rowIndex + '-' + slotIndex, month, row, column, slotIndex } : null;
}

function vagas_() {
  return Object.keys(CONFIG.rows).flatMap(month => CONFIG.rows[month].flatMap((row, rowIndex) => CONFIG.columns[month].map((column, slotIndex) => ({ id: month + '-' + rowIndex + '-' + slotIndex, month, row, column, slotIndex }))));
}

function faseAtual_(sheet) {
  const initialSlots = vagas_().filter(vaga => !CONFIG.blockedMonths.includes(vaga.month) && vaga.slotIndex === 0);
  return initialSlots.every(vaga => normalizar_(sheet.getRange(vaga.row, vaga.column).getDisplayValue())) ? 'conjunta' : 'individual';
}

function estadoAtual_(sheet, target, sigla) {
  const round = faseAtual_(sheet);
  const allowedSiglas = mapaRegras_(sheet.getParent().getSheetByName(CONFIG.rulesName));
  const weekValues = CONFIG.columns[target.month].map(column => normalizar_(sheet.getRange(target.row, column).getDisplayValue()));
  const firstSlotFilled = !!weekValues[0];
  const secondSlotFilled = !!weekValues[1];
  const slotPrerequisitesMet = target.slotIndex === 1 ? firstSlotFilled : target.slotIndex === 2 ? firstSlotFilled && secondSlotFilled : true;
  const existingFirstTwoOverlapDays = firstSlotFilled && secondSlotFilled
    ? somarCoincidenciasPorPar_(weekValues.slice(0, 2), '', allowedSiglas)
    : 0;
  const weeksBySigla = contarSemanasPorSigla_(sheet, round);
  const weeksForSigla = Number(weeksBySigla[sigla] || 0);
  const sequenceBlockedBy = antecedentePendenteSequencia_(sheet, weeksBySigla, sigla, round);
  const weeksForSequenceBlocker = sequenceBlockedBy ? limiteSemanas_(sequenceBlockedBy, round) : 0;
  const overlapDays = somarCoincidenciasPorPar_(weekValues, sigla, allowedSiglas);
  return { round, allowedSiglas, weeksForSigla, weekValues, overlapDays, sequenceBlockedBy, weeksForSequenceBlocker, slotPrerequisitesMet, existingFirstTwoOverlapDays };
}

function mapaRegras_(sheet) {
  return sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 6).getDisplayValues().reduce((result, row) => {
    const sigla = normalizar_(row[0]);
    if (sigla) result[sigla] = row.slice(1, 6).map(value => normalizar_(value) === 'X' ? 1 : 0);
    return result;
  }, {});
}

function somarCoincidenciasPorPar_(weekValues, sigla, regras) {
  const candidate = normalizar_(sigla);
  const participants = weekValues.map(normalizar_).filter(value => value && value !== candidate);
  if (candidate) participants.push(candidate);
  let total = 0;
  for (let left = 0; left < participants.length; left += 1) {
    for (let right = left + 1; right < participants.length; right += 1) {
      const siglaA = participants[left];
      const siglaB = participants[right];
      total += contarDiasCoincidentes_(regras[siglaA] || [], regras[siglaB] || [], siglaA, siglaB);
    }
  }
  return total;
}

function contarDiasCoincidentes_(diasA, diasB, siglaA, siglaB) {
  const a = normalizar_(siglaA);
  const b = normalizar_(siglaB);
  return (diasA || []).reduce((total, dia, indice) => {
    if (!dia || !diasB || !diasB[indice]) return total;
    const meiaJornada = (CONFIG.halfDayOverlapPairsByWeekday[indice] || []).some(par =>
      (par[0] === a && par[1] === b) || (par[0] === b && par[1] === a)
    );
    return total + (meiaJornada ? 0.5 : 1);
  }, 0);
}

function formatarDias_(value) {
  const amount = Number(value || 0);
  const formatted = String(amount).replace('.', ',');
  return `${formatted} ${amount === 1 || amount < 1 ? 'dia útil' : 'dias úteis'}`;
}

function carregarEscala_(sessionToken, sessionSigla) {
  const sheet = planilha_().getSheetByName(CONFIG.sheetName);
  const rules = mapaRegras_(sheet.getParent().getSheetByName(CONFIG.rulesName));
  const properties = PropertiesService.getScriptProperties();
  const canUseMemberSession = !!sessionToken && !!sessionSigla && validarSessaoMembro_(sessionToken) === normalizar_(sessionSigla);
  const round = faseAtual_(sheet);
  return Object.keys(CONFIG.rows).map(month => ({
    id: month,
    name: month.toUpperCase(),
    phase: round === 'conjunta' ? 'Férias conjuntas liberadas' : 'Rodada individual',
    blocked: CONFIG.blockedMonths.includes(month),
    weeks: CONFIG.rows[month].map((row, rowIndex) => {
      const right = CONFIG.columns[month][0] > 5;
      const labelColumn = right ? 7 : 1;
      const periodColumn = right ? 8 : 2;
      return {
        id: month + '-' + rowIndex,
        label: sheet.getRange(row, labelColumn).getDisplayValue(),
        period: sheet.getRange(row, periodColumn).getDisplayValue(),
        slots: CONFIG.columns[month].map((column, slotIndex) => {
          const value = sheet.getRange(row, column).getDisplayValue();
          const weekValues = CONFIG.columns[month].map(weekColumn => normalizar_(sheet.getRange(row, weekColumn).getDisplayValue()));
          const phaseAllows = round === 'individual' ? slotIndex === 0 : slotIndex > 0;
          const predecessorsFilled = slotIndex === 1 ? !!weekValues[0] : slotIndex === 2 ? !!weekValues[0] && !!weekValues[1] : true;
          const existingFirstTwoOverlapDays = weekValues[0] && weekValues[1]
            ? somarCoincidenciasPorPar_(weekValues.slice(0, 2), '', rules)
            : 0;
          const firstSlotFilled = !!weekValues[0];
          const secondSlotFilled = !!weekValues[1];
          const sigla3BlockedBySaturday = slotIndex === 2 && firstSlotFilled && secondSlotFilled;
          const available = !value && !CONFIG.blockedMonths.includes(month) && phaseAllows && predecessorsFilled && !sigla3BlockedBySaturday;
          const explainSigla3Blocked = slotIndex === 2 && !value && !CONFIG.blockedMonths.includes(month)
            && phaseAllows && predecessorsFilled && sigla3BlockedBySaturday
            ? 'SIGLA 3 bloqueada: esta semana já tem duas siglas de férias. O sábado não pode ter três profissionais de férias.'
            : '';
          const id = month + '-' + rowIndex + '-' + slotIndex;
          const canClear = canUseMemberSession && normalizar_(value) === normalizar_(sessionSigla) && properties.getProperty(chaveReservaSessao_(id)) === sessionToken;
          const otherSiglas = CONFIG.columns[month].map((otherColumn, otherIndex) => otherIndex === slotIndex ? '' : sheet.getRange(row, otherColumn).getDisplayValue())
            .map(normalizar_).filter(other => other && other !== normalizar_(value));
          const overlapDays = value ? somarCoincidenciasPorPar_(otherSiglas, value, rules) : 0;
          return { id, label: 'SIGLA ' + (slotIndex + 1), value, overlapDays, canClear, blockedReason: explainSigla3Blocked, state: value ? 'filled' : (available ? 'available' : 'locked'), disabled: !available && !canClear && !explainSigla3Blocked };
        })
      };
    })
  }));
}

function obterAuditoriaSheet_() {
  const book = planilha_();
  let sheet = book.getSheetByName(CONFIG.auditName);
  if (!sheet) {
    sheet = book.insertSheet(CONFIG.auditName);
    sheet.appendRow(['Data/hora', 'Tipo', 'Sigla', 'Vaga', 'Resultado', 'Justificativa']);
    sheet.protect().setDescription('AUDITORIA_PWA_PROTEGIDA');
  }
  return sheet;
}

function lerAuditoria_() {
  const sheet = obterAuditoriaSheet_();
  const values = sheet.getDataRange().getDisplayValues();
  return values.slice(1).slice(-200).reverse().map(row => ({ timestamp: row[0], type: row[1], sigla: row[2], vaga: row[3], result: row[4], justification: row[5] }));
}

function auditar_(action, sigla, vaga, result, justification) {
  const sheet = obterAuditoriaSheet_();
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1).setValue(new Date());
  const fields = [action, sigla, vaga, result, justification].map(value =>
    SpreadsheetApp.newRichTextValue().setText(String(value == null ? '' : value)).build()
  );
  sheet.getRange(row, 2, 1, fields.length).setRichTextValues([fields]);
}

function trocarPin_(request) {
  const sigla = normalizar_(request.sigla);
  if (!/^\d{4}$/.test(String(request.newPin || ''))) return { ok: false, codigo: 'PIN_INVALIDO', mensagem: 'O novo PIN deve conter quatro dígitos.' };
  PropertiesService.getScriptProperties().setProperty('PIN_' + sigla, hashPin_(request.newPin, propriedade_('PIN_SALT')));
  auditar_('admin_change_pin', sigla, '', 'OK', 'PIN substituído');
  return { ok: true, codigo: 'OK', mensagem: 'PIN atualizado.' };
}

function overrideVaga_(request) {
  if (!request.justification || !String(request.justification).trim()) return { ok: false, codigo: 'JUSTIFICATIVA_OBRIGATORIA', mensagem: 'Informe a justificativa.' };
  const vaga = localizarVaga_(request.vaga);
  if (!vaga) return { ok: false, codigo: 'VAGA_INVALIDA', mensagem: 'Vaga não reconhecida.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = planilha_().getSheetByName(CONFIG.sheetName);
    const roundBefore = faseAtual_(sheet);
    const cell = sheet.getRange(vaga.row, vaga.column);
    const value = String(request.value == null ? '' : request.value);
    const validation = cell.getDataValidation();
    if (validation) cell.clearDataValidations();
    try {
      if (value === '') cell.clearContent();
      else cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(value).build());
    } finally {
      if (validation) cell.setDataValidation(validation);
    }
    PropertiesService.getScriptProperties().deleteProperty(chaveReservaSessao_(vaga.id));
    const roundAfter = faseAtual_(sheet);
    if (roundBefore === 'individual' && roundAfter === 'conjunta' && vaga.slotIndex === 0 && normalizar_(value)) {
      definirInicioFase2_(sheet, value);
    } else if (roundAfter === 'individual') {
      PropertiesService.getScriptProperties().deleteProperty(CONFIG.phase2SequenceStartProperty);
    }
    const rules = mapaRegras_(sheet.getParent().getSheetByName(CONFIG.rulesName));
    const otherSiglas = CONFIG.columns[vaga.month].map((column, index) => index === vaga.slotIndex ? '' : sheet.getRange(vaga.row, column).getDisplayValue())
      .map(normalizar_).filter(other => other && other !== normalizar_(value));
    const overlapDays = value ? somarCoincidenciasPorPar_(otherSiglas, value, rules) : 0;
    const note = overlapDays ? `Coincidência com outra sigla: ${formatarDias_(overlapDays)}. ${String(request.justification).trim()}` : String(request.justification).trim();
    auditar_('admin_override', value, request.vaga, 'OK', note);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, codigo: 'OK', mensagem: 'Ajuste administrativo aplicado.', escala: carregarEscala_() };
}

function reabrirSessaoMembro_(request) {
  const sigla = normalizar_(request.sigla);
  const sheet = planilha_().getSheetByName(CONFIG.rulesName);
  const rules = mapaRegras_(sheet);
  if (!sigla || !rules[sigla]) return { ok: false, codigo: 'SIGLA_INVALIDA', mensagem: 'Selecione uma sigla cadastrada.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const properties = PropertiesService.getScriptProperties();
    const stateKey = chaveEstadoSessaoMembro_(sigla);
    const previousState = properties.getProperty(stateKey) || '';
    if (previousState && previousState !== 'REOPENED') properties.deleteProperty(chaveSessaoMembro_(previousState));
    properties.setProperty(stateKey, 'REOPENED');
    auditar_('admin_reabriu_sessao', sigla, '', 'OK', 'Administrador reabriu a sessão de lançamento.');
    return { ok: true, codigo: 'OK', mensagem: `Sessão de ${sigla} reaberta. O usuário poderá iniciar uma nova sessão com o PIN da sigla.` };
  } finally {
    lock.releaseLock();
  }
}
