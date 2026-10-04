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

test('rejects more than two coincident working days in the joint round', () => {
  const { validarReserva_ } = loadRules();
  assert.equal(validarReserva_({ ...base(), slotIndex: 1, round: 'conjunta', overlapDays: 3 }).codigo, 'COINCIDENCIA_DIAS');
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
