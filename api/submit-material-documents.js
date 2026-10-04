import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

// Batch "Copy to SAP" confirmation: assigns a Material Document number
// (+ who/when keyed it in) to a set of previously-pending rows. Index.html
// posts { entries: [{id, materialDocument, expectedMaterial}], keyInBy }.
//
// The UPDATE's WHERE clause folds in an atomic optimistic-concurrency
// check (id + still-pending + matching SAP material code), so a row that
// changed or was deleted by someone else in the meantime is simply
// skipped instead of silently overwritten.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const { entries, keyInBy } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ status: 'error', message: 'No entries provided' });
      return;
    }

    for (const e of entries) {
      await sql`
        UPDATE log_entries
        SET
          material_number = ${e.materialDocument},
          material_doc_keyed_by = ${keyInBy || null},
          material_doc_date = now()
        WHERE id = ${e.id}
          AND material_number IS NULL
          AND material = ${e.expectedMaterial}
      `;
      // Rows that don't match (already updated/removed by someone else)
      // are silently skipped rather than failing the whole batch -
      // they'll simply still show up as pending for the user to retry.
    }

    const pendingCountRows = await sql`
      SELECT COUNT(*)::int AS count FROM log_entries WHERE material_number IS NULL
    `;

    res.status(200).json({ status: 'success', pendingGI: pendingCountRows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
