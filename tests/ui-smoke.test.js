import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('shell declares the vacation app title and SAHMT logo', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /Escala de férias 2027/);
  assert.match(html, /sahmt-logo/i);
  assert.match(html, /manifest\.webmanifest/);
});

test('manifest is installable and names the app', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Escala de férias 2027');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons));
});
