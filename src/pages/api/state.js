import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openDatabase } from '../../server/db.js';
import { handleState } from '../../server/state.js';

mkdirSync(join(process.cwd(), 'data'), { recursive: true });
const database = openDatabase(join(process.cwd(), 'data', 'ting.sqlite'));

export async function ALL({ request }) {
  try { return await handleState(request, database); }
  catch (error) {
    console.error('Study storage failed:', error);
    return new Response(JSON.stringify({ error: 'Could not save study data. Your browser keeps a recovery copy.' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
}
