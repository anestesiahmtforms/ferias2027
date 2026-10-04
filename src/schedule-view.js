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
  return `<article class="month-card">
    <div class="month-heading"><h2>${escapeHtml(month.name)}</h2><span>${escapeHtml(month.phase || '')}</span></div>
    <div class="weeks">${(month.weeks || []).map(week => `<div class="week-row">
      <div class="week-info"><strong>${escapeHtml(week.label)}</strong><small>${escapeHtml(week.period)}</small></div>
      <div class="slots">${(week.slots || []).map(slot => `<button class="slot ${escapeHtml(slot.state || 'available')}" type="button" ${slot.disabled ? 'disabled' : ''} data-slot="${escapeHtml(slot.id)}">${escapeHtml(slot.value || '')}</button>`).join('')}</div>
    </div>`).join('')}</div>
  </article>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
