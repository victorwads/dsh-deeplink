import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { deeplinkPrompt } from '../lib/index.js';

test('distribution identity matches the host patch and browser loader', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  let id;
  vm.runInNewContext(source, { window: { __ModuleLoader__: { load(definition) { id = definition.id; } } } });
  assert.equal(manifest.name, 'dsh-deeplink');
  assert.equal(id, manifest.name);
  assert(patch.includes("name: '" + manifest.name + "'"));
  assert.equal(manifest.publishConfig.access, 'public');
  assert.equal(manifest.repository.url, 'git+https://github.com/victorwads/dsh-deeplink.git');
});

test('prompt uses a portable marker and same-tab default instead of guessed origins', () => {
  const prompt = deeplinkPrompt();
  assert(prompt.includes('https://dsh.invalid/?session='));
  assert(prompt.includes('SAME tab by default'));
  assert(prompt.includes('CURRENT browser origin, port and application path'));
  assert(prompt.includes('Do not substitute localhost'));
});

test('prompt distinguishes prior-session search from current-conversation event search', () => {
  const prompt = deeplinkPrompt('http://localhost:3080');
  assert(prompt.includes('session_search({ query: "distinctive literal phrase" })'));
  assert(prompt.includes('literal full-text search, not semantic search'));
  assert(prompt.includes('It does not search the current conversation'));
  assert(prompt.includes('session_event_search({ query: "distinctive literal phrase" })'));
  assert(prompt.includes('session_id is omitted'));
  assert(prompt.includes('No matches do not prove'));
});

test('prompt requires evidence, separates lineage from exact content, and respects tool availability', () => {
  const prompt = deeplinkPrompt('http://localhost:3080');
  assert(prompt.includes('session_event_read({ session_id, seq })'));
  assert(prompt.includes('exact, unabridged event'));
  assert(prompt.includes('session_trace({ session_id })'));
  assert(prompt.includes('not the conversation transcript'));
  assert(prompt.includes('session_event_trace({ session_id, seq })'));
  assert(prompt.includes('shadowed historical event'));
  assert(prompt.includes('Only call tools actually exposed'));
  assert(prompt.includes('instead of scanning private storage files'));
  assert(prompt.includes('URL-encode ids'));
});
