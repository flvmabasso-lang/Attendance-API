// routes/checkins.js
const express = require('express');
const db = require('../db');
const deviceAuth = require('../middleware/deviceAuth');
const { compareFaces } = require('../lib/rekognition');

const router = express.Router();
router.use(deviceAuth);

const MATCH_THRESHOLD = parseFloat(process.env.FACE_MATCH_THRESHOLD || '90');

// Regista uma presença, respeitando o limite de 60s entre marcações do
// mesmo funcionário (evita duplicados se a pessoa ficar parada em frente).
function recordCheckin({ employee, deviceId, method, confidence, evidencePhoto }) {
  const last = db.prepare(`
    SELECT * FROM checkins WHERE employee_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(employee.id);

  if (last) {
    const secondsSinceLast = (Date.now() - new Date(last.created_at + 'Z').getTime()) / 1000;
    if (secondsSinceLast < 60) {
      return { duplicate: true, checkin: last };
    }
  }

  const info = db.prepare(`
    INSERT INTO checkins (employee_id, device_id, method, confidence, evidence_photo_base64)
    VALUES (?, ?, ?, ?, ?)
  `).run(employee.id, deviceId, method, confidence, evidencePhoto || null);

  return { duplicate: false, checkin: db.prepare('SELECT * FROM checkins WHERE id = ?').get(info.lastInsertRowid) };
}

// Marcação manual (guarda compatibilidade — útil para testes com curl,
// ou um eventual botão de "marcação manual" no futuro).
router.post('/', (req, res) => {
  const { employee_id, method, confidence, evidence_photo_base64 } = req.body;

  if (!employee_id) {
    return res.status(400).json({ error: 'O campo "employee_id" é obrigatório' });
  }

  const employee = db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1').get(employee_id);
  if (!employee) {
    return res.status(404).json({ error: 'Funcionário não encontrado ou inativo' });
  }

  const result = recordCheckin({
    employee,
    deviceId: req.device.id,
    method: method || 'manual',
    confidence: confidence ?? null,
    evidencePhoto: evidence_photo_base64,
  });

  res.status(201).json({
    duplicate: result.duplicate,
    checkin: result.checkin,
    employee: { id: employee.id, name: employee.name, department: employee.department },
  });
});

// Recebe uma foto ao vivo do tablet, compara com todos os funcionários
// cadastrados através da AWS Rekognition, e regista a presença se houver
// semelhança suficiente. É esta rota que o ecrã "Presença" usa.
router.post('/verify-face', async (req, res) => {
  const { photo_base64 } = req.body;
  if (!photo_base64) {
    return res.status(400).json({ error: 'O campo "photo_base64" é obrigatório' });
  }

  const employees = db.prepare('SELECT * FROM employees WHERE active = 1 AND photo_base64 IS NOT NULL').all();
  if (employees.length === 0) {
    return res.status(200).json({ matched: false, message: 'Nenhum funcionário cadastrado' });
  }

  let best = null;
  try {
    const comparisons = await Promise.all(
      employees.map(async (emp) => ({ emp, similarity: await compareFaces(photo_base64, emp.photo_base64) }))
    );
    for (const c of comparisons) {
      if (c.similarity != null && (!best || c.similarity > best.similarity)) {
        best = c;
      }
    }
  } catch (err) {
    console.error('Erro ao comparar com a AWS:', err);
    return res.status(502).json({ error: 'Erro ao comparar com o serviço de reconhecimento facial. Tente novamente.' });
  }

  if (!best || best.similarity < MATCH_THRESHOLD) {
    return res.status(200).json({
      matched: false,
      closest_name: best ? best.emp.name : null,
      closest_similarity: best ? Math.round(best.similarity * 10) / 10 : null,
      threshold: MATCH_THRESHOLD,
    });
  }

  const result = recordCheckin({
    employee: best.emp,
    deviceId: req.device.id,
    method: 'face',
    confidence: best.similarity / 100,
    evidencePhoto: photo_base64,
  });

  res.status(201).json({
    matched: true,
    duplicate: result.duplicate,
    similarity: Math.round(best.similarity * 10) / 10,
    employee: { id: best.emp.id, name: best.emp.name, department: best.emp.department },
    checkin: result.checkin,
  });
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

  if (date) { query += ' AND date(c.created_at) = ?'; params.push(date); }
  if (employee_id) { query += ' AND c.employee_id = ?'; params.push(employee_id); }

  query += ' ORDER BY c.created_at DESC LIMIT 200';

  res.json(db.prepare(query).all(...params));
});

module.exports = router;
