export function createApi(baseUrl, fetchImpl = fetch) {
  async function request(path, payload) {
    const response = payload === undefined
      ? await fetchImpl(baseUrl + path)
      : await fetchImpl(baseUrl + path, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
    return response.json();
  }

  return {
    fetchSchedule: sessionToken => sessionToken ? request('', { action: 'sessionSchedule', sessionToken }) : request(''),
    startMemberSession: (sigla, pin) => request('', { action: 'sessionStart', sigla, pin }),
    endMemberSession: sessionToken => request('', { action: 'sessionEnd', sessionToken }),
    cancelOwnReservation: (vaga, sessionToken) => request('', { action: 'cancelOwn', vaga, sessionToken }),
    submitReservation: ({ sigla, pin, vaga, sessionToken }) => request('', { action: 'reserve', sigla, pin, vaga, sessionToken }),
    authenticateAdmin: pin => request('', { action: 'admin', operation: 'schedule', pin }),
    changeMemberPin: (sigla, newPin, pin) => request('', { action: 'admin', operation: 'changePin', sigla, newPin, pin }),
    overrideSlot: (vaga, value, justification, pin) => request('', { action: 'admin', operation: 'override', vaga, value, justification, pin }),
    reopenMemberSession: (sigla, pin) => request('', { action: 'admin', operation: 'reopenMemberSession', sigla, pin })
  };
}
