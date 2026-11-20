import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('GUGU-05 distributable exposes the actual DSH client module contract', () => {
  let registration;
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  runInNewContext(source, { window: { __ModuleLoader__: { load: value => { registration = value; } } } });
  assert.equal(registration.id, 'dsh-gugugaga-pet');
  const plugin = registration.factory(() => { throw new Error('Client must have no runtime dependencies'); });
  assert.deepEqual([...plugin.inject], ['uiSession', 'connection']);
  assert.equal(typeof plugin.apply, 'function');
});

test('GUGU-06 package includes valid PNG assets derived from the supplied image', () => {
  const provenance = JSON.parse(readFileSync(new URL('../assets/provenance.json', import.meta.url), 'utf8'));
  assert.equal(provenance.aiGenerated, false);
  for (const name of ['front', 'side', 'back', 'sleep', 'smile', 'happy', 'eating', 'blink']) {
    const image = readFileSync(new URL(`../assets/${name}.png`, import.meta.url));
    assert.equal(image.subarray(1, 4).toString(), 'PNG');
    assert.equal(image.readUInt32BE(16), 224);
    assert.equal(image.readUInt32BE(20), 320);
    assert.equal(image[25], 6);
  }
});
