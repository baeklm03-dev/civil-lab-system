const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, '../data/google-token.json');

function getToken() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveToken(tokens) {
  const existing = getToken() || {};
  const merged = { ...existing, ...tokens };
  if (!merged.refresh_token && existing.refresh_token) {
    merged.refresh_token = existing.refresh_token;
  }
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(merged, null, 2));
}

function hasToken() {
  const t = getToken();
  return !!(t && t.refresh_token);
}

module.exports = { getToken, saveToken, hasToken };
