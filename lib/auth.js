// The password the person enters in the app is sent as the x-api-key header
// on every request and checked here against API_SECRET (set in Vercel's
// environment variables). Unlike the old client-side-only password check,
// this is real server-side authentication: someone can't bypass it just by
// reading the page source.
export function checkAuth(req) {
  const expected = process.env.API_SECRET;
  if (!expected) return true; // no secret configured - auth disabled (not recommended)
  const provided = req.headers['x-api-key'];
  return provided === expected;
}

export function unauthorized(res) {
  res.status(401).json({ status: 'error', message: 'Incorrect password.' });
}
