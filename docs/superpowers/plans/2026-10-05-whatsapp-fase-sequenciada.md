# WhatsApp and phased vacation booking implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved phase quotas and coincidence rules, then prepare a WhatsApp invitation for the next queued sigla when the current sigla completes its quota.

**Architecture:** Apps Script remains authoritative for phase, quota, sequence, overlap, and invitation eligibility. By the user's explicit authorization, the 26 queued WhatsApp numbers live in a public PWA contact map; Apps Script returns only the next eligible sigla, and the PWA prepares and opens the conversation without sending it.

**Tech Stack:** Google Apps Script V8, Google Sheets, Vite, browser ES modules, WhatsApp click-to-chat URL.

**Spec:** `docs/specs/2026-10-05-fase-atual-e-convites-whatsapp.md`

## Global Constraints

- Preserve existing reservations and never alter, expose, or regenerate PINs.
- Current phase quota: one new week for the January/July group; two for every other sigla.
- Phase 2 quota: two weeks for every sigla, including the January/July group.
- Phase 2 starts when the last permitted SIGLA 1 cell is filled; later choices use the phase 2 coincidence rules immediately.
- Sum overlapping working days per sigla pair; a weekday coincident in two pairs counts twice.
- The user explicitly authorizes publishing the 26 queued phone numbers in the PWA repository and static assets; omit CH, PR, LA, and LO, RU because they are outside the WhatsApp invitation queue.
- Use the exact invite text in the approved spec and leave sending to the user in WhatsApp.

## Files and Responsibilities

- `apps-script/Code.gs`: PWA backend phase state, member quota, sequence validation, pairwise overlap calculation, and response containing the next eligible sigla.
- `apps-script/SpreadsheetControl.gs`: keep equivalent phase and overlap validation for direct spreadsheet edits.
- `src/whatsapp-contacts.js`: public map of normalized phone numbers for the 26 queued recipients; no entries for the five excluded siglas.
- `src/main.js`: handle a successful response's invite and refresh the schedule.
- `src/booking-modal.js`: preserve the reservation flow and expose a usable link if the browser blocks opening a new WhatsApp tab.
- `docs/specs/2026-10-04-pwa-ferias-2027.md`: reconcile superseded quota/notification statements after implementation is approved and complete.

## Review Focus

- Final SIGLA 1 fill changes phase before a subsequent reservation; the final placer’s remaining choice receives the phase 2 overlap validation.
- January/July legacy reservations do not consume the current-phase one-week quota.
- For SIGLA 3, all three pair totals are added independently, including duplicate weekdays across pairs and existing half-day exceptions.
- Missing contact configuration or no next queued sigla must not undo a successful reservation or block booking progression.
- If the browser blocks automatic WhatsApp opening, the completed booking still exposes a direct user-clickable invite link.

---

### Task 1: Unify phase quotas, sequencing, and overlap rules

**Files:**
- Modify: `apps-script/Code.gs`
- Modify: `apps-script/SpreadsheetControl.gs`

**Interfaces:**
- Preserve the current reservation API action and response fields.
- Sum weekday-equivalent overlaps for every sigla pair, with the existing half-day pair rules applied per pair.
- Phase state distinguishes current-phase SIGLA 1 quota (1 for the 14 January/July siglas, 2 for others) from phase 2 quota (2 for all siglas).

- [x] Update backend phase quota counts so January/July legacy cells do not consume current-phase quota and phase 2 has a separate two-week quota for every sigla.
- [x] Keep the approved booking sequence and skip CH, PR, LA, LO, and RU when identifying sequence blockers or the next queued sigla.
- [x] Switch to phase 2 as soon as all permitted SIGLA 1 cells are filled; use phase 2 overlap validation for every later reservation.
- [x] Validate SIGLA 2 against SIGLA 1 at a maximum of three weekday-equivalent days; permit SIGLA 3 only when SIGLA 1 × SIGLA 2 is still below three, then require the sum of all occupied pairs to remain at most three.
- [x] Mirror the same booking/overlap limits in direct spreadsheet edit validation without adding WhatsApp behavior to manual spreadsheet edits.
- [x] Review the resulting rule paths against the approved spec and inspect the diff for untouched PIN and existing-reservation data.

### Task 2: Return the next queued sigla on quota completion

**Files:**
- Modify: `apps-script/Code.gs`
- No contact properties or phone numbers are added to Apps Script.

**Interfaces:**
- Add `obterProximaSiglaConvite_(sheet, siglaAtual, fase, counts)` to return the next queued sigla or an empty string if none remains.
- On a successful reservation that completes the current sigla’s phase quota, add `proximaSiglaConvite` to the existing response. Otherwise omit it.

- [x] Resolve only the next eligible queued recipient; skip the five excluded siglas and handle an empty queue without changing the committed reservation.
- [x] Confirm the next-sigla field appears only on the quota-completing successful reservation response and never sends a WhatsApp message.

### Task 3: Open the prepared invite from the PWA

**Files:**
- Create: `src/whatsapp-contacts.js`
- Modify: `src/main.js`
- Modify: `src/booking-modal.js`

**Interfaces:**
- Consume the optional backend field `proximaSiglaConvite: string`.
- Export the public contact map keyed by sigla from `src/whatsapp-contacts.js`; values are normalized digits including country code.
- Construct the encoded message `Olá! Agora voce pode marcar suas férias. Obrigado. Solicite o PIN de acesso ao Coordenador.` plus the public app URL.

- [x] Add the 26 queued numbers from the user-provided contact list in international format, using the corrected GB number `5531991339451`; omit CH, PR, LA, LO, and RU.
- [x] On successful reservation, construct the WhatsApp URL from the returned sigla, attempt to open it, and refresh the schedule.
- [x] If the browser blocks the new tab, show a direct WhatsApp link the user can click; retain the invitation text and destination.
- [x] Show no invitation for non-completing reservations or when the backend returns no eligible next contact.
- [x] Inspect the final interaction path and source diff; do not send a message automatically.

### Task 4: Reconcile documentation and prepare release

**Files:**
- Modify: `docs/specs/2026-10-04-pwa-ferias-2027.md`
- Modify: `docs/specs/2026-10-05-fase-atual-e-convites-whatsapp.md`

- [x] Mark the approved spec implemented and remove conflicting baseline statements about quotas and notifications.
- [x] Keep the phase 2, privacy, exact-message, and PIN-preservation requirements aligned across both specs.
- [x] Review the final Git diff and repository status; leave existing untracked `dist/` and `node_modules/` untouched.
- [x] Treat GitHub Pages publication and Apps Script deployment as separate release actions; leave both for the release step after review.
