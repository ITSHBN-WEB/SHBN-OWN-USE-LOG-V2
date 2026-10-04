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
    const { id, expectedProductCode } = req.body;
    if (!id) {
      res.status(400).json({ status: 'error', message: 'Missing id' });
      return;
    }

    const result = await sql`
      DELETE FROM log_entries
      WHERE id = ${id}
        AND material_number IS NULL
        AND product_code = ${expectedProductCode}
      RETURNING id
    `;

    if (result.length === 0) {
      res.status(409).json({
        status: 'error',
        message: 'This entry was changed or removed by someone else. Please refresh and try again.'
      });
      return;
    }

    res.status(200).json({ status: 'success', message: 'Entry deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
