import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';
import { formatEntry } from '../lib/format.js';

// Index.html does `pendingEntries = data;` directly on the result of
// this call and treats it as an array (.length, .slice, .find) - so
// this returns a bare JSON array, not {status, pendingEntries: [...]}.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
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
