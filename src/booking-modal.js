export function validateBookingForm({ sigla, pin }) {
  if (!String(sigla || '').trim()) return { ok: false, message: 'Selecione sua sigla.' };
  if (!/^\d{4}$/.test(String(pin || ''))) return { ok: false, message: 'Informe o PIN de quatro dígitos.' };
  return { ok: true };
}

export function openBookingModal(slotId, { siglas = [], session = null, startSession = async () => ({ ok: false }), submit = async () => ({ ok: false }), onSession = async () => {}, onDone = () => {}, onFailure = () => {} } = {}) {
  return new Promise(resolve => {
    let currentSession = session;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<section class="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
      <button class="modal-close" type="button" aria-label="Fechar">×</button>
      <h2 id="booking-title">Escolher semana</h2>
      <p class="booking-session-note">${currentSession ? `Sessão ativa para ${escapeHtml(currentSession.sigla)}. Você poderá limpar suas próprias escolhas antes de encerrar.` : 'Informe sua sigla e o PIN de quatro dígitos para iniciar a sessão de lançamento.'}</p>
      <label class="booking-credentials" ${currentSession ? 'hidden' : ''}>Sigla<select name="sigla"><option value="">Selecione</option>${siglas.map(sigla => `<option value="${escapeHtml(sigla)}">${escapeHtml(sigla)}</option>`).join('')}</select></label>
      <label class="booking-credentials" ${currentSession ? 'hidden' : ''}>PIN<input name="pin" inputmode="numeric" maxlength="4" autocomplete="one-time-code" /></label>
      <p class="form-error" aria-live="polite"></p>
      <button class="primary modal-submit" type="button">Confirmar escolha</button>
    </section>`;
    const close = result => { backdrop.remove(); resolve(result); };
    const button = backdrop.querySelector('.modal-submit');
    const error = backdrop.querySelector('.form-error');
    backdrop.querySelector('.modal-close').addEventListener('click', () => close({ ok: false, cancelled: true }));
    button.addEventListener('click', async () => {
      if (!currentSession) {
        const sigla = backdrop.querySelector('[name="sigla"]').value;
        const pin = backdrop.querySelector('[name="pin"]').value;
        const form = validateBookingForm({ sigla, pin });
        if (!form.ok) { error.textContent = form.message; return; }
        button.disabled = true;
        error.textContent = '';
        let started;
        try { started = await startSession(sigla, pin); }
        catch (_error) { started = { ok: false, mensagem: 'Falha de conexão ao iniciar a sessão.' }; }
        if (!started.ok) {
          button.disabled = false;
          error.textContent = started.mensagem || 'Não foi possível iniciar a sessão.';
          return;
        }
        currentSession = { sigla: started.sigla, token: started.sessionToken };
        backdrop.querySelectorAll('.booking-credentials').forEach(label => { label.hidden = true; });
        backdrop.querySelector('.booking-session-note').textContent = `Sessão ativa para ${currentSession.sigla}. Você poderá limpar suas próprias escolhas antes de encerrar.`;
        await onSession(currentSession);
      }

      button.disabled = true;
      error.classList.remove('overlap-warning');
      error.textContent = '';
      let result;
      try { result = await submit({ sigla: currentSession.sigla, vaga: slotId, sessionToken: currentSession.token }); }
      catch (_error) { result = { ok: false, mensagem: 'Falha de conexão. Sua sessão continua ativa; confira a escala antes de tentar novamente.' }; }
      if (result.ok) { onDone(result); close(result); }
      else {
        button.disabled = false;
        error.textContent = result.mensagem || 'A escolha foi recusada.';
        if (['COINCIDENCIA_DIAS', 'SIGLA3_BLOQUEADA_TOLERANCIA'].includes(result.codigo)) error.classList.add('overlap-warning');
        onFailure(result);
      }
    });
    document.body.append(backdrop);
  });
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
