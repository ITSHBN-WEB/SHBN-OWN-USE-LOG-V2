import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const { id, expected } = req.body;
    if (!id || !expected) {
      res.status(400).json({ status: 'error', message: 'Missing id or expected' });
      return;
    }

    const result = await sql`
      DELETE FROM log_entries
      WHERE id = ${id}
        AND material_number IS NULL
        AND material = ${expected.material}
      RETURNING id
    `;

    if (result.length === 0) {
      res.status(409).json({
        status: 'error',
        message: 'This entry was changed or removed by someone else. Please refresh and try again.'
      });
      return;
    }

    const pendingCountRows = await sql`
      SELECT COUNT(*)::int AS count FROM log_entries WHERE material_number IS NULL
    `;

    res.status(200).json({ status: 'success', pendingGI: pendingCountRows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
