import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCompletedVacationChoices } from '../src/booking-modal.js';

function scheduleWithWeeks(sigla, count) {
  return {
    ok: true,
    escala: [{
      id: 'fevereiro',
      weeks: Array.from({ length: count }, (_, index) => ({
        id: `week-${index + 1}`,
        slots: [{ value: sigla }]
      }))
    }]
  };
}

test('keeps a member session open until four total vacation markings', () => {
  assert.equal(hasCompletedVacationChoices(scheduleWithWeeks('CR', 2), 'CR'), false);
  assert.equal(hasCompletedVacationChoices(scheduleWithWeeks('CR', 3), 'CR'), false);
  assert.equal(hasCompletedVacationChoices(scheduleWithWeeks('CR', 4), 'CR'), true);
});
