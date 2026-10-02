import { sql } from '../lib/db.js';
import { withCors } from '../lib/cors.js';
import { checkAuth, unauthorized } from '../lib/auth.js';
import { formatEntry } from '../lib/format.js';

export default async function handler(req, res) {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAuth(req)) return unauthorized(res);

  try {
    const rows = await sql`
      SELECT id, created_at, product_code, description, material, quantity, uom,
             plant, sloc, cost_center, gl_code, claim_department, claim_by, submitted_by
      FROM log_entries
      WHERE material <> '' AND material_number IS NULL
      ORDER BY created_at
    `;
    res.status(200).json(rows.map(formatEntry));
  } catch (err) {
    res.status(200).json({ status: 'error', message: err.message });
  }
}
