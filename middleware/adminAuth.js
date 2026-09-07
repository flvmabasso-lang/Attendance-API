// middleware/adminAuth.js
function adminAuth(req, res, next) {
  const key = req.header('x-admin-key');
  const expected = process.env.ADMIN_PASSWORD || 'admin123';

  if (!key || key !== expected) {
    return res.status(401).json({ error: 'Sessão inválida — inicie sessão novamente' });
  }
  next();
}

module.exports = adminAuth;
