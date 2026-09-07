// routes/checkins.js
const express = require('express');
const db = require('../db');
const deviceAuth = require('../middleware/deviceAuth');

const router = express.Router();
router.use(deviceAuth);

router.post('/', (req, res) => {
  const { employee_id, method, confidence, evidence_photo_base64 } = req.body;

  if (!employee_id) {
    return res.status(400).json({ error: 'O campo "employee_id" é obrigatório' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1').get(employee_id);
  if (!employee) {
    return res.status(404).json({ error: 'Funcionário não encontrado ou inativo' });
  }

  const last = db.prepare(`
    SELECT * FROM checkins
    WHERE employee_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(employee_id);

  if (last) {
    const secondsSinceLast = (Date.now() - new Date(last.created_at + 'Z').getTime()) / 1000;
    if (secondsSinceLast < 60) {
      return res.status(200).json({
        duplicate: true,
        message: 'Presença já registada há menos de um minuto',
        checkin: last,
      });
    }
  }

  const stmt = db.prepare(`
    INSERT INTO checkins (employee_id, device_id, method, confidence, evidence_photo_base64)
    VALUES (@employee_id, @device_id, @method, @confidence, @evidence_photo_base64)
  `);

  const info = stmt.run({
    employee_id,
    device_id: req.device.id,
    method: method || 'face',
    confidence: confidence ?? null,
    evidence_photo_base64: evidence_photo_base64 || null,
  });

  const created = db.prepare('SELECT * FROM checkins WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ duplicate: false, checkin: created, employee: { id: employee.id, name: employee.name, department: employee.department } });
});

router.get('/', (req, res) => {
  const { date, employee_id } = req.query;

  let query = `
    SELECT c.*, e.name AS employee_name, e.department AS employee_department
    FROM checkins c
    JOIN employees e ON e.id = c.employee_id
    WHERE 1 = 1
  `;
  const params = [];

  if (date) {
    query += ' AND date(c.created_at) = ?';
    params.push(date);
  }
  if (employee_id) {
    query += ' AND c.employee_id = ?';
    params.push(employee_id);
  }

  query += ' ORDER BY c.created_at DESC LIMIT 200';

  res.json(db.prepare(query).all(...params));
});

module.exports = router;
