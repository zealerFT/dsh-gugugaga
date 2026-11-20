import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPanelPosition, normalizeState, loadState, saveState } from '../src/storage.js';
import { PHRASE_EVENTS, normalizePhraseLines, normalizePhrases, choosePhrase } from '../src/phrases.js';
import { PetModel } from '../src/model.js';

test('GUGU-08 panel and pet positions persist independently', () => {
  let stored;
  const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  const state = normalizeState({ position: { x: 800, y: 500 }, panelPosition: { x: 40, y: 60 } });
  state.panelPosition = clampPanelPosition({ x: 120, y: 300 }, 1200, 800, 326);
  assert.deepEqual(state.position, { x: 800, y: 500 });
  saveState(storage, state);
  const restored = loadState(storage).state;
  assert.deepEqual(restored.panelPosition, { x: 120, y: 300 });
  restored.position = { x: 100, y: 200 };
  assert.deepEqual(restored.panelPosition, { x: 120, y: 300 });
});

test('GUGU-08 panel keeps its drag handle and minimum content area on screen', () => {
  assert.deepEqual(clampPanelPosition({ x: 3000, y: 3000 }, 554, 705, 326), { x: 216, y: 493 });
  assert.deepEqual(clampPanelPosition({ x: -100, y: -200 }, 554, 705, 326), { x: 12, y: 12 });
  assert.equal(normalizeState({ panelPosition: { x: 'bad', y: Infinity } }).panelPosition, null);
  assert.equal(normalizeState({ position: { x: 40, y: 50 } }).panelPosition, null);
});

test('GUGU-09 custom phrases rotate per scene and blank entries fall back', () => {
  const defaults = { idle: ['咕咕嘎嘎'], sleep: ['呼噜…'] };
  const custom = normalizePhrases({ idle: '  我里个嘎嘎！\n\n今天也要开心！  ', sleep: '  ', unknown: ['ignored'] });
  assert.equal(choosePhrase(custom, defaults, 'idle', 0), '我里个嘎嘎！');
  assert.equal(choosePhrase(custom, defaults, 'idle', 1), '今天也要开心！');
  assert.equal(choosePhrase(custom, defaults, 'idle', 2), '我里个嘎嘎！');
  assert.equal(choosePhrase(custom, defaults, 'sleep'), '呼噜…');
  assert.equal(custom.unknown, undefined);
});

test('GUGU-09 custom text stays literal and respects Unicode and size limits', () => {
  assert.deepEqual(normalizePhraseLines(['<b>咕咕嘎嘎</b>', null, 1, '']), ['<b>咕咕嘎嘎</b>']);
  const lines = normalizePhraseLines(Array.from({ length: 25 }, () => '🐧'.repeat(130)));
  assert.equal(lines.length, 20);
  assert.equal([...lines[0]].length, 120);
  assert.ok(PHRASE_EVENTS.includes('sleep'));
});

test('GUGU-09 preferences updates retain custom user phrases', () => {
  const model = new PetModel({ phrases: { sleep: ['嘎嘎要睡啦！'] } });
  model.configure({ size: 190, speech: true }, Date.now());
  const restored = normalizeState(JSON.parse(JSON.stringify(model.state)));
  assert.deepEqual(restored.phrases.sleep, ['嘎嘎要睡啦！']);
  assert.equal(restored.settings.size, 190);
});
