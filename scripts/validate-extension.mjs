import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadJson(relativePath) {
  const content = await readFile(path.join(rootDir, relativePath), 'utf8');
  return JSON.parse(content);
}

async function loadText(relativePath) {
  return readFile(path.join(rootDir, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const manifest = await loadJson('manifest.json');
const popupHtml = await loadText('popup.html');
const popupJs = await loadText('popup.js');

assert(manifest.manifest_version === 3, 'manifest.json must use Manifest V3.');
assert(manifest.action?.default_popup === 'popup.html', 'manifest.json must point to popup.html.');
assert(Array.isArray(manifest.permissions) && manifest.permissions.includes('activeTab'), 'manifest.json must request activeTab.');
assert(Array.isArray(manifest.permissions) && manifest.permissions.includes('scripting'), 'manifest.json must request scripting.');
assert(!manifest.host_permissions || manifest.host_permissions.length === 0, 'manifest.json must not require host permissions; activeTab should cover supported pages.');

for (const size of ['16', '32', '48', '128']) {
  const icon = manifest.icons?.[size];
  assert(icon, `manifest.json must declare a ${size}px icon.`);
  assert(manifest.action?.default_icon?.[size] === icon, `manifest.json action.default_icon must include ${size}px.`);
  await access(path.join(rootDir, icon)).catch(() => assert(false, `Icon file ${icon} is missing.`));
}

assert(/<html[^>]*lang="en"/i.test(popupHtml), 'popup.html must declare a document language.');
assert(/<title>GitHub Security AI Prompter<\/title>/i.test(popupHtml), 'popup.html must include a title.');
assert(/<label[^>]*for="result"/i.test(popupHtml), 'popup.html must label the result textarea.');
assert(/id="result"/i.test(popupHtml), 'popup.html must contain the result textarea.');
assert(/id="extractBtn"/i.test(popupHtml), 'popup.html must contain the extract button.');

assert(/function\s+isSupportedAlertsPage\s*\(/.test(popupJs), 'popup.js must define the supported alerts page guard.');
assert(/security\\\/code-scanning/.test(popupJs), 'popup.js must verify the current page is a code scanning alerts page.');
assert(/function\s+extractSecurityAlerts\s*\(/.test(popupJs), 'popup.js must define extractSecurityAlerts.');
assert(/chrome\.scripting\.executeScript/.test(popupJs), 'popup.js must inject the extractor into the active tab.');

console.log('Extension validation passed.');
