import { WHATSAPP_CONTACTS } from './whatsapp-contacts.js';

const WHATSAPP_INVITE_TEXT = 'Olá! Agora é sua vez de escolher suas férias de 2027.\n\nVocê deverá selecionar *2 semanas*, respeitando as regras de coincidência: será permitida a sobreposição de até *3 dias na mesma semana*, desde que *não haja coincidência de 3 profissionais no sábado*.';

export function createAdminInvite(nextInvite, appUrl) {
  const sigla = String(nextInvite?.sigla || '').trim().toUpperCase();
  const pin = String(nextInvite?.pin || '').trim();
  if (!sigla || !/^\d{4}$/.test(pin)) return null;
  return {
    sigla,
    pin,
    recipient: WHATSAPP_CONTACTS[sigla] || '',
    text: `${WHATSAPP_INVITE_TEXT}\n\nAcesse a escala: ${appUrl}\nPIN de acesso: ${pin}`
  };
}

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

export function openAdminPanel({ api, onRefresh = () => {}, appUrl = window.location.href }) {
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

  function showFirstInvite(data) {
    const invite = createAdminInvite(data, appUrl);
    if (!invite) return;
    const overlay = document.createElement('div');
    overlay.className = 'admin-invite-overlay';
    const dialog = document.createElement('section');
    dialog.className = 'admin-invite-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const heading = document.createElement('h2');
    heading.textContent = 'Iniciar segunda fase';
    const detail = document.createElement('p');
    detail.textContent = 'Primeiro da lista: ' + invite.sigla + ' · PIN ' + invite.pin;
    const send = document.createElement('a');
    send.className = 'primary admin-invite-action';
    send.textContent = 'Enviar convite pelo WhatsApp';
    send.target = '_blank';
    send.rel = 'noopener noreferrer';
    const url = new URL(invite.recipient ? 'https://wa.me/' + invite.recipient : 'https://wa.me/');
    url.searchParams.set('text', invite.text);
    send.href = url.href;
    send.addEventListener('click', () => overlay.remove());
    const dismiss = document.createElement('button');
    dismiss.className = 'secondary';
    dismiss.textContent = 'Agora não';
    dismiss.addEventListener('click', () => overlay.remove());
    dialog.append(heading, detail, send, dismiss);
    overlay.append(dialog);
    backdrop.append(overlay);
  }

  function renderAdminContent(result, notice = '') {
    content.replaceChildren();
    const access = document.createElement('p');
    access.className = 'admin-ok';
    access.textContent = notice || 'Acesso autorizado. As correções administrativas não aplicam as regras normais de escolha.';
    content.append(access);

    const invite = createAdminInvite(result.proximoConvite, appUrl);
    if (invite) {
      const inviteCard = document.createElement('section');
      inviteCard.className = 'admin-invite';
      const title = document.createElement('h3');
      title.textContent = 'Próxima escolha da fila';
      const detail = document.createElement('p');
      detail.textContent = `Sigla ${invite.sigla} · PIN ${invite.pin}`;
      const action = document.createElement('a');
      action.className = 'primary admin-invite-action';
      action.target = '_blank';
      action.rel = 'noopener noreferrer';
      if (invite.recipient) {
        const destination = new URL(`https://wa.me/${invite.recipient}`);
        destination.searchParams.set('text', invite.text);
        action.href = destination.href;
        action.textContent = `Enviar convite para ${invite.sigla} no WhatsApp`;
      } else {
        action.href = `https://wa.me/?text=${encodeURIComponent(invite.text)}`;
        action.textContent = `Preparar convite para ${invite.sigla} no WhatsApp`;
      }
      inviteCard.append(title, detail, action);
      content.append(inviteCard);
    }

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
          const overlapDays = Number(slot.overlapDays || 0);
          const formattedOverlap = String(overlapDays).replace('.', ',');
          const overlapNote = overlapDays > 0 ? ` · ${formattedOverlap} ${overlapDays === 1 || overlapDays < 1 ? 'dia coincidente' : 'dias coincidentes'}` : '';
          const blockedNote = slot.blockedReason ? ` · ${slot.blockedReason}` : '';
          option.textContent = `${week.label || week.id} · ${week.period || ''} · ${slot.label || 'Sigla'}: ${slot.value || 'vazia'}${overlapNote}${blockedNote}`;
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

    const reopenForm = document.createElement('form');
    reopenForm.className = 'admin-reopen';
    const reopenLabel = document.createElement('label');
    reopenLabel.textContent = 'Reabrir sessão de lançamento';
    const reopenSelect = document.createElement('select');
    reopenSelect.name = 'reopen-sigla';
    reopenSelect.required = true;
    reopenSelect.innerHTML = '<option value="">Selecione a sigla</option>';
    (result.siglas || []).forEach(sigla => {
      const option = document.createElement('option');
      option.value = sigla;
      option.textContent = sigla;
      reopenSelect.append(option);
    });
    reopenLabel.append(reopenSelect);
    const reopenError = document.createElement('p');
    reopenError.className = 'form-error';
    reopenError.setAttribute('aria-live', 'polite');
    const reopenButton = document.createElement('button');
    reopenButton.className = 'secondary';
    reopenButton.type = 'submit';
    reopenButton.textContent = 'Reabrir acesso';
    reopenForm.append(reopenLabel, reopenError, reopenButton);
    content.append(reopenForm);

    reopenForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!reopenSelect.value) { reopenError.textContent = 'Selecione uma sigla.'; return; }
      if (!window.confirm(`Reabrir a sessão da sigla ${reopenSelect.value}?`)) return;
      reopenButton.disabled = true;
      reopenError.textContent = '';
      try {
        const reopened = await api.reopenMemberSession(reopenSelect.value, adminPin);
        if (!reopened.ok) { reopenError.textContent = reopened.mensagem || 'Não foi possível reabrir.'; reopenButton.disabled = false; return; }
        const refreshed = await api.authenticateAdmin(adminPin);
        if (refreshed.ok) renderAdminContent(refreshed, reopened.mensagem || 'Acesso reaberto.');
        else { onRefresh(); renderAdminContent({ escala: result.escala, auditoria: result.auditoria, siglas: result.siglas }, reopened.mensagem || 'Acesso reaberto.'); }
      } catch (_error) {
        reopenError.textContent = 'Falha de conexão. Confira o estado antes de tentar novamente.';
        reopenButton.disabled = false;
      }
    });

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
      detail.textContent = `${item.timestamp || ''} · ${item.type || ''} · ${item.result || ''}`;
      row.append(summary, detail);
      if (item.justification) {
        const explanation = document.createElement('small');
        explanation.textContent = item.justification;
        row.append(explanation);
      }
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
      showFirstInvite(result.proximoConvite);
    } catch (_error) {
      error.textContent = 'Falha de conexão. Tente novamente.';
      submit.disabled = false;
    }
  });
  document.body.append(backdrop);
}

