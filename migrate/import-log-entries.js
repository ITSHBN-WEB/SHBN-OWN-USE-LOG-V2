/**
 * One-time migration: imports your existing monthly log tabs into Neon.
 *
 * SETUP:
 * 1. In Google Sheets, for each monthly tab (e.g. "August 2026"):
 *    File > Download - .csv, .xlsx, and .xls are all fine, this script
 *    reads any of them.
 * 2. Put the files in a folder - it's fine if your Master List export is
 *    in the same folder too, this script automatically skips any file with
 *    "master" in its name.
 * 3. Run:
 *      DATABASE_URL="postgres://..." node migrate/import-log-entries.js "./Exported logs"
 *
 * This is idempotent-ish in the sense that re-running it will insert
 * duplicates if run twice on the same folder - only run it once per file,
 * or clear the table first if you need to retry (TRUNCATE log_entries).
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const sql = neon(process.env.DATABASE_URL);

function parseSheetDate(str) {
  // Sheet format from formatTimestamp(): "5.9.2026 3.52PM"
  if (!str) return null;
  const m = String(str).trim().match(/^(\d+)\.(\d+)\.(\d+)\s+(\d+)\.(\d+)(AM|PM)$/i);
  if (!m) return null;
  let [, d, mo, y, h, mi, ampm] = m;
  h = Number(h);
  mi = Number(mi);
  if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
  return new Date(Number(y), Number(mo) - 1, Number(d), h, mi).toISOString();
}

async function importFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  // raw: false reads each cell's DISPLAYED text - these columns were all
  // written as text (setNumberFormat('@')) by the original app, so this
  // reads back exactly what's shown, with no numeric reinterpretation.
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });

  let count = 0;
  for (const r of rows) {
    const productCode = String(r['Product Code'] || '').trim();
    if (!productCode) continue; // skip stray blank rows

    const material = String(r['Material'] || '').trim();
    const createdAt = parseSheetDate(r['Date']) || new Date().toISOString();
    const materialNumber = String(r['Material Number'] || '').trim() || null;
    const keyedBy = String(r['Material Doc Keyed By'] || '').trim() || null;
    const docDate = parseSheetDate(r['Material Doc Date']);

    await sql`
      INSERT INTO log_entries
        (created_at, product_code, description, material, quantity, uom,
         plant, sloc, cost_center, gl_code, claim_department, claim_by, submitted_by,
         matched, material_number, material_doc_keyed_by, material_doc_date)
      VALUES
        (${createdAt}, ${productCode}, ${r['Description'] || ''}, ${material},
         ${r['Quantity'] ? Number(r['Quantity']) : null}, ${r['UOM'] || ''},
         ${r['Plant'] || '1008'}, ${r['Sloc'] || '1000'}, ${r['Cost Center'] || '10100800'},
         ${r['GL Code'] || ''}, ${r['Claim for Department'] || ''}, ${r['Claim By'] || ''}, ${r['Submitted by'] || ''},
         ${material.length > 0}, ${materialNumber}, ${keyedBy}, ${docDate})
    `;
    count++;
  }

  console.log(`  ${path.basename(filePath)}: imported ${count} row(s)`);
  return count;
}

async function main() {
  const folder = process.argv[2];
  if (!folder) {
    console.error('Usage: DATABASE_URL="postgres://..." node migrate/import-log-entries.js <folder>');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const files = fs.readdirSync(folder)
    .filter((f) => /\.(csv|xlsx|xls)$/i.test(f))
    .filter((f) => !f.toLowerCase().includes('master')); // Master List is a different table - handled by import-master-list.js

  if (!files.length) {
    console.error(`No log files found in ${folder} (looked for .csv/.xlsx/.xls, excluding anything with "master" in the name).`);
    process.exit(1);
  }

  console.log(`Importing ${files.length} file(s) from ${folder}...`);
  let total = 0;
  for (const file of files) {
    total += await importFile(path.join(folder, file));
  }
  console.log(`Done. Total rows imported: ${total}`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
