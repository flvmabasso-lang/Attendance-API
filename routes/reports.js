// routes/reports.js
const express = require('express');
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
router.use(adminAuth);

const WORK_START_TIME = process.env.WORK_START_TIME || '08:00';
const TOLERANCE_MINUTES = parseInt(process.env.TOLERANCE_MINUTES || '15', 10);

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

router.get('/summary', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const employees = db.prepare('SELECT id, name, department, photo_base64 FROM employees WHERE active = 1').all();

  const firstCheckins = db.prepare(`
    SELECT employee_id, MIN(created_at) AS first_at
    FROM checkins
    WHERE date(created_at) = ?
    GROUP BY employee_id
  `).all(date);

  const checkinMap = new Map(firstCheckins.map(c => [c.employee_id, c.first_at]));
  const limitMinutes = toMinutes(WORK_START_TIME) + TOLERANCE_MINUTES;

  const rows = employees.map(emp => {
    const firstAt = checkinMap.get(emp.id);
    if (!firstAt) {
      return { ...emp, status: 'absent', check_in_time: null };
    }
    const timePart = firstAt.split(' ')[1] || firstAt.split('T')[1];
    const [h, m] = timePart.split(':').map(Number);
    const minutesOfDay = h * 60 + m;
    const status = minutesOfDay > limitMinutes ? 'late' : 'present';
    return { ...emp, status, check_in_time: firstAt };
  });

  const summary = {
    date,
    work_start_time: WORK_START_TIME,
    tolerance_minutes: TOLERANCE_MINUTES,
    total_employees: employees.length,
    present_count: rows.filter(r => r.status === 'present').length,
    late_count: rows.filter(r => r.status === 'late').length,
    absent_count: rows.filter(r => r.status === 'absent').length,
    employees: rows,
  };

  res.json(summary);
});

router.get('/checkins', (req, res) => {
  const { from, to, employee_id, department } = req.query;

  let query = `
    SELECT c.id, c.created_at, c.method, c.confidence, c.device_id,
           e.id AS employee_id, e.name AS employee_name, e.department AS employee_department
    FROM checkins c
    JOIN employees e ON e.id = c.employee_id
    WHERE 1 = 1
  `;
  const params = [];

  if (from) { query += ' AND date(c.created_at) >= ?'; params.push(from); }
  if (to) { query += ' AND date(c.created_at) <= ?'; params.push(to); }
  if (employee_id) { query += ' AND c.employee_id = ?'; params.push(employee_id); }
  if (department) { query += ' AND e.department = ?'; params.push(department); }

  query += ' ORDER BY c.created_at DESC LIMIT 1000';

  res.json(db.prepare(query).all(...params));
});

module.exports = router;
