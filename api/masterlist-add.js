import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

// POST /api/masterlist-add { material, description, uom, ean }
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const { material, description, uom, ean } = req.body;
    if (!material || !ean) {
      res.status(400).json({ status: 'error', message: 'Material and EAN/UPC are required.' });
      return;
    }

    const existing = await sql`
      SELECT id FROM master_list
      WHERE ean = ${ean} AND material = ${material} AND description = ${description || ''}
      LIMIT 1
    `;
    if (existing.length > 0) {
      res.status(409).json({ status: 'error', message: 'This item already exists in the Master List.' });
      return;
    }

    await sql`
      INSERT INTO master_list (material, description, uom, ean)
      VALUES (${material}, ${description || ''}, ${uom || ''}, ${ean})
    `;

    res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
