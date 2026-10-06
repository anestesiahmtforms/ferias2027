import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildBackendSource, globalIdentifiers, normalizeLineEndings } from '../../scripts/build-apps-script.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = relative => normalizeLineEndings(fs.readFileSync(path.join(root, relative), 'utf8'));

test('generated backend is derived from Code.gs and keeps only doGet/doPost public', () => {
  const canonical = read('apps-script/Code.gs');
  const generated = read('apps-script/PWA_Backend.gs');
  assert.equal(generated, buildBackendSource(canonical));
  assert.match(generated, /^function doGet\(/m);
  assert.match(generated, /^function doPost\(/m);
  assert.match(generated, /^const pwa_CONFIG\s*=/m);
  assert.match(generated, /^function pwa_validarReserva_\(/m);
  assert.doesNotMatch(generated, /^function validarReserva_\(/m);
  const generatedGlobals = new Set(globalIdentifiers(generated));
  for (const name of globalIdentifiers(canonical)) {
    assert.ok(generatedGlobals.has(['doGet', 'doPost'].includes(name) ? name : `pwa_${name}`), `${name} must be namespaced or remain a public entrypoint`);
  }
});

test('prefixed backend still validates a reservation through namespaced helpers', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(read('apps-script/PWA_Backend.gs'), context);
  const result = context.pwa_validarReserva_({
    sigla: 'FR', month: 'fevereiro', slotIndex: 0, round: 'individual',
    allowedSiglas: { FR: true }, weeksForSigla: 0, weekValues: [], currentValue: ''
  });
  assert.equal(result.ok, true);
  const blocked = context.pwa_mensagemResultado_({ codigo: 'SIGLA3_BLOQUEADA_TOLERANCIA', overlapDays: 3 });
  assert.match(blocked.mensagem, /3 dias úteis/);
});

test('SpreadsheetControl and generated backend compile together without global-name collisions', () => {
  const control = read('apps-script/SpreadsheetControl.gs');
  const backend = read('apps-script/PWA_Backend.gs');
  const collisions = globalIdentifiers(control).filter(name => globalIdentifiers(backend).includes(name));
  assert.deepEqual(collisions, []);
  assert.doesNotThrow(() => new vm.Script(`${control}\n${backend}`, { filename: 'combined-apps-script.gs' }));
});

test('canonical backend and direct-sheet controller keep the same booking order and phase one quota group', () => {
  const backendContext = {};
  const controlContext = {};
  vm.createContext(backendContext);
  vm.createContext(controlContext);
  vm.runInContext(read('apps-script/Code.gs'), backendContext);
  vm.runInContext(read('apps-script/SpreadsheetControl.gs'), controlContext);
  assert.deepEqual(
    Array.from(vm.runInContext('CONFIG.bookingSequence', backendContext)),
    Array.from(vm.runInContext('CONFIG.sequenciaMarcacao', controlContext))
  );
  assert.deepEqual(
    Array.from(vm.runInContext('CONFIG.singleWeekSiglas', backendContext)),
    Array.from(vm.runInContext('CONFIG.siglasUmaSemana', controlContext))
  );
});

test('generated backend artifact stays synchronized with its canonical source', () => {
  const source = read('apps-script/Code.gs');
  assert.equal(read('apps-script/PWA_Backend.gs'), buildBackendSource(source));
  assert.equal(buildBackendSource(source.replace(/\n/g, '\r\n')), buildBackendSource(source));
});

test('generator --check accepts the checked-in backend artifact', () => {
  const generator = path.join(root, 'scripts', 'build-apps-script.mjs');
  const result = spawnSync(process.execPath, [generator, '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
