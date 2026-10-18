import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';
import { formatEntry } from '../lib/format.js';

// GET /api/pending-entries?action=pending
//   Public, unauthenticated pending-count check for the SHBN Control
//   Tower dashboard (a static page with no login/API key - it only
//   needs a number, never entry detail). Folded into this file rather
//   than its own endpoint because Vercel's Hobby plan caps a deployment
//   at 12 serverless functions and this project is already at that
//   limit - this mirrors how the Departmental Invoice Record app
//   exposes its own pending count via /api/invoices?action=pending.
//
// GET /api/pending-entries  (no action param)
//   Index.html does `pendingEntries = data;` directly on the result of
//   this call and treats it as an array (.length, .slice, .find) - so
//   this path returns a bare JSON array, not {status, pendingEntries}.
//   Requires the API key like the rest of the authenticated API.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;

  const action = (req.query && req.query.action) || '';

  if (action === 'pending') {
    try {
      const rows = await sql`
        SELECT COUNT(*)::int AS count FROM log_entries WHERE material_number IS NULL
      `;
      res.status(200).json({ status: 'success', pendingCount: rows[0].count });
    } catch (err) {
      console.error(err);
      res.status(500).json({ status: 'error', message: err.message });
    }
    return;
  }

  if (!checkAuth(req, res)) return;

  try {
    const rows = await sql`
      SELECT * FROM log_entries WHERE material_number IS NULL ORDER BY created_at ASC
    `;
    res.status(200).json(rows.map(formatEntry));
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
