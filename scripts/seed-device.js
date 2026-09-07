// scripts/seed-device.js
// Uso: node scripts/seed-device.js "tablet-entrada-principal" "Entrada principal"
const crypto = require('crypto');
const db = require('../db');

const [, , deviceId, label] = process.argv;

if (!deviceId) {
  console.error('Uso: node scripts/seed-device.js <device_id> [label]');
  process.exit(1);
}

const apiKey = crypto.randomBytes(24).toString('hex');

db.prepare(`
  INSERT INTO devices (id, api_key, label)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET api_key = excluded.api_key, label = excluded.label
`).run(deviceId, apiKey, label || null);

console.log('Dispositivo registado com sucesso:');
console.log('  device_id:', deviceId);
console.log('  api_key  :', apiKey);
console.log('\nGuarde esta chave — vai ser usada nos cabeçalhos x-device-id e x-device-key.');
