import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

// Batch "Copy to SAP" confirmation: assigns SAP Material Document numbers
// to a set of previously-pending rows. Uses an atomic UPDATE ... WHERE
// clause (id + still-NULL material + matching fingerprint) so a row that
// changed or was deleted by someone else in the meantime is simply not
// updated, instead of silently overwriting stale data (optimistic
// concurrency, replaces the old verifyPendingRow() pre-check).
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ status: 'error', message: 'No updates provided' });
      return;
    }

    const failed = [];
    for (const u of updates) {
      const result = await sql`
        UPDATE log_entries
        SET
          material_number = ${u.materialNumber},
          material_doc_keyed_by = ${u.keyedBy || null},
          material_doc_date = now()
        WHERE id = ${u.id}
          AND material_number IS NULL
          AND product_code = ${u.expectedProductCode}
          AND material = ${u.expectedMaterial}
        RETURNING id
      `;
      if (result.length === 0) {
        failed.push(u.id);
      }
    }

    if (failed.length > 0) {
      res.status(200).json({
        status: 'partial',
        message: `${updates.length - failed.length} updated, ${failed.length} skipped (changed or removed by someone else)`,
        failedIds: failed
      });
      return;
    }

    res.status(200).json({ status: 'success', message: `Updated ${updates.length} entries` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
