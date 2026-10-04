// Imports the Master List export (CSV/XLS/XLSX, whatever Google Sheets
// produced) into the Neon master_list table.
//
// Usage:
//   node migrate/import-master-list.js "path/to/file-or-folder"
//
// If given a folder, picks the file in it whose name contains "master"
// (case-insensitive).
//
// Real export columns: Material, Material Description, Material Group,
// Sales Unit, Numerator, EAN/UPC, Department. A single Material can have
// several EAN/UPC rows (one per pack unit - EA, CAR, etc), so there's no
// single EAN to safely upsert on. Instead this does a full replace: clears
// master_list and reinserts everything fresh each run.

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

function resolveFile(inputPath) {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return inputPath;

  const files = fs.readdirSync(inputPath);
  const match = files.find(f => f.toLowerCase().includes('master'));
  if (!match) {
    throw new Error(`No file containing "master" found in folder: ${inputPath}`);
  }
  return path.join(inputPath, match);
}

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error('Usage: node migrate/import-master-list.js "path/to/file-or-folder"');
    process.exit(1);
  }

  const filePath = resolveFile(inputArg);
  console.log(`Reading: ${filePath}`);

  const workbook = XLSX.readFile(filePath, { raw: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

  if (rows.length === 0) {
    console.error('No rows found in the file.');
    process.exit(1);
  }

  const headerMap = {
    material: ['material'],
    description: ['materialdescription', 'description'],
    uom: ['salesunit', 'uom', 'unit'],
    ean: ['eanupc', 'ean', 'upc', 'barcode']
  };

  const sampleKeys = Object.keys(rows[0]).map(normalizeHeader);
  function findKey(targetAliases) {
    const idx = sampleKeys.findIndex(k => targetAliases.includes(k));
    if (idx === -1) return null;
    return Object.keys(rows[0])[idx];
  }

  const materialKey = findKey(headerMap.material);
  const descriptionKey = findKey(headerMap.description);
  const uomKey = findKey(headerMap.uom);
  const eanKey = findKey(headerMap.ean);

  if (!eanKey) {
    console.error('Could not find an EAN/UPC column in the file. Columns found:', Object.keys(rows[0]));
    process.exit(1);
  }

  console.log('Clearing existing master_list rows...');
  await sql`DELETE FROM master_list`;

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const ean = String(row[eanKey] || '').trim();
    if (!ean) {
      skipped++;
      continue;
    }

    const material = materialKey ? String(row[materialKey] || '').trim() : '';
    const description = descriptionKey ? String(row[descriptionKey] || '').trim() : '';
    const uom = uomKey ? String(row[uomKey] || '').trim() : '';

    await sql`
      INSERT INTO master_list (ean, material, description, uom)
      VALUES (${ean}, ${material || null}, ${description}, ${uom})
    `;
    imported++;
  }

  console.log(`Done. Imported ${imported} rows, skipped ${skipped} rows with no EAN/UPC.`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
