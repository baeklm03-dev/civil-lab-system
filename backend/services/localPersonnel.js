const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/personnel.json');

function ensureFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}

function readAll() {
  ensureFile();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return []; }
}

function writeAll(data) {
  ensureFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getAll() { return readAll(); }

function append(record) {
  const all = readAll();
  all.push(record);
  writeAll(all);
  return record;
}

function updateOne(id, fields) {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...fields };
  writeAll(all);
  return all[idx];
}

module.exports = { getAll, append, updateOne };
