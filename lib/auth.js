// Shared-secret auth: the password the user types in the app IS the API key.
export function checkAuth(req, res) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_SECRET) {
    res.status(401).json({ status: 'error', message: 'Unauthorized' });
    return false;
  }
  return true;
}
