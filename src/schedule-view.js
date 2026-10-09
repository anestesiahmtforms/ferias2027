export function buildScheduleMarkup(months = []) {
  return months.length
    ? months.map(renderMonth).join('')
    : '<div class="empty">A escala será carregada aqui.</div>';
}

export function renderSchedule(root, schedule, { onSlot = () => {} } = {}) {
  root.innerHTML = buildScheduleMarkup(schedule);
  root.querySelectorAll('[data-slot]').forEach(button => {
    button.addEventListener('click', () => onSlot(button.dataset.slot));
  });
}

function renderMonth(month) {
  const blockedMonthClass = month.blocked ? ' blocked-month' : '';
  const weeks = (month.weeks || []).filter(week => week.period || (week.slots || []).some(slot => slot.value));
  return `<article class="month-card">
    <div class="schedule-table-wrap">
      <table class="schedule-table" aria-label="Escala de ${escapeHtml(month.name)}">
        <colgroup><col class="schedule-week-column"><col class="schedule-period-column"><col><col><col></colgroup>
        <thead>
          <tr><th class="month-title" colspan="5"><div><h2>${escapeHtml(month.name)}</h2>${month.phase && month.phase !== 'Rodada individual' ? `<span>${escapeHtml(month.phase)}</span>` : ''}</div></th></tr>
          <tr class="column-headings"><th scope="col">SEMANA</th><th scope="col">PERÍODO</th><th scope="col" aria-label="Sigla 1"></th><th scope="col" aria-label="Sigla 2"></th><th scope="col" aria-label="Sigla 3"></th></tr>
        </thead>
        <tbody>${weeks.map(week => `<tr>
          <th class="week-label" scope="row">${escapeHtml(week.label)}</th>
          <td class="week-period">${escapeHtml(week.period)}</td>
          ${(week.slots || []).map(slot => `<td class="slot-cell${blockedMonthClass}"><button class="slot ${escapeHtml(slot.state || 'available')}${slot.canClear ? ' clearable' : ''}${blockedMonthClass}" type="button" aria-label="${escapeHtml(`${slot.label || 'Sigla'} ${slot.value ? slot.value : 'vaga vazia'}, ${week.label}, ${week.period}${slot.canClear ? ', toque para limpar sua escolha' : ''}${slot.blockedReason ? `, ${slot.blockedReason}` : ''}`)}" title="${escapeHtml(slot.blockedReason || '')}" ${slot.disabled ? 'disabled' : ''} data-blocked-reason="${escapeHtml(slot.blockedReason || '')}" data-clear-own="${slot.canClear ? 'true' : 'false'}" data-slot="${escapeHtml(slot.id)}">${escapeHtml(slot.value || '')}</button></td>`).join('')}
        </tr>`).join('')}</tbody>
      </table>
    </div>
  </article>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
