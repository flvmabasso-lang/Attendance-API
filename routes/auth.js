// routes/auth.js
const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  const expected = process.env.ADMIN_PASSWORD || 'admin123';

  if (!password || password !== expected) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }
  res.json({ ok: true });
});

module.exports = router;
