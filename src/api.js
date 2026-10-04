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
    fetchSchedule: () => request(''),
    submitReservation: ({ sigla, pin, vaga }) => request('', { action: 'reserve', sigla, pin, vaga }),
    authenticateAdmin: pin => request('', { action: 'admin', operation: 'schedule', pin }),
    changeMemberPin: (sigla, newPin, pin) => request('', { action: 'admin', operation: 'changePin', sigla, newPin, pin }),
    overrideSlot: (vaga, value, justification, pin) => request('', { action: 'admin', operation: 'override', vaga, value, justification, pin })
  };
}
