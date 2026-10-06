import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

// GET /api/masterlist-search?material=<query>
// Case-insensitive partial match against the Material code, for the
// Update Masterlist tab's "Edit Existing Item" search.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;

  try {
    const q = ((req.query && req.query.material) || '').trim();
    if (!q) {
      res.status(400).json({ status: 'error', message: 'Missing material search query' });
      return;
    }

    const rows = await sql`
      SELECT id, ean, material, description, uom FROM master_list
      WHERE material ILIKE ${'%' + q + '%'}
      ORDER BY material, ean
      LIMIT 200
    `;

    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
