import './styles.css';
import { renderApp, registerServiceWorker } from './app.js';
import { createApi } from './api.js';
import { openBookingModal } from './booking-modal.js';
import { openAdminPanel } from './admin-view.js';
import { WHATSAPP_CONTACTS, WHATSAPP_INVITE_TEXT } from './whatsapp-contacts.js';

const root = document.querySelector('#app');
const endpoint = import.meta.env.VITE_APPS_SCRIPT_WEB_APP_URL || '';
const api = createApi(endpoint);
let activeSession = null;
let currentSchedule = null;
let currentSiglas = [];
let whatsappInviteFallback = null;

function renderCurrentSchedule(status = 'Escala atualizada.') {
  renderApp(root, {
    status,
    months: currentSchedule?.escala || [],
    session: activeSession
  });
  renderWhatsAppInviteFallback();
  wireInteractions(currentSiglas);
}

function openWhatsAppInvite(sigla) {
  const nextSigla = String(sigla || '').trim().toUpperCase();
  const phone = WHATSAPP_CONTACTS[nextSigla];
  if (!phone) return;

  const appUrl = new URL(import.meta.env.BASE_URL || './', window.location.href).href;
  const destination = new URL(`https://wa.me/${phone}`);
  destination.searchParams.set('text', `${WHATSAPP_INVITE_TEXT}\n${appUrl}`);
  whatsappInviteFallback = { sigla: nextSigla, url: destination.href };

  let popup = null;
  try { popup = window.open(destination.href, '_blank'); } catch (_error) {}
  if (popup) {
    whatsappInviteFallback = null;
    try { popup.opener = null; } catch (_error) {}
    return;
  }
  renderWhatsAppInviteFallback();
}

function renderWhatsAppInviteFallback() {
  const status = root.querySelector('.status-card');
  if (!status) return;
  status.querySelector('.whatsapp-invite')?.remove();
  if (!whatsappInviteFallback) return;

  const notice = document.createElement('span');
  notice.className = 'whatsapp-invite';
  notice.setAttribute('role', 'status');
  notice.append(document.createTextNode(`A próxima sigla da fila é ${whatsappInviteFallback.sigla}. O WhatsApp não abriu automaticamente. `));
  const link = document.createElement('a');
  link.href = whatsappInviteFallback.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Abrir o convite para revisar e enviar';
  notice.append(link);
  status.append(notice);
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
    if (button.dataset.blockedReason) {
      button.addEventListener('click', () => window.alert(button.dataset.blockedReason));
      return;
    }
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
        onInvite: result => openWhatsAppInvite(result.proximaSiglaConvite),
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
