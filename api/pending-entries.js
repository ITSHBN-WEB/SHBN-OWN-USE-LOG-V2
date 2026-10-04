import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';
import { formatEntry } from '../lib/format.js';

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;

  try {
    const rows = await sql`
      SELECT * FROM log_entries WHERE material_number IS NULL ORDER BY created_at ASC
    `;
    res.status(200).json({
      status: 'success',
      pendingEntries: rows.map(formatEntry),
      pendingCount: rows.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
