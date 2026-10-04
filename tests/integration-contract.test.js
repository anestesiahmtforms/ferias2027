import assert from 'node:assert/strict';
import test from 'node:test';
import { createApi } from '../src/api.js';

test('contract handles schedule read and reservation success', async () => {
  const responses = [
    { ok: true, codigo: 'OK', escala: [{ name: 'FEVEREIRO' }], siglas: ['FR'] },
    { ok: true, codigo: 'OK', mensagem: 'Escolha confirmada.' }
  ];
  const api = createApi('https://service.test', async (_url, options) => ({
    json: async () => options ? responses[1] : responses[0]
  }));
  const schedule = await api.fetchSchedule();
  const reservation = await api.submitReservation({ sigla: 'FR', pin: '1234', vaga: 'fevereiro-0-0' });
  assert.equal(schedule.escala[0].name, 'FEVEREIRO');
  assert.equal(reservation.codigo, 'OK');
});

test('contract preserves server rejection messages', async () => {
  const api = createApi('https://service.test', async () => ({
    json: async () => ({ ok: false, codigo: 'MES_BLOQUEADO', mensagem: 'Janeiro e julho estão bloqueados nesta rodada.' })
  }));
  const result = await api.submitReservation({ sigla: 'FR', pin: '1234', vaga: 'janeiro-0-0' });
  assert.equal(result.ok, false);
  assert.match(result.mensagem, /bloqueados/);
});
