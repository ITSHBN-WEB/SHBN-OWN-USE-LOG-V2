import { sql } from '../lib/db.js';
import { withCors } from '../lib/cors.js';
import { checkAuth, unauthorized } from '../lib/auth.js';
import { DEFAULTS, GL_CODES } from '../lib/constants.js';

export default async function handler(req, res) {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAuth(req)) return unauthorized(res);

  try {
    const [masterListRows, pendingRows] = await Promise.all([
      sql`SELECT material, description, uom, ean FROM master_list ORDER BY id`,
      sql`SELECT count(*)::int AS count FROM log_entries WHERE material <> '' AND material_number IS NULL`
    ]);

    res.status(200).json({
      masterList: masterListRows,
      glCodes: GL_CODES,
      defaults: DEFAULTS,
      pendingGI: pendingRows[0].count
    });
  } catch (err) {
    res.status(200).json({ status: 'error', message: err.message });
  }
}
