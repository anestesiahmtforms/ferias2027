export function renderApp(root, model = {}) {
  const months = model.months || [];
  root.innerHTML = `
    <main class="shell">
      <header class="app-header">
        <img class="brand" src="./assets/sahmt-logo.svg" alt="Logo SAHMT" />
        <div>
          <p class="eyebrow">SAHMT</p>
          <h1>Escala de férias 2027</h1>
          <p class="subtitle">Escolha protegida e atualizada em tempo real.</p>
        </div>
      </header>
      <section class="status-card" aria-live="polite">
        <span class="status-dot"></span>
        <span>${model.status || 'Carregando escala...'}</span>
      </section>
      <section class="toolbar" aria-label="Ações">
        <button class="primary" type="button" data-action="refresh">Atualizar escala</button>
        <button class="secondary" type="button" data-action="admin">Gestão administrativa</button>
      </section>
      <section class="schedule-grid" aria-label="Escala de férias">
        ${months.length ? months.map(renderMonth).join('') : '<div class="empty">A escala será carregada aqui.</div>'}
      </section>
    </main>`;
}

function renderMonth(month) {
  return `<article class="month-card">
    <div class="month-heading"><h2>${month.name}</h2><span>${month.phase || ''}</span></div>
    <div class="weeks">${(month.weeks || []).map(week => `<div class="week-row">
      <div class="week-info"><strong>${week.label}</strong><small>${week.period}</small></div>
      <div class="slots">${(week.slots || []).map(slot => `<button class="slot ${slot.state || 'available'}" type="button" ${slot.disabled ? 'disabled' : ''} data-slot="${slot.id}">${slot.value || slot.label || 'Livre'}</button>`).join('')}</div>
    </div>`).join('')}</div>
  </article>`;
}

export function registerServiceWorker() {
  return 'serviceWorker' in navigator ? navigator.serviceWorker.register('./sw.js') : Promise.resolve(null);
}
