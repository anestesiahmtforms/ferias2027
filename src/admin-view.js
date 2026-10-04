export function validateAdminPin(pin) {
  return /^\d{6}$/.test(String(pin || ''))
    ? { ok: true }
    : { ok: false, message: 'O PIN administrativo deve conter seis dígitos.' };
}

export function validateOverrideForm({ vaga, value, justification }) {
  if (!String(vaga || '').trim()) return { ok: false, message: 'Selecione uma vaga.' };
  if (!String(value || '').trim()) return { ok: false, message: 'Informe a sigla.' };
  if (!String(justification || '').trim()) return { ok: false, message: 'A justificativa é obrigatória.' };
  return { ok: true };
}

export function openAdminPanel({ api, onRefresh = () => {} }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="booking-modal admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title">
    <button class="modal-close" type="button" aria-label="Fechar">×</button>
    <h2 id="admin-title">Gestão administrativa</h2>
    <p>Informe o PIN administrativo para consultar a escala e a auditoria.</p>
    <label>PIN administrativo<input name="admin-pin" inputmode="numeric" maxlength="6" autocomplete="off" /></label>
    <p class="form-error" aria-live="polite"></p>
    <button class="primary admin-submit" type="button">Acessar gestão</button>
    <div class="admin-content"></div>
  </section>`;
  const modal = backdrop.querySelector('.admin-modal');
  const error = backdrop.querySelector('.form-error');
  backdrop.querySelector('.modal-close').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('.admin-submit').addEventListener('click', async () => {
    const pin = backdrop.querySelector('[name="admin-pin"]').value;
    const valid = validateAdminPin(pin);
    if (!valid.ok) { error.textContent = valid.message; return; }
    const result = await api.authenticateAdmin(pin);
    if (!result.ok) { error.textContent = result.mensagem || 'PIN inválido.'; return; }
    modal.querySelector('.admin-submit').remove();
    modal.querySelector('[name="admin-pin"]').closest('label').remove();
    modal.querySelector('p').remove();
    error.remove();
    modal.querySelector('.admin-content').innerHTML = `<p class="admin-ok">Acesso autorizado.</p><div class="audit-list">${(result.auditoria || []).map(item => `<div><strong>${item.sigla || '—'}</strong> · ${item.vaga || '—'}<small>${item.timestamp || ''} · ${item.result || ''}</small></div>`).join('') || '<p>Nenhum registro ainda.</p>'}</div><button class="secondary admin-refresh" type="button">Atualizar escala</button>`;
    modal.querySelector('.admin-refresh').addEventListener('click', () => { onRefresh(); backdrop.remove(); });
  });
  document.body.append(backdrop);
}
