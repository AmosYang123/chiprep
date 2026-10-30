import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '../../server/db.js';
import { handleState } from '../../server/state.js';

// Vercel functions have a read-only deployment filesystem; /tmp is the only
// writable location. Browser recovery remains the durable fallback because a
// serverless instance's /tmp storage is intentionally ephemeral.
const dataDirectory = process.env.VERCEL ? '/tmp/ting' : join(process.cwd(), 'data');
mkdirSync(dataDirectory, { recursive: true });
const database = openDatabase(join(dataDirectory, 'ting.sqlite'));

export async function ALL({ request }) {
  try { return await handleState(request, database); }
  catch (error) {
    console.error('Study storage failed:', error);
    return new Response(JSON.stringify({ error: 'Could not save study data. Your browser keeps a recovery copy.' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
}
