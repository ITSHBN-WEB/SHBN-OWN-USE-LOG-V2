import { sql } from '../lib/db.js';
import { withCors } from '../lib/cors.js';
import { checkAuth, unauthorized } from '../lib/auth.js';

export default async function handler(req, res) {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkAuth(req)) return unauthorized(res);

  try {
    const { id, expected } = req.body;
    if (!id) throw new Error('Missing id.');

    const expectedMaterial = expected && expected.material !== undefined ? String(expected.material) : null;

    const rows = expectedMaterial !== null
      ? await sql`DELETE FROM log_entries WHERE id = ${id} AND material_number IS NULL AND material = ${expectedMaterial} RETURNING id`
      : await sql`DELETE FROM log_entries WHERE id = ${id} AND material_number IS NULL RETURNING id`;

    if (rows.length === 0) {
      throw new Error('That entry has changed since you loaded it, or was already processed. Please refresh and try again.');
    }

    const pendingRows = await sql`
      SELECT count(*)::int AS count FROM log_entries WHERE material <> '' AND material_number IS NULL
    `;

    res.status(200).json({ status: 'ok', pendingGI: pendingRows[0].count });
  } catch (err) {
    res.status(200).json({ status: 'error', message: err.message });
  }
}
