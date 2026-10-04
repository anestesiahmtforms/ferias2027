import './styles.css';
import { renderApp, registerServiceWorker } from './app.js';
import { createApi } from './api.js';
import { openBookingModal } from './booking-modal.js';
import { openAdminPanel } from './admin-view.js';

const root = document.querySelector('#app');
const endpoint = import.meta.env.VITE_APPS_SCRIPT_WEB_APP_URL || '';
const api = createApi(endpoint);

async function boot() {
  renderApp(root, { status: endpoint ? 'Atualizando escala...' : 'Serviço ainda não configurado.' });
  if (!endpoint) return;
  try {
    const response = await api.fetchSchedule();
    renderApp(root, { status: 'Escala atualizada.', months: response.escala || [] });
    wireInteractions(response.siglas || []);
  } catch (_error) {
    renderApp(root, { status: 'Não foi possível atualizar. Consulte novamente quando houver conexão.' });
  }
}

function wireInteractions(siglas) {
  root.querySelector('[data-action="refresh"]')?.addEventListener('click', boot);
  root.querySelector('[data-action="admin"]')?.addEventListener('click', () => {
    openAdminPanel({ api, onRefresh: boot });
  });
  root.querySelectorAll('[data-slot]').forEach(button => {
    if (button.disabled) return;
    button.addEventListener('click', () => openBookingModal(button.dataset.slot, {
      siglas,
      submit: values => api.submitReservation(values),
      onDone: boot
    }));
  });
}

registerServiceWorker().catch(() => {});
boot();
