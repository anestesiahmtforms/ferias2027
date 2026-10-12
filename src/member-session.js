const STORAGE_KEY = 'ferias2027-member-session';

export function loadMemberSession(storage) {
  try {
    const value = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    return value && typeof value.sigla === 'string' && typeof value.token === 'string' && value.sigla && value.token
      ? { sigla: value.sigla, token: value.token }
      : null;
  } catch (_error) {
    return null;
  }
}

export function saveMemberSession(storage, session) {
  if (!session?.sigla || !session?.token) return null;
  storage?.setItem(STORAGE_KEY, JSON.stringify({ sigla: session.sigla, token: session.token }));
  return session;
}

export function clearMemberSession(storage) {
  storage?.removeItem(STORAGE_KEY);
}
