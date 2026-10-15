import assert from 'node:assert/strict';
import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const expected = 'dsh-deeplink';
const repository = 'victorwads/dsh-deeplink';
assert.equal(pkg.name, expected);
assert.equal(pkg.private, undefined);
assert.equal(pkg.repository?.url, 'git+https://github.com/' + repository + '.git');
if (process.env.GITHUB_REPOSITORY) assert.equal(process.env.GITHUB_REPOSITORY, repository);
assert.match(pkg.version, /^[0-9]+[.][0-9]+[.][0-9]+(?:-[0-9A-Za-z.-]+)?$/);
const tag = pkg.version.includes('-') ? pkg.version.split('-')[1].split('.')[0] : 'latest';
assert.match(tag, /^[a-z][a-z0-9._-]*$/);
if (pkg.publishConfig?.tag) assert.equal(pkg.publishConfig.tag, tag);
assert.equal(pkg.publishConfig?.access, 'public');
assert.equal(pkg.publishConfig?.registry, 'https://registry.npmjs.org/');
const patch = readFileSync('cordis.patch.yml', 'utf8');
assert(patch.includes("name: '" + expected + "'"));
const [packed] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], { encoding: 'utf8' }));
const actual = packed.files.map(file => file.path).sort();
assert.deepEqual(actual, ['LICENSE', 'README.md', 'cordis.patch.yml', 'lib/client.js', 'lib/index.js', 'package.json'].sort());
if (process.env.CHECK_REGISTRY === '1') {
  const response = await fetch('https://registry.npmjs.org/' + expected + '/' + encodeURIComponent(pkg.version), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 404, response.ok ? 'Version already published; bump package version' : 'Registry check failed: ' + response.status);
}
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'tag=' + tag + '\nversion=' + pkg.version + '\ngit_tag=v' + pkg.version + '\n');
console.log({ name: expected, version: pkg.version, tag, files: actual });
