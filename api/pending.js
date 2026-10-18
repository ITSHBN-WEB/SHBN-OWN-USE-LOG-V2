import { sql } from '../lib/db.js';
import { handlePreflight } from '../lib/cors.js';

// GET /api/pending
//
// Public, unauthenticated endpoint that returns just the pending-entry
// count. Deliberately skips checkAuth (unlike every other endpoint in
// this API) because the only consumer is the SHBN Control Tower
// dashboard - a static page with no login and no API key - and it only
// needs a number, never write access or any entry detail.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'GET') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS count FROM log_entries WHERE material_number IS NULL
    `;
    res.status(200).json({ status: 'success', pendingCount: rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
