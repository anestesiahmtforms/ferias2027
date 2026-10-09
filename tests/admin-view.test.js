import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminInvite, validateAdminPin, validateOverrideForm } from '../src/admin-view.js';

test('admin PIN requires six digits', () => {
  assert.equal(validateAdminPin('99039').ok, false);
  assert.equal(validateAdminPin('990399').ok, true);
});

test('administrative override accepts free text or clearing but requires justification', () => {
  assert.equal(validateOverrideForm({ vaga: 'fevereiro-0-0', value: 'FR', justification: '' }).ok, false);
  assert.equal(validateOverrideForm({ vaga: 'fevereiro-0-0', value: 'Afastado ✓ + cobertura', justification: 'Correção autorizada' }).ok, true);
  assert.equal(validateOverrideForm({ vaga: 'fevereiro-0-0', value: '', justification: 'Remoção autorizada' }).ok, true);
});

test('admin invitation includes the public link and the next sigla PIN', () => {
  const invite = createAdminInvite({ sigla: 'XX', pin: '1234' }, 'https://anestesiahmtforms.github.io/ferias2027/');
  assert.equal(invite.recipient, '');
  assert.match(invite.text, /PIN de acesso: 1234/);
  assert.match(invite.text, /Você deverá selecionar \*2 semanas\*/);
  assert.match(invite.text, /https:\/\/anestesiahmtforms\.github\.io\/ferias2027\//);
});
