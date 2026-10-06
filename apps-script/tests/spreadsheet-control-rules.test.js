import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(root, 'apps-script/SpreadsheetControl.gs'), 'utf8');

function loadControl() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  return context;
}

function mockSheet(values) {
  return {
    getRange(row, column) {
      return { getDisplayValue: () => values[`${row}-${column}`] || '' };
    }
  };
}

test('direct-sheet controller uses the same phase quotas', () => {
  const { limiteSemanasPorSigla_ } = loadControl();
  assert.equal(limiteSemanasPorSigla_('FR', 'individual'), 1);
  assert.equal(limiteSemanasPorSigla_('CR', 'individual'), 2);
  assert.equal(limiteSemanasPorSigla_('FR', 'conjunta'), 2);
  assert.equal(limiteSemanasPorSigla_('BA', 'conjunta'), 2);
});

test('direct-sheet controller blocks SIGLA 3 when SIGLA 1 and SIGLA 2 already total three days', () => {
  const { vagaSigla3BloqueadaPelaTolerancia_ } = loadControl();
  const sheet = mockSheet({ '5-9': 'CR', '5-10': 'AD' });
  const rules = {
    CR: [1, 1, 1, 0, 0],
    AD: [1, 1, 1, 0, 0]
  };
  assert.equal(vagaSigla3BloqueadaPelaTolerancia_(sheet, { mes: 'fevereiro', linha: 5, indiceSigla: 2 }, rules), true);
  rules.AD = [1, 1, 0, 0, 0];
  assert.equal(vagaSigla3BloqueadaPelaTolerancia_(sheet, { mes: 'fevereiro', linha: 5, indiceSigla: 2 }, rules), false);
});

test('direct-sheet controller sums all pairs and keeps the weekday half-day exceptions', () => {
  const { contarCoincidenciaTotal_, contarDiasCoincidentes_ } = loadControl();
  const rules = {
    CR: [1, 0, 0, 0, 0],
    AD: [1, 0, 0, 0, 0],
    LH: [1, 0, 0, 0, 0]
  };
  assert.equal(contarCoincidenciaTotal_(['CR', 'AD', 'LH'], rules), 3);
  const halfDayPairs = [
    ['CH', 'FL', 0], ['RO', 'AA', 1], ['DE', 'BA', 2], ['LC', 'GU', 2],
    ['RO', 'AA', 3], ['L2', 'BA', 4], ['GB', 'AA', 4]
  ];
  for (const [siglaA, siglaB, weekday] of halfDayPairs) {
    const daysA = [0, 0, 0, 0, 0];
    const daysB = [0, 0, 0, 0, 0];
    daysA[weekday] = 1;
    daysB[weekday] = 1;
    assert.equal(contarDiasCoincidentes_(daysA, daysB, siglaA, siglaB), 0.5, `${siglaA}/${siglaB} weekday ${weekday}`);
  }
});
