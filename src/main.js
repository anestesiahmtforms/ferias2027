import './styles.css';
import { renderApp, registerServiceWorker } from './app.js';
import { createApi } from './api.js';
import { openBookingModal } from './booking-modal.js';
import { openAdminPanel } from './admin-view.js';

const root = document.querySelector('#app');
const endpoint = import.meta.env.VITE_APPS_SCRIPT_WEB_APP_URL || '';
const api = createApi(endpoint);
let activeSession = null;

async function boot() {
  renderApp(root, { status: endpoint ? 'Atualizando escala...' : 'Serviço ainda não configurado.', session: activeSession });
  if (!endpoint) return;
  try {
    const response = await api.fetchSchedule(activeSession?.token);
    if (!response.ok) {
      if (activeSession && response.codigo === 'SESSAO_ENCERRADA') {
        activeSession = null;
        const publicResponse = await api.fetchSchedule();
        if (publicResponse.ok) {
          renderApp(root, { status: 'A sessão foi encerrada ou reaberta pelo administrador.', months: publicResponse.escala || [] });
          wireInteractions(publicResponse.siglas || []);
          return;
        }
      }
      renderApp(root, { status: response.mensagem || 'Não foi possível atualizar a escala.', session: activeSession });
      return;
    }
    renderApp(root, { status: 'Escala atualizada.', months: response.escala || [], session: activeSession });
    wireInteractions(response.siglas || []);
  } catch (_error) {
    renderApp(root, { status: 'Não foi possível atualizar. Consulte novamente quando houver conexão.', session: activeSession });
  }
}

function wireInteractions(siglas) {
  root.querySelector('[data-action="refresh"]')?.addEventListener('click', boot);
  root.querySelector('[data-action="admin"]')?.addEventListener('click', () => {
    openAdminPanel({ api, onRefresh: boot });
  });
  root.querySelector('[data-action="end-session"]')?.addEventListener('click', async event => {
    if (!activeSession || !window.confirm('Encerrar sua sessão? Depois disso, só o administrador poderá reabrir o acesso.')) return;
    event.currentTarget.disabled = true;
    const token = activeSession.token;
    activeSession = null;
    try {
      const result = await api.endMemberSession(token);
      if (!result.ok) window.alert(result.mensagem || 'A sessão não foi encerrada no servidor. Peça ao administrador que reabra o acesso.');
    } catch (_error) {
      window.alert('Não foi possível confirmar o encerramento. O administrador poderá reabrir o acesso se necessário.');
    }
    await boot();
  });
  root.querySelectorAll('[data-slot]').forEach(button => {
    if (button.disabled) return;
    button.addEventListener('click', async () => {
      if (button.dataset.clearOwn === 'true') {
        if (!window.confirm('Limpar sua escolha nesta sessão?')) return;
        try {
          const result = await api.cancelOwnReservation(button.dataset.slot, activeSession?.token);
          if (!result.ok) window.alert(result.mensagem || 'Não foi possível limpar a escolha.');
        } catch (_error) { window.alert('Falha de conexão ao limpar a escolha.'); }
        await boot();
        return;
      }
      openBookingModal(button.dataset.slot, {
        siglas,
        session: activeSession,
        startSession: (sigla, pin) => api.startMemberSession(sigla, pin),
        submit: values => api.submitReservation(values),
        onSession: async session => { activeSession = session; await boot(); },
        onDone: boot
      });
    });
  });
}

window.addEventListener('pagehide', () => {
  if (!activeSession || !endpoint || !navigator.sendBeacon) return;
  const payload = JSON.stringify({ action: 'sessionEnd', sessionToken: activeSession.token });
  navigator.sendBeacon(endpoint, new Blob([payload], { type: 'text/plain;charset=utf-8' }));
  activeSession = null;
});

window.addEventListener('pageshow', event => { if (event.persisted) boot(); });

registerServiceWorker().catch(() => {});
boot();
