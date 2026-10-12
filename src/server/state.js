import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const strings = z.array(z.string().max(1000)).max(2000);
const sets = z.strictObject({
  items: z.array(z.strictObject({
    id: z.string().min(1).max(100).refine(value => value.trim().length > 0),
    name: z.string().max(100).trim().min(1),
    list: z.string().max(100000),
  })).max(50).superRefine((items, context) => {
    if (new Set(items.map(item => item.id)).size !== items.length) context.addIssue({ code: 'custom', message: 'Set IDs must be unique.' });
    if (items.reduce((total, item) => total + item.list.length, 0) > 100000) context.addIssue({ code: 'custom', message: 'Saved set lists are too large.' });
  }),
  active: z.string().min(1).max(100),
}).refine(value => value.active === 'all' || value.items.some(item => item.id === value.active));
const updateSchema = z.strictObject({
  updates: z.strictObject({
    list: z.string().max(100000).optional(),
    skip: strings.optional(),
    'learned-listen': strings.optional(),
    'learned-pinyin': strings.optional(),
    'learned-pinyin-tones': strings.optional(),
    sets: sets.optional(),
  }).refine(value => Object.keys(value).length > 0),
});

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export async function handleState(request, database) {
  const origin = new URL(request.url).origin;
  const suppliedOrigin = request.headers.get('Origin');
  if ((suppliedOrigin && suppliedOrigin !== origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ error: 'Use the study page on this server.' }, 403);
  let id = request.headers.get('Cookie')?.match(/(?:^|;\s*)ting-workspace=([a-f0-9]{64})(?:;|$)/)?.[1];
  const exists = id && database.prepare('SELECT id FROM workspaces WHERE id = ?').get(id);

  if (request.method === 'GET') {
    const headers = {};
    if (!exists) {
      id = randomBytes(32).toString('hex');
      database.prepare('INSERT INTO workspaces (id, created) VALUES (?, ?)').run(id, Date.now());
      headers['Set-Cookie'] = `ting-workspace=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${request.url.startsWith('https:') ? '; Secure' : ''}`;
    }
    const state = Object.fromEntries(database.prepare('SELECT name, value FROM study_state WHERE workspace_id = ?').all(id).map(row => [row.name, JSON.parse(row.value)]));
    return json({ state }, 200, headers);
  }

  if (request.method !== 'PATCH') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, PATCH' });
  if (!exists) return json({ error: 'Open your study space before saving.' }, 401);
  if (suppliedOrigin !== origin) return json({ error: 'Saving requires the study page origin.' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'Send JSON study data.' }, 415);
  if (Number(request.headers.get('Content-Length')) > 262144) return json({ error: 'Study data is too large.' }, 413);
  let body;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 262144) return json({ error: 'Study data is too large.' }, 413);
    body = JSON.parse(text);
  } catch { return json({ error: 'Invalid JSON.' }, 400); }
  const validated = updateSchema.safeParse(body);
  if (!validated.success) return json({ error: 'Invalid study data or saved sets.' }, 400);
  const save = database.prepare('INSERT INTO study_state (workspace_id, name, value) VALUES (?, ?, ?) ON CONFLICT(workspace_id, name) DO UPDATE SET value = excluded.value');
  database.transaction(() => {
    for (const [name, value] of Object.entries(validated.data.updates)) save.run(id, name, JSON.stringify(value));
  })();
  return json({ success: true });
}
