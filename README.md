[README.md](https://github.com/user-attachments/files/33016988/README.md)
# SHBN - Own Use Log (Neon + Vercel backend)

This replaces the old Google Apps Script + Google Sheets backend with:
- **Neon** (serverless Postgres) for storage (Master List + log entries)
- **Vercel** (serverless functions) for the API
- **GitHub Pages** still hosts `Index.html` (the frontend), now pointed at the Vercel API instead of the Apps Script URL

## 1. Set up the Neon database

1. In the Neon dashboard, open the SQL editor for your project.
2. Paste the entire contents of `schema/schema.sql` and run it. This creates the `master_list` and `log_entries` tables.

## 2. Import your existing data

From your computer, in this project folder:

```
npm install
```

Then set your Neon connection string for the current terminal session and run the two import scripts, **one command at a time, each as its own separate paste**:

**Windows PowerShell:**
```
$env:DATABASE_URL="your-neon-connection-string-here"
```
(press Enter, confirm it returns to a normal prompt before continuing)

```
node migrate/import-master-list.js "Exported logs"
```

```
node migrate/import-log-entries.js "Exported logs"
```

**Mac/Linux:**
```
export DATABASE_URL="your-neon-connection-string-here"
node migrate/import-master-list.js "Exported logs"
node migrate/import-log-entries.js "Exported logs"
```

Where `"Exported logs"` is the folder containing your exported Google Sheets files (CSV, XLS, or XLSX — any format works). The master-list script picks the file with "master" in its name; the log-entries script imports every other file in the folder.

After running both, go back to the Neon dashboard Tables view and confirm `master_list` and `log_entries` now show real row counts.

## 3. Deploy to Vercel

1. Push this whole folder to your GitHub repo (or use "Add files via upload" on GitHub, then import that repo into Vercel).
2. In Vercel, go to your project's **Settings > Environment Variables** and add:
   - `DATABASE_URL` = your Neon connection string
   - `API_SECRET` = your chosen password (this doubles as the login password in the app, e.g. `8888`)
3. Redeploy (Vercel usually redeploys automatically after a push; if not, use the "Redeploy" button).
4. Your API will be live at `https://<your-project-name>.vercel.app/api/...` — the root domain itself (`https://<your-project-name>.vercel.app/`) will show "This page doesn't exist", which is expected since there's no homepage, only `/api/*` routes.

## 4. Point Index.html at the new API

In `Index.html`, set the API base URL constant to:
```
https://<your-project-name>.vercel.app/api
```
Then push the updated `Index.html` to GitHub Pages as usual.

## 5. Test end-to-end

- Open the GitHub Pages site, log in with your password (this is now checked against `API_SECRET` on the server, not just compared in the browser).
- Try New Entry, Pending Entry, Copy to SAP, and Admin edit/delete.
- Confirm new rows appear in the Neon `log_entries` table.

## 6. Retire the old stack

Once everything above is confirmed working, you can delete the old Apps Script project and stop maintaining the Google Sheet — all data now lives in Neon.

## Notes

- There is a single password/login now (`API_SECRET`); the old separate staff password has been removed.
- Master List is **not** shared with other SHBN apps — it was migrated here in full, specific to this app.
- Concurrency: the Admin/Copy-to-SAP update and delete endpoints use an atomic `UPDATE/DELETE ... WHERE id=... AND material IS NULL AND product_code=...` check, so two people acting on the same pending row at once can't silently overwrite each other.
