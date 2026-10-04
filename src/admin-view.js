export function validateAdminPin(pin) {
  return /^\d{6}$/.test(String(pin || ''))
    ? { ok: true }
    : { ok: false, message: 'O PIN administrativo deve conter seis dígitos.' };
}

export function validateOverrideForm({ vaga, value, justification }) {
  if (!String(vaga || '').trim()) return { ok: false, message: 'Selecione uma vaga.' };
  if (!String(justification || '').trim()) return { ok: false, message: 'A justificativa é obrigatória.' };
  return { ok: true };
}

export function openAdminPanel({ api, onRefresh = () => {} }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="booking-modal admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title">
    <button class="modal-close" type="button" aria-label="Fechar">×</button>
    <h2 id="admin-title">Gestão administrativa</h2>
    <p>Informe o PIN administrativo para consultar e corrigir a escala.</p>
    <label>PIN administrativo<input name="admin-pin" inputmode="numeric" maxlength="6" autocomplete="off" /></label>
    <p class="form-error" aria-live="polite"></p>
    <button class="primary admin-submit" type="button">Acessar gestão</button>
    <div class="admin-content"></div>
  </section>`;
  const modal = backdrop.querySelector('.admin-modal');
  const error = backdrop.querySelector('.form-error');
  const content = backdrop.querySelector('.admin-content');
  let adminPin = '';

  backdrop.querySelector('.modal-close').addEventListener('click', () => backdrop.remove());

  function renderAdminContent(result, notice = '') {
    content.replaceChildren();
    const access = document.createElement('p');
    access.className = 'admin-ok';
    access.textContent = notice || 'Acesso autorizado. As correções administrativas não aplicam as regras normais de escolha.';
    content.append(access);

    const form = document.createElement('form');
    form.className = 'admin-override';
    const slotLabel = document.createElement('label');
    slotLabel.textContent = 'Lançamento';
    const slotSelect = document.createElement('select');
    slotSelect.name = 'admin-slot';
    slotSelect.required = true;
    const byId = new Map();
    (result.escala || []).forEach(month => {
      const group = document.createElement('optgroup');
      group.label = month.name || month.id;
      (month.weeks || []).forEach(week => {
        (week.slots || []).forEach(slot => {
          const option = document.createElement('option');
          option.value = slot.id;
          option.textContent = `${week.label || week.id} · ${week.period || ''} · ${slot.label || 'Sigla'}: ${slot.value || 'vazia'}`;
          group.append(option);
          byId.set(slot.id, slot);
        });
      });
      if (group.children.length) slotSelect.append(group);
    });
    slotLabel.append(slotSelect);

    const valueLabel = document.createElement('label');
    valueLabel.textContent = 'Sigla a registrar';
    const valueInput = document.createElement('input');
    valueInput.name = 'admin-value';
    valueInput.type = 'text';
    valueInput.maxLength = 50000;
    valueInput.autocomplete = 'off';
    valueLabel.append(valueInput);

    const justificationLabel = document.createElement('label');
    justificationLabel.textContent = 'Justificativa (obrigatória)';
    const justificationInput = document.createElement('textarea');
    justificationInput.name = 'admin-justification';
    justificationInput.rows = 3;
    justificationInput.required = true;
    justificationLabel.append(justificationInput);

    const formError = document.createElement('p');
    formError.className = 'form-error';
    formError.setAttribute('aria-live', 'polite');
    const submit = document.createElement('button');
    submit.className = 'primary';
    submit.type = 'submit';
    submit.textContent = 'Aplicar correção';
    form.append(slotLabel, valueLabel, justificationLabel, formError, submit);
    content.append(form);

    const auditHeading = document.createElement('h3');
    auditHeading.textContent = 'Auditoria recente';
    content.append(auditHeading);
    const auditList = document.createElement('div');
    auditList.className = 'audit-list';
    (result.auditoria || []).forEach(item => {
      const row = document.createElement('div');
      const summary = document.createElement('strong');
      summary.textContent = `${item.sigla || '—'} · ${item.vaga || '—'}`;
      const detail = document.createElement('small');
      detail.textContent = `${item.timestamp || ''} · ${item.result || ''}`;
      row.append(summary, detail);
      auditList.append(row);
    });
    if (!auditList.children.length) {
      const empty = document.createElement('p');
      empty.textContent = 'Nenhum registro ainda.';
      auditList.append(empty);
    }
    content.append(auditList);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const values = { vaga: slotSelect.value, value: valueInput.value, justification: justificationInput.value };
      const validation = validateOverrideForm(values);
      if (!validation.ok) { formError.textContent = validation.message; return; }
      if (!window.confirm('Confirmar a correção deste lançamento?')) return;
      submit.disabled = true;
      formError.textContent = '';
      try {
        const saved = await api.overrideSlot(values.vaga, values.value, values.justification, adminPin);
        if (!saved.ok) { formError.textContent = saved.mensagem || 'Não foi possível aplicar a correção.'; submit.disabled = false; return; }
        const refreshed = await api.authenticateAdmin(adminPin);
        if (refreshed.ok) renderAdminContent(refreshed, 'Correção aplicada e registrada na auditoria.');
        else { onRefresh(); renderAdminContent({ escala: saved.escala, auditoria: [] }, 'Correção aplicada. Atualize a página para recarregar a escala.'); }
      } catch (_error) {
        formError.textContent = 'Falha de conexão. Confira a escala antes de tentar novamente.';
        submit.disabled = false;
      }
    });
  }

  backdrop.querySelector('.admin-submit').addEventListener('click', async () => {
    const pin = backdrop.querySelector('[name="admin-pin"]').value;
    const valid = validateAdminPin(pin);
    if (!valid.ok) { error.textContent = valid.message; return; }
    const submit = backdrop.querySelector('.admin-submit');
    submit.disabled = true;
    try {
      const result = await api.authenticateAdmin(pin);
      if (!result.ok) { error.textContent = result.mensagem || 'PIN inválido.'; submit.disabled = false; return; }
      adminPin = pin;
      modal.querySelector('[name="admin-pin"]').closest('label').remove();
      submit.remove();
      modal.querySelector('p').remove();
      error.remove();
      renderAdminContent(result);
    } catch (_error) {
      error.textContent = 'Falha de conexão. Tente novamente.';
      submit.disabled = false;
    }
  });
  document.body.append(backdrop);
}

