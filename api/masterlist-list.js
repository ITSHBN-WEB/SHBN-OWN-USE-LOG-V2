import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

// GET /api/masterlist-list - full Master List, used by the frontend to
// resync its in-memory lookup map after an add/edit/import on the
// Update Masterlist tab (so New Entry lookups reflect changes right
// away, without needing to log out and back in).
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;

  try {
    const rows = await sql`SELECT id, ean, material, description, uom FROM master_list ORDER BY material, ean`;
    res.status(200).json(rows.map(r => ({
      id: r.id,
      ean: r.ean,
      productCode: r.ean,
      material: r.material,
      description: r.description,
      uom: r.uom
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
