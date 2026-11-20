import test from 'node:test';
import assert from 'node:assert/strict';
import { PetModel, timerLabel, expressionFor } from '../src/model.js';
import { normalizeState, clampPosition, loadState, saveState } from '../src/storage.js';

const noon = new Date(2026, 10, 20, 12).getTime();

test('GUGU-07 startup smiles and interactions change facial expressions', () => {
  const model = new PetModel({}, noon);
  assert.equal(expressionFor(model.mode(noon)), 'smile');
  model.updateHost({ connected: true, running: 0, waiting: 0 }, noon);
  assert.equal(expressionFor(model.mode(noon)), 'smile');
  assert.equal(expressionFor(model.mode(noon), true), 'blink');
  model.interact('pet', noon);
  assert.equal(expressionFor(model.mode(noon)), 'happy');
  assert.equal(expressionFor(model.mode(noon + 4000)), 'smile');
  model.interact('feed', noon + 4000);
  assert.equal(expressionFor(model.mode(noon + 4000)), 'eating');
  model.updateHost({ connected: true, running: 0, waiting: 0, completed: 1 }, noon + 8000);
  assert.equal(expressionFor(model.mode(noon + 8000)), 'happy');
  model.interact('sleep', noon + 9000);
  assert.equal(expressionFor(model.mode(noon + 9000), true), 'sleep');
  model.updateHost({ connected: true, running: 1, waiting: 1 }, noon + 10000);
  assert.equal(expressionFor(model.mode(noon + 10000), true), 'sleep');
  model.interact('sleep', noon + 11000);
  assert.equal(expressionFor(model.mode(noon + 11000), true), 'front');
});

test('GUGU-02 care cooldown, energy bounds and explicit sleep priority', () => {
  const model = new PetModel({}, noon);
  assert.equal(model.interact('pet', noon), 'pet');
  assert.equal(model.interact('pet', noon + 100), 'cooldown');
  assert.equal(model.state.care.affection, 1);
  model.interact('feed', noon);
  assert.equal(model.state.care.affection, 4);
  model.interact('sleep', noon);
  assert.equal(model.mode(noon), 'sleeping');
  model.updateHost({ connected: true, waiting: 1, running: 1 }, noon);
  assert.equal(model.mode(noon), 'sleeping');
  model.tick(noon + 8 * 60 * 60000);
  assert.ok(model.state.care.energy >= 0 && model.state.care.energy <= 100);
});

test('GUGU-02 idle sleep is based on actual elapsed time', () => {
  const model = new PetModel({}, noon);
  model.updateHost({ connected: true, running: 0, waiting: 0 }, noon);
  assert.equal(model.mode(noon), 'idle');
  assert.equal(model.mode(noon + 181000), 'sleeping');
  model.interact('pet', noon + 182000);
  assert.equal(model.mode(noon + 182000), 'happy');
});

test('GUGU-03 focus timer survives throttling and finishes once', () => {
  const model = new PetModel({}, noon);
  assert.equal(model.startFocus(1, noon), false);
  assert.equal(model.startFocus(25, noon), true);
  assert.equal(timerLabel(model.state.focus.endsAt, noon + 1000), '24:59');
  const restored = new PetModel(JSON.parse(JSON.stringify(model.state)), noon + 60000);
  assert.equal(restored.state.focus.endsAt, noon + 25 * 60000);
  assert.deepEqual(restored.tick(noon + 26 * 60000), ['focusDone']);
  assert.equal(restored.state.focus, null);
  assert.deepEqual(restored.tick(noon + 27 * 60000), []);
});

test('GUGU-03 reminders honor quiet hours, focus and disabled state', () => {
  const model = new PetModel({}, noon);
  model.configure({ reminder: 30 }, noon);
  assert.deepEqual(model.tick(noon + 30 * 60000), ['rest']);
  model.startFocus(45, noon + 30 * 60000);
  assert.deepEqual(model.tick(noon + 60 * 60000), []);
  const night = new Date(2026, 10, 20, 23).getTime();
  const quiet = new PetModel({ settings: { reminder: 30 } }, night);
  assert.deepEqual(quiet.tick(night + 30 * 60000), []);
  quiet.configure({ reminder: 0 }, night);
  assert.deepEqual(quiet.tick(night + 60 * 60000), []);
});

test('GUGU-04 corrupted preferences and unavailable storage degrade safely', () => {
  const state = normalizeState({ settings: { size: Infinity, opacity: -10, sound: 'true', scope: 'unsafe' }, care: { affection: -1, energy: NaN }, focus: { minutes: 25, endsAt: Infinity } }, noon);
  assert.equal(state.settings.size, 152);
  assert.equal(state.settings.opacity, 45);
  assert.equal(state.settings.sound, false);
  assert.equal(state.settings.scope, 'current');
  assert.equal(state.care.affection, 0);
  assert.equal(state.focus, null);
  assert.equal(loadState({ getItem: () => '{bad' }).error, true);
  assert.equal(saveState(null, state), false);
});

test('GUGU-04 position stays on screen after resizing and invalid coordinates', () => {
  assert.deepEqual(clampPosition({ x: 9999, y: 9999 }, 320, 568, 152, 250), { x: 160, y: 310 });
  const state = normalizeState({ position: { x: 'hello', y: 12 } }, noon);
  assert.equal(state.position, null);
  const small = clampPosition(null, 100, 100, 152, 250);
  assert.deepEqual(small, { x: 8, y: 8 });
});
