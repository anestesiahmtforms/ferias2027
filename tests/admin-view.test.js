import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAdminPin, validateOverrideForm } from '../src/admin-view.js';

test('admin PIN requires six digits', () => {
  assert.equal(validateAdminPin('99039').ok, false);
  assert.equal(validateAdminPin('990399').ok, true);
});

test('administrative override requires a justification', () => {
  assert.equal(validateOverrideForm({ vaga: 'fevereiro-0-0', value: 'FR', justification: '' }).ok, false);
  assert.equal(validateOverrideForm({ vaga: 'fevereiro-0-0', value: 'FR', justification: 'Correção autorizada' }).ok, true);
});
