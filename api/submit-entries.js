import { sql } from '../lib/db.js';
import { withCors } from '../lib/cors.js';
import { checkAuth, unauthorized } from '../lib/auth.js';
import { formatDate, formatMonthLabel } from '../lib/format.js';

export default async function handler(req, res) {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkAuth(req)) return unauthorized(res);

  try {
    const { entries } = req.body;
    if (!entries || !entries.length) throw new Error('No entries to submit.');

    const now = new Date();
    let count = 0;
    for (const e of entries) {
      await sql`
        INSERT INTO log_entries
          (product_code, description, material, quantity, uom, gl_code,
           claim_department, claim_by, submitted_by, matched)
        VALUES
          (${e.productCode || ''}, ${e.description || ''}, ${e.material || ''},
           ${e.quantity || null}, ${e.uom || ''}, ${e.glCode || ''},
           ${e.claimForDepartment || ''}, ${e.claimBy || ''}, ${e.submittedBy || ''},
           ${!!e.matched})
      `;
      count++;
    }

    const pendingRows = await sql`
      SELECT count(*)::int AS count FROM log_entries WHERE material <> '' AND material_number IS NULL
    `;

    res.status(200).json({
      status: 'ok',
      count,
      sheet: formatMonthLabel(now), // kept as "sheet" for the client's existing message; no longer a real separate sheet
      timestamp: formatDate(now),
      pendingGI: pendingRows[0].count
    });
  } catch (err) {
    res.status(200).json({ status: 'error', message: err.message });
  }
}
