# SHBN Own Use Log - Neon + Vercel migration

Fully migrated: both Master List and log entries (New Entry submissions, the
Pending Entry queue, Material Documents) live in Neon (Postgres). The old
Google Sheet and Apps Script deployment are no longer needed once this is
live and verified - see the last step for retiring them.

## 1. Create the Neon database

1. Sign up / log in at neon.tech, create a project.
2. Copy the connection string from the dashboard (starts with `postgres://`).
3. Run the schema once - either paste the contents of `schema/schema.sql`
   into Neon's own SQL Editor (in the Neon console) and click Run, or from
   your own machine:
   ```
   psql "postgres://...your-connection-string..." -f schema/schema.sql
   ```

## 2. Import your existing data

1. In Google Sheets, download each tab you need (Master List + every
   monthly tab) - .csv, .xlsx, and .xls all work, the scripts read any of
   them. They can all go in the same folder; the scripts sort out which
   file is which automatically (anything with "master" in its name is
   treated as the Master List, everything else as a monthly log).
2. On your computer (Node.js required), inside this project folder:
   ```
   npm install
   DATABASE_URL="postgres://...your-connection-string..." node migrate/import-master-list.js "./Exported logs"
   DATABASE_URL="postgres://...your-connection-string..." node migrate/import-log-entries.js "./Exported logs"
   ```
3. Verify in Neon's SQL Editor:
   ```sql
   SELECT count(*) FROM master_list;
   SELECT count(*) FROM log_entries;
   ```

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo (or use the Vercel CLI to deploy
   directly without one).
2. In Vercel: New Project > import the repo.
3. Before the first deploy, add these under Environment Variables:
   - `DATABASE_URL` - the Neon connection string from step 1
   - `API_SECRET` - the password the app should require
4. Deploy. Your API base URL will be `https://your-project.vercel.app/api`.

## 4. Point Index.html at it

In Index.html, set:
```js
var VERCEL_API_URL = 'https://your-project.vercel.app/api';
```
Then push Index.html to GitHub Pages (or wherever it's hosted) as usual.

## 5. Test, then retire the old stack

Once you've confirmed New Entry, Pending Entry, and Admin all work against
Neon: the Google Sheet and Apps Script deployment are no longer touched by
anything. You can leave them alone as a static backup, or go to the Apps
Script project > Deploy > Manage deployments and archive the deployment.
