import { buildScheduleMarkup } from './schedule-view.js';

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
        ${buildScheduleMarkup(months)}
      </section>
    </main>`;
}

export function registerServiceWorker() {
  return 'serviceWorker' in navigator ? navigator.serviceWorker.register('./sw.js') : Promise.resolve(null);
}
