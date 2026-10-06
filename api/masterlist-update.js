import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

// POST /api/masterlist-update { id, material, description, uom, ean }
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const { id, material, description, uom, ean } = req.body;
    if (!id || !material || !ean) {
      res.status(400).json({ status: 'error', message: 'Missing id, material, or EAN/UPC.' });
      return;
    }

    const result = await sql`
      UPDATE master_list
      SET material = ${material}, description = ${description || ''}, uom = ${uom || ''}, ean = ${ean}
      WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      res.status(404).json({ status: 'error', message: 'Item not found.' });
      return;
    }

    res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
