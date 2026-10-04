import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScheduleMarkup } from '../src/schedule-view.js';
import { createApi } from '../src/api.js';
import { validateBookingForm } from '../src/booking-modal.js';

const schedule = [{
  name: 'JANEIRO',
  blocked: true,
  phase: 'Rodada individual',
  weeks: [{
    label: '2ª semana', period: '04 A 10/01',
    slots: [{ id: 'janeiro-0-0', label: 'SIGLA 1', value: 'RO', state: 'filled', disabled: true }, { id: 'janeiro-0-1', label: 'SIGLA 2', state: 'locked', disabled: true }]
  }]
}];

test('renders the spreadsheet-style date and horizontal sigla columns', () => {
  const html = buildScheduleMarkup(schedule);
  assert.match(html, /JANEIRO/);
  assert.match(html, /SEMANA/);
  assert.match(html, /PERÍODO/);
  assert.doesNotMatch(html, />SIGLA [123]<\/th>/);
  assert.doesNotMatch(html, /Rodada individual/);
  assert.match(html, /04 A 10\/01/);
  assert.match(html, /RO/);
  assert.match(html, /disabled/);
  assert.match(html, /<td class="slot-cell"><button[^>]*><\/button><\/td>/);
});

test('API adapter sends reservation as a JSON request', async () => {
  let captured;
  const api = createApi('https://example.test', async (_url, options) => {
    captured = JSON.parse(options.body);
    return { json: async () => ({ ok: true, codigo: 'OK' }) };
  });
  const result = await api.submitReservation({ sigla: 'FR', pin: '1234', vaga: 'fevereiro-0-0' });
  assert.equal(result.codigo, 'OK');
  assert.deepEqual(captured, { action: 'reserve', sigla: 'FR', pin: '1234', vaga: 'fevereiro-0-0' });
});

test('booking form requires a four-digit PIN and sigla', () => {
  assert.equal(validateBookingForm({ sigla: '', pin: '1234' }).ok, false);
  assert.equal(validateBookingForm({ sigla: 'FR', pin: '123' }).ok, false);
  assert.equal(validateBookingForm({ sigla: 'FR', pin: '1234' }).ok, true);
});
