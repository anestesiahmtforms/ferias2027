export function validateBookingForm({ sigla, pin }) {
  if (!String(sigla || '').trim()) return { ok: false, message: 'Selecione sua sigla.' };
  if (!/^\d{4}$/.test(String(pin || ''))) return { ok: false, message: 'Informe o PIN de quatro dígitos.' };
  return { ok: true };
}

export function openBookingModal(slotId, { siglas = [], submit = async () => ({ ok: false }), onDone = () => {} } = {}) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<section class="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
      <button class="modal-close" type="button" aria-label="Fechar">×</button>
      <h2 id="booking-title">Escolher semana</h2>
      <p>Informe sua sigla e o PIN de quatro dígitos.</p>
      <label>Sigla<select name="sigla"><option value="">Selecione</option>${siglas.map(sigla => `<option value="${escapeHtml(sigla)}">${escapeHtml(sigla)}</option>`).join('')}</select></label>
      <label>PIN<input name="pin" inputmode="numeric" maxlength="4" autocomplete="one-time-code" /></label>
      <p class="form-error" aria-live="polite"></p>
      <button class="primary modal-submit" type="button">Confirmar escolha</button>
    </section>`;
    const close = result => { backdrop.remove(); resolve(result); };
    backdrop.querySelector('.modal-close').addEventListener('click', () => close({ ok: false, cancelled: true }));
    backdrop.querySelector('.modal-submit').addEventListener('click', async () => {
      const sigla = backdrop.querySelector('[name="sigla"]').value;
      const pin = backdrop.querySelector('[name="pin"]').value;
      const form = validateBookingForm({ sigla, pin });
      if (!form.ok) { backdrop.querySelector('.form-error').textContent = form.message; return; }
      const button = backdrop.querySelector('.modal-submit');
      button.disabled = true;
      const result = await submit({ sigla, pin, vaga: slotId });
      if (result.ok) { onDone(result); close(result); }
      else { button.disabled = false; backdrop.querySelector('.form-error').textContent = result.mensagem || 'A escolha foi recusada.'; }
    });
    document.body.append(backdrop);
  });
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
