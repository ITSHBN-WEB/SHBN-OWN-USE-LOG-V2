import { sql } from '../lib/db.js';
import { withCors } from '../lib/cors.js';
import { checkAuth, unauthorized } from '../lib/auth.js';
import { formatDate } from '../lib/format.js';

export default async function handler(req, res) {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkAuth(req)) return unauthorized(res);

  try {
    const { entries, keyInBy } = req.body;
    if (!entries || !entries.length) throw new Error('No entries selected.');
    if (!keyInBy) throw new Error('Please enter who keyed this in.');

    const now = new Date();

    // Each UPDATE is conditioned on material_number still being NULL and the
    // material still matching what the client last saw - atomic, so there's
    // no read-then-write race window like the old sheet+row-number approach
    // needed a separate verify step for. Rows are applied independently:
    // if one has genuinely changed (someone else keyed it in, or edited it),
    // it's reported by id rather than the whole batch silently succeeding
    // or being all-or-nothing rolled back.
    const failedIds = [];
    let succeeded = 0;
    for (const e of entries) {
      const rows = await sql`
        UPDATE log_entries
        SET material_number = ${e.materialDocument},
            material_doc_keyed_by = ${keyInBy},
            material_doc_date = ${now.toISOString()}
        WHERE id = ${e.id}
          AND material_number IS NULL
          AND material = ${e.expectedMaterial}
        RETURNING id
      `;
      if (rows.length) succeeded++;
      else failedIds.push(e.id);
    }

    if (failedIds.length) {
      throw new Error(
        `${succeeded} of ${entries.length} were saved. Entry id(s) ${failedIds.join(', ')} ` +
        `had already changed (edited or processed by someone else) and were skipped - please refresh and retry those.`
      );
    }

    const pendingRows = await sql`
      SELECT count(*)::int AS count FROM log_entries WHERE material <> '' AND material_number IS NULL
    `;

    res.status(200).json({
      status: 'ok',
      count: succeeded,
      timestamp: formatDate(now),
      pendingGI: pendingRows[0].count
    });
  } catch (err) {
    res.status(200).json({ status: 'error', message: err.message });
  }
}
