import './styles.css';
import { renderApp, registerServiceWorker } from './app.js';
import { createApi } from './api.js';
import { openBookingModal } from './booking-modal.js';
import { openAdminPanel } from './admin-view.js';

const root = document.querySelector('#app');
const endpoint = import.meta.env.VITE_APPS_SCRIPT_WEB_APP_URL || '';
const api = createApi(endpoint);
let activeSession = null;
let currentSchedule = null;
let currentSiglas = [];

function renderCurrentSchedule(status = 'Escala atualizada.') {
  renderApp(root, {
    status,
    months: currentSchedule?.escala || [],
    session: activeSession
  });
  wireInteractions(currentSiglas);
}

function applyScheduleResponse(response, status = 'Escala atualizada.') {
  if (!response?.ok || !Array.isArray(response.escala)) return false;
  currentSchedule = response;
  if (Array.isArray(response.siglas)) currentSiglas = response.siglas;
  renderCurrentSchedule(status);
  return true;
}

async function boot() {
  if (!endpoint) {
    renderApp(root, { status: 'Serviço ainda não configurado.', months: currentSchedule?.escala || [], session: activeSession });
    return;
  }
  if (!currentSchedule) renderApp(root, { status: 'Carregando escala...', session: activeSession });
  try {
    const response = await api.fetchSchedule(activeSession?.token);
    if (!response.ok) {
      if (activeSession && response.codigo === 'SESSAO_ENCERRADA') {
        activeSession = null;
        const publicResponse = await api.fetchSchedule();
        if (applyScheduleResponse(publicResponse, 'A sessão foi encerrada ou reaberta pelo administrador.')) return;
      }
      renderCurrentSchedule(response.mensagem || 'Não foi possível atualizar a escala.');
      return;
    }
    applyScheduleResponse(response);
  } catch (_error) {
    renderCurrentSchedule('Não foi possível atualizar. Consulte novamente quando houver conexão.');
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
          else if (!applyScheduleResponse(result)) await boot();
        } catch (_error) {
          window.alert('Falha de conexão ao limpar a escolha.');
          await boot();
        }
        return;
      }
      openBookingModal(button.dataset.slot, {
        siglas,
        session: activeSession,
        startSession: (sigla, pin) => api.startMemberSession(sigla, pin),
        submit: values => api.submitReservation(values),
        onSession: session => {
          activeSession = session;
          renderCurrentSchedule('Sessão de lançamento iniciada.');
        },
        onDone: result => {
          if (!applyScheduleResponse(result)) void boot();
        },
        onFailure: () => { void boot(); }
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
