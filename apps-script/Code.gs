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
  maxOverlapDays: 3,
  rows: {
    janeiro: [5, 6, 7, 8], fevereiro: [5, 6, 7, 8], marco: [13, 14, 15, 16, 17], abril: [13, 14, 15, 16],
    maio: [22, 23, 24, 25], junho: [22, 23, 24, 25, 26], julho: [31, 32, 33, 34], agosto: [31, 32, 33, 34, 35],
    setembro: [39, 40, 41, 42, 43], outubro: [39, 40, 41, 42], novembro: [48, 49, 50, 51, 52], dezembro: [48, 49, 50, 51, 52]
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
  if (Number(data.weeksForSigla || 0) >= CONFIG.maxWeeks) return { ok: false, codigo: 'LIMITE_SEMANAS' };
  if (Array.isArray(data.weekValues) && data.weekValues.map(normalizar_).includes(sigla)) return { ok: false, codigo: 'SIGLA_REPETIDA' };
  if (data.round === 'individual' && Number(data.slotIndex) !== 0) return { ok: false, codigo: 'RODADA_INICIAL' };
  if (data.round === 'conjunta' && Number(data.slotIndex) === 0) return { ok: false, codigo: 'RODADA_CONJUNTA' };
  if (data.round === 'conjunta' && Number(data.overlapDays || 0) > CONFIG.maxOverlapDays) return { ok: false, codigo: 'COINCIDENCIA_DIAS' };
  return { ok: true, codigo: 'OK' };
}

function hashPin_(pin, salt) {
  const bytes = Utilities.computeDigest('SHA_256', String(salt) + ':' + String(pin));
  return bytes.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function verificarPin_(pin, expectedHash, salt) {
  return !!pin && hashPin_(pin, salt) === expectedHash;
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
    const sigla = normalizar_(request.sigla);
    const pinResult = validarPinMembro_(sigla, request.pin);
    if (!pinResult.ok) return pinResult;
    const state = estadoAtual_(sheet, vaga, sigla);
    const result = validarReserva_({ ...request, sigla, month: vaga.month, slotIndex: vaga.slotIndex, currentValue, ...state });
    if (!result.ok) return mensagemResultado_(result);
    cell.setValue(sigla);
    auditar_('reserva', sigla, request.vaga, result.codigo);
    return { ok: true, codigo: 'OK', mensagem: 'Escolha confirmada.', escala: carregarEscala_() };
  } finally {
    lock.releaseLock();
  }
}

function processarAdmin_(request) {
  if (!verificarPin_(request.pin, propriedade_('ADMIN_PIN_HASH'), propriedade_('PIN_SALT'))) {
    return { ok: false, codigo: 'PIN_INVALIDO', mensagem: 'PIN administrativo inválido.' };
  }
  if (request.operation === 'schedule') return { ok: true, codigo: 'OK', escala: carregarEscala_(), auditoria: lerAuditoria_() };
  if (request.operation === 'changePin') return trocarPin_(request);
  if (request.operation === 'override') return overrideVaga_(request);
  return { ok: false, codigo: 'OPERACAO_ADMIN_INVALIDA', mensagem: 'Operação administrativa não reconhecida.' };
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
function mensagemResultado_(result) { return { ...result, mensagem: mensagens_[result.codigo] || 'A escolha não foi autorizada.' }; }

const mensagens_ = {
  MES_BLOQUEADO: 'Janeiro e julho estão bloqueados nesta rodada.',
  VAGA_OCUPADA: 'Esta vaga já foi preenchida.',
  LIMITE_SEMANAS: 'Esta sigla já atingiu o limite de duas semanas.',
  RODADA_INICIAL: 'As férias conjuntas ainda não estão liberadas.',
  RODADA_CONJUNTA: 'A vaga inicial desta semana ainda deve ser preenchida.',
  COINCIDENCIA_DIAS: 'A combinação ultrapassa três dias úteis coincidentes.',
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
  return row && column ? { month, row, column, slotIndex } : null;
}

function vagas_() {
  return Object.keys(CONFIG.rows).flatMap(month => CONFIG.rows[month].flatMap((row, rowIndex) => CONFIG.columns[month].map((column, slotIndex) => ({ id: month + '-' + rowIndex + '-' + slotIndex, month, row, column, slotIndex }))));
}

function estadoAtual_(sheet, target, sigla) {
  const initialOpen = vagas_().filter(vaga => !CONFIG.blockedMonths.includes(vaga.month) && vaga.slotIndex === 0);
  const initialComplete = initialOpen.every(vaga => normalizar_(sheet.getRange(vaga.row, vaga.column).getDisplayValue()));
  const allowedSiglas = mapaRegras_(sheet.getParent().getSheetByName(CONFIG.rulesName));
  const weekValues = CONFIG.columns[target.month].map(column => sheet.getRange(target.row, column).getDisplayValue()).filter(value => normalizar_(value) !== sigla);
  const weeksForSigla = vagas_().filter(vaga => normalizar_(sheet.getRange(vaga.row, vaga.column).getDisplayValue()) === sigla).length;
  const overlapDays = maiorCoincidencia_(weekValues, sigla, allowedSiglas);
  return { round: initialComplete ? 'conjunta' : 'individual', allowedSiglas, weeksForSigla, weekValues, overlapDays };
}

function mapaRegras_(sheet) {
  return sheet.getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 6).getDisplayValues().reduce((result, row) => {
    const sigla = normalizar_(row[0]);
    if (sigla) result[sigla] = row.slice(1, 6).map(value => normalizar_(value) === 'X' ? 1 : 0);
    return result;
  }, {});
}

function maiorCoincidencia_(weekValues, sigla, regras) {
  const dias = regras[normalizar_(sigla)] || [];
  return weekValues.reduce((max, value) => {
    const outros = regras[normalizar_(value)] || [];
    const coincidencias = dias.reduce((total, day, index) => total + (day && outros[index] ? 1 : 0), 0);
    return Math.max(max, coincidencias);
  }, 0);
}

function carregarEscala_() {
  const sheet = planilha_().getSheetByName(CONFIG.sheetName);
  const initialComplete = vagas_().filter(vaga => !CONFIG.blockedMonths.includes(vaga.month) && vaga.slotIndex === 0)
    .every(vaga => normalizar_(sheet.getRange(vaga.row, vaga.column).getDisplayValue()));
  const round = initialComplete ? 'conjunta' : 'individual';
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
          const available = !value && !CONFIG.blockedMonths.includes(month) && (round === 'individual' ? slotIndex === 0 : slotIndex > 0);
          return { id: month + '-' + rowIndex + '-' + slotIndex, label: 'SIGLA ' + (slotIndex + 1), value, state: value ? 'filled' : (available ? 'available' : 'locked'), disabled: !available };
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
    const cell = planilha_().getSheetByName(CONFIG.sheetName).getRange(vaga.row, vaga.column);
    const value = String(request.value == null ? '' : request.value);
    const validation = cell.getDataValidation();
    if (validation) cell.clearDataValidations();
    try {
      if (value === '') cell.clearContent();
      else cell.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(value).build());
    } finally {
      if (validation) cell.setDataValidation(validation);
    }
    auditar_('admin_override', value, request.vaga, 'OK', request.justification);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, codigo: 'OK', mensagem: 'Ajuste administrativo aplicado.', escala: carregarEscala_() };
}
