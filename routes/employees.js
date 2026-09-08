// routes/employees.js
const express = require('express');
const db = require('../db');

const router = express.Router();

function serialize(row) {
  if (!row) return row;
  const { face_template, ...rest } = row;
  return {
    ...rest,
    face_descriptor: face_template ? JSON.parse(face_template) : null,
  };
}

router.get('/', (req, res) => {
  const employees = db
    .prepare('SELECT id, name, department, email, photo_base64, face_template, active, created_at FROM employees WHERE active = 1 ORDER BY created_at DESC')
    .all();
  res.json(employees.map(serialize));
});

router.post('/', (req, res) => {
  const { name, department, email, photo_base64, face_descriptor } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O campo "name" é obrigatório' });
  }

  const stmt = db.prepare(`
    INSERT INTO employees (name, department, email, photo_base64, face_template)
    VALUES (@name, @department, @email, @photo_base64, @face_template)
  `);

  const info = stmt.run({
    name: name.trim(),
    department: department ? department.trim() : null,
    email: email ? email.trim() : null,
    photo_base64: photo_base64 || null,
    face_template: Array.isArray(face_descriptor) ? JSON.stringify(face_descriptor) : null,
  });

  const created = db.prepare('SELECT * FROM employees WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serialize(created));
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Funcionário não encontrado' });

  const { name, department, email, photo_base64, face_descriptor } = req.body;

  db.prepare(`
    UPDATE employees
    SET name = @name, department = @department, email = @email,
        photo_base64 = COALESCE(@photo_base64, photo_base64),
        face_template = COALESCE(@face_template, face_template)
    WHERE id = @id
  `).run({
    id,
    name: name ?? existing.name,
    department: department ?? existing.department,
    email: email ?? existing.email,
    photo_base64: photo_base64 || null,
    face_template: Array.isArray(face_descriptor) ? JSON.stringify(face_descriptor) : null,
  });

  res.json(serialize(db.prepare('SELECT * FROM employees WHERE id = ?').get(id)));
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('UPDATE employees SET active = 0 WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Funcionário não encontrado' });
  res.status(204).end();
});

module.exports = router;
