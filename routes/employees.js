// routes/employees.js
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const employees = db
    .prepare('SELECT id, name, department, email, photo_base64, active, created_at FROM employees WHERE active = 1 ORDER BY created_at DESC')
    .all();
  res.json(employees);
});

router.post('/', (req, res) => {
  const { name, department, email, photo_base64 } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O campo "name" é obrigatório' });
  }

  const stmt = db.prepare(`
    INSERT INTO employees (name, department, email, photo_base64)
    VALUES (@name, @department, @email, @photo_base64)
  `);

  const info = stmt.run({
    name: name.trim(),
    department: department ? department.trim() : null,
    email: email ? email.trim() : null,
    photo_base64: photo_base64 || null,
  });

  const created = db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Funcionário não encontrado' });

  const { name, department, email, photo_base64 } = req.body;

  db.prepare(`
    UPDATE employees
    SET name = @name, department = @department, email = @email,
        photo_base64 = COALESCE(@photo_base64, photo_base64)
    WHERE id = @id
  `).run({
    id,
    name: name ?? existing.name,
    department: department ?? existing.department,
    email: email ?? existing.email,
    photo_base64: photo_base64 || null,
  });

  res.json(db.prepare('SELECT * FROM employees WHERE id = ?').get(id));
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('UPDATE employees SET active = 0 WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Funcionário não encontrado' });
  res.status(204).end();
});

module.exports = router;
