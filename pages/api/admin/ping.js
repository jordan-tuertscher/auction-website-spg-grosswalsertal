function checkAuth(req) {
  return req.headers["x-admin-password"] === process.env.ADMIN_PASSWORD;
}

export default function handler(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: "Falsches Passwort." });
  res.status(200).json({ ok: true });
}
