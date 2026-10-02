/**
 * One-time migration: imports your Master List tab into Neon.
 *
 * SETUP:
 * 1. In Google Sheets, right-click the "Master List" tab > Download -
 *    .csv, .xlsx, and .xls are all fine, this script reads any of them.
 * 2. Run, pointing either at the file directly or at a folder that
 *    contains it (the folder can also contain your other exported files -
 *    this picks out whichever one has "master" in its name):
 *      DATABASE_URL="postgres://..." node migrate/import-master-list.js ./master-list.xls
 *      DATABASE_URL="postgres://..." node migrate/import-master-list.js "./Exported logs"
 *
 * Safe to re-run: uses the EAN/UPC as the unique key, so re-importing the
 * same or an updated file just updates existing rows instead of duplicating.
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const sql = neon(process.env.DATABASE_URL);

function resolveMasterListFile(inputPath) {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return inputPath;

  // A folder was given - find the file with "master" in its name.
  const files = fs.readdirSync(inputPath).filter((f) => /\.(xlsx|xls|csv)$/i.test(f));
  const match = files.find((f) => f.toLowerCase().includes('master'));
  if (!match) {
    throw new Error(`No file with "master" in its name found in ${inputPath}. Files seen: ${files.join(', ') || '(none)'}`);
  }
  return path.join(inputPath, match);
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: DATABASE_URL="postgres://..." node migrate/import-master-list.js <file-or-folder>');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const filePath = resolveMasterListFile(inputPath);
  console.log(`Reading: ${filePath}`);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  // raw: false reads each cell's DISPLAYED text rather than its underlying
  // number/date value - important for EAN/UPC codes, since a barcode that
  // looks like a number could otherwise lose a leading zero.
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });

  let count = 0;
  for (const r of rows) {
    // Header names here match your Master List sheet's columns: Material,
    // Material Description, Sales Unit, EAN/UPC. If a header reads
    // slightly differently in your file, adjust the bracketed names below.
    const ean = String(r['EAN/UPC'] || r['EAN'] || r['UPC'] || '').trim();
    if (!ean) continue; // matches the app's own rule: rows with no EAN are skipped

    await sql`
      INSERT INTO master_list (material, description, uom, ean)
      VALUES (${String(r['Material'] || '').trim()}, ${String(r['Material Description'] || '').trim()}, ${String(r['Sales Unit'] || '').trim()}, ${ean})
      ON CONFLICT (ean) DO UPDATE SET
        material = EXCLUDED.material,
        description = EXCLUDED.description,
        uom = EXCLUDED.uom
    `;
    count++;
  }

  console.log(`Imported/updated ${count} master list row(s).`);
  if (count === 0) {
    console.warn('0 rows imported - check that the header names above match your file\'s actual column headers.');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
