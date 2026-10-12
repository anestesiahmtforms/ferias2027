import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadRules() {
  const source = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8');
  const context = {
    console,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: (_algorithm, value) => Array.from(Buffer.from(String(value), 'utf8'))
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

const base = () => ({
  sigla: 'FR',
  month: 'fevereiro',
  slotIndex: 0,
  round: 'individual',
  allowedSiglas: { FR: true },
  weeksForSigla: 0,
  weekValues: [],
  overlapDays: 0,
  currentValue: ''
});

test('accepts a valid first-round reservation', () => {
  const { validarReserva_ } = loadRules();
  const result = validarReserva_(base());
  assert.equal(result.ok, true);
  assert.equal(result.codigo, 'OK');
});

test('rejects January and July reservations', () => {
  const { validarReserva_ } = loadRules();
  assert.equal(validarReserva_({ ...base(), month: 'janeiro' }).codigo, 'MES_BLOQUEADO');
  assert.equal(validarReserva_({ ...base(), month: 'julho' }).codigo, 'MES_BLOQUEADO');
});

test('rejects a third week for the same sigla', () => {
  const { validarReserva_ } = loadRules();
  assert.equal(validarReserva_({ ...base(), weeksForSigla: 2 }).codigo, 'LIMITE_SEMANAS');
});

test('rejects joint vacation before the initial round is complete', () => {
  const { validarReserva_ } = loadRules();
  assert.equal(validarReserva_({ ...base(), slotIndex: 1, round: 'individual' }).codigo, 'RODADA_INICIAL');
});

test('allows three coincident working days and rejects four in the joint round', () => {
  const { validarReserva_ } = loadRules();
  assert.equal(validarReserva_({ ...base(), slotIndex: 1, round: 'conjunta', overlapDays: 3 }).ok, true);
  assert.equal(validarReserva_({ ...base(), slotIndex: 1, round: 'conjunta', overlapDays: 4 }).codigo, 'COINCIDENCIA_DIAS');
});

test('uses phase-specific quotas for the January/July group and other siglas', () => {
  const { limiteSemanas_, validarReserva_ } = loadRules();
  assert.equal(limiteSemanas_('FR', 'individual'), 1);
  assert.equal(limiteSemanas_('CR', 'individual'), 2);
  assert.equal(limiteSemanas_('FR', 'conjunta'), 2);
  assert.equal(limiteSemanas_('BA', 'conjunta'), 2);
  assert.equal(validarReserva_({ ...base(), round: 'conjunta', slotIndex: 1, weeksForSigla: 1 }).ok, true);
  assert.equal(validarReserva_({ ...base(), round: 'conjunta', slotIndex: 1, weeksForSigla: 2 }).codigo, 'LIMITE_SEMANAS');
});

test('allows SIGLA 3 when the Saturday roster does not have three professionals', () => {
  const { validarReserva_ } = loadRules();
  const result = validarReserva_({
    ...base(), round: 'conjunta', slotIndex: 2,
    slotPrerequisitesMet: true, overlapDays: 3, saturdayRosterVerified: true, saturdayThree: false
  });
  assert.equal(result.codigo, 'OK');
});

test('blocks a third vacation in the same week because Saturday cannot have three professionals', () => {
  const { validarReserva_ } = loadRules();
  const result = validarReserva_({
    ...base(), round: 'conjunta', slotIndex: 2,
    slotPrerequisitesMet: true, weekValues: ['CR', 'AD', ''], saturdayRosterVerified: true, saturdayThree: true
  });
  assert.equal(result.codigo, 'SABADO_TRES_PROFISSIONAIS');
});

test('counts every sigla column when evaluating the next invitation in the joint phase', () => {
  const context = loadRules();
  vm.runInContext("CONFIG.rows = { fevereiro: [1] }; CONFIG.columns = { fevereiro: [1, 2, 3] }; CONFIG.blockedMonths = [];", context);
  const sheet = { getRange: () => ({ getDisplayValues: () => [['CR', 'AD', '']] }) };
  const counts = context.contarMarcacoesTotaisPorSigla_(sheet);
  assert.equal(counts.CR, 1);
  assert.equal(counts.AD, 1);
});

test('counts a sigla even when a group note follows it in the cell', () => {
  const context = loadRules();
  vm.runInContext("CONFIG.rows = { fevereiro: [1] }; CONFIG.columns = { fevereiro: [1, 2, 3] };", context);
  const sheet = { getRange: () => ({ getDisplayValues: () => [['CR Grupo A', '', '']] }) };
  assert.equal(context.contarMarcacoesTotaisPorSigla_(sheet).CR, 1);
});

test('keeps a regular sigla as the current joint-phase invitation until it has four total markings', () => {
  const context = loadRules();
  context.ordemSequencia_ = () => ['CR', 'AD'];
  assert.equal(context.primeiraPendenteSequencia_({}, { CR: 2, AD: 0 }, 'conjunta'), 'CR');
  assert.equal(context.primeiraPendenteSequencia_({}, { CR: 4, AD: 0 }, 'conjunta'), 'AD');
  assert.equal(context.metaLiberacaoFila_('CH', 'conjunta'), 0);
  assert.equal(context.pendenteNaFila_('CH', {}, 'conjunta'), false);
});

test('sums weekday coincidences separately for each pair', () => {
  const { somarCoincidenciasPorPar_ } = loadRules();
  const rules = {
    CR: [1, 0, 0, 0, 0],
    AD: [1, 0, 0, 0, 0],
    LH: [1, 0, 0, 0, 0]
  };
  assert.equal(somarCoincidenciasPorPar_(['AD', 'LH'], 'CR', rules), 3);
});

test('applies each approved half-day pair exception in its weekday', () => {
  const { contarDiasCoincidentes_ } = loadRules();
  const exceptions = [
    ['CH', 'FL', 0], ['RO', 'AA', 1], ['DE', 'BA', 2], ['LC', 'GU', 2],
    ['RO', 'AA', 3], ['L2', 'BA', 4], ['GB', 'AA', 4]
  ];
  for (const [siglaA, siglaB, weekday] of exceptions) {
    const daysA = [0, 0, 0, 0, 0];
    const daysB = [0, 0, 0, 0, 0];
    daysA[weekday] = 1;
    daysB[weekday] = 1;
    assert.equal(contarDiasCoincidentes_(daysA, daysB, siglaA, siglaB), 0.5, `${siglaA}/${siglaB} weekday ${weekday}`);
  }
});

test('rejects an already occupied or repeated week', () => {
  const { validarReserva_ } = loadRules();
  assert.equal(validarReserva_({ ...base(), currentValue: 'AA' }).codigo, 'VAGA_OCUPADA');
  assert.equal(validarReserva_({ ...base(), weekValues: ['FR'] }).codigo, 'SIGLA_REPETIDA');
});

test('hashes and verifies a PIN without exposing the clear value', () => {
  const { hashPin_, verificarPin_ } = loadRules();
  const digest = hashPin_('1234', 'ferias-salt');
  assert.notEqual(digest, '1234');
  assert.equal(verificarPin_('1234', digest, 'ferias-salt'), true);
  assert.equal(verificarPin_('9999', digest, 'ferias-salt'), false);
});
