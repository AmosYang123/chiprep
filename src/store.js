const names = ['list', 'skip', 'learned-listen', 'learned-pinyin', 'learned-pinyin-tones', 'sets'];

export function createStudyStore(storage, request, status = () => {}) {
  let state = {};
  let pending = {};
  let saving = false;
  let timer;

  function load(name, fallback) {
    try { return JSON.parse(storage.getItem(`ting-clone-${name}`)) ?? fallback; } catch { return fallback; }
  }
  function cache(name, value) {
    try { storage.setItem(`ting-clone-${name}`, JSON.stringify(value)); }
    catch { status('Browser recovery storage is unavailable. Keep this page open until changes are saved.'); }
  }
  async function initialize() {
    pending = load('pending', {});
    if (!pending || typeof pending !== 'object' || Array.isArray(pending)) pending = {};
    pending = Object.fromEntries(Object.entries(pending).filter(([name]) => names.includes(name)));
    const local = Object.fromEntries(names.map(name => [name, load(name, undefined)]).filter(([, value]) => value !== undefined));
    state = local;
    try {
      const response = await request('/api/state');
      if (!response.ok) throw new Error('Could not load saved study data.');
      const result = await response.json();
      if (!result.state || typeof result.state !== 'object' || Array.isArray(result.state)) throw new Error('Saved study data was invalid.');
      if (!Object.keys(result.state).length) pending = { ...local, ...pending };
      state = { ...result.state, ...pending };
      for (const [name, value] of Object.entries(state)) cache(name, value);
      cache('pending', pending);
      if (Object.keys(pending).length) await flush();
    } catch (error) { status(`${error.message} Your device copy is available; changes will retry when connected.`); }
  }
  function read(name, fallback) {
    const value = state[name];
    if (Array.isArray(fallback)) return Array.isArray(value) ? value.filter(item => typeof item === 'string') : fallback;
    if (fallback && typeof fallback === 'object') return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
    return typeof value === typeof fallback ? value : fallback;
  }
  function write(name, value) {
    state[name] = value;
    pending[name] = value;
    cache(name, value);
    cache('pending', pending);
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 250);
  }
  async function flush() {
    clearTimeout(timer);
    timer = undefined;
    if (saving || !Object.keys(pending).length) return;
    saving = true;
    const batch = { ...pending };
    try {
      const options = { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates: batch }), keepalive: true };
      let response = await request('/api/state', options);
      if (response.status === 401) {
        const session = await request('/api/state');
        if (session.ok) response = await request('/api/state', options);
      }
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Saving failed.');
      }
      for (const [name, value] of Object.entries(batch)) if (JSON.stringify(pending[name]) === JSON.stringify(value)) delete pending[name];
      cache('pending', pending);
      status('');
    } catch (error) {
      status(`${error.message} Changes are kept on this device and will retry.`);
      timer = setTimeout(() => void flush(), 5000);
    } finally { saving = false; }
    if (Object.keys(pending).length && !timer) timer = setTimeout(() => void flush(), 250);
  }
  return { initialize, read, write, flush };
}
