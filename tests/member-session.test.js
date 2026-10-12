import assert from 'node:assert/strict';
import test from 'node:test';
import { clearMemberSession, loadMemberSession, saveMemberSession } from '../src/member-session.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test('restores the active member session after the app is reopened', () => {
  const storage = memoryStorage();
  saveMemberSession(storage, { sigla: 'CR', token: 'token-aberto' });
  assert.deepEqual(loadMemberSession(storage), { sigla: 'CR', token: 'token-aberto' });
  clearMemberSession(storage);
  assert.equal(loadMemberSession(storage), null);
});
