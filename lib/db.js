import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it in Vercel > Project Settings > Environment Variables ' +
    '(copy the connection string from your Neon project dashboard).'
  );
}

// neon() gives a tagged-template SQL client over HTTP - ideal for Vercel's
// serverless functions since it needs no persistent connection pool.
export const sql = neon(process.env.DATABASE_URL);
