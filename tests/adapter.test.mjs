import test from 'node:test';
import assert from 'node:assert/strict';
import { bindDsh, createActivityTracker } from '../src/adapter.js';

const snapshot = (running, waiting = false) => new Map([['active', { running, pendingInteraction: waiting ? {} : undefined }]]);

test('GUGU-01 observes live turns once, without announcing historical completion', () => {
  const track = createActivityTracker();
  assert.equal(track(snapshot(false), 'active', 'connected').completed, 0);
  assert.equal(track(snapshot(true), 'active', 'connected').running, 1);
  assert.equal(track(snapshot(true, true), 'active', 'connected').waiting, 1);
  assert.equal(track(snapshot(false, true), 'active', 'connected').completed, 0);
  assert.equal(track(snapshot(false), 'active', 'connected').completed, 1);
  assert.equal(track(snapshot(false), 'active', 'connected').completed, 0);
});

test('GUGU-01 reconnect baseline cannot announce work completed while disconnected', () => {
  const track = createActivityTracker();
  track(snapshot(false), 'active', 'connected');
  track(snapshot(true), 'active', 'connected');
  assert.equal(track(snapshot(true), 'active', 'reconnecting').running, 0);
  track(snapshot(true), 'active', 'connected');
  assert.equal(track(snapshot(false), 'active', 'connected').completed, 0);
  track(snapshot(true), 'active', 'connected');
  assert.equal(track(snapshot(false), 'active', 'connected').completed, 1);
});

test('GUGU-01 current session and all sessions remain independent', () => {
  const track = createActivityTracker();
  const statuses = new Map([['active', { running: false }], ['background', { running: true, pendingInteraction: {} }]]);
  assert.equal(track(statuses, 'active', 'connected').running, 0);
  assert.equal(track(statuses, 'active', 'connected', 'all').waiting, 1);
  assert.equal(track(snapshot(false), 'active', 'connected').completed, 0);
  assert.equal(track(new Map(), undefined, 'connected').completed, 0);
});

function store(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    listeners,
    getSnapshot: () => value,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    set(next) { value = next; for (const listener of listeners) listener(); },
  };
}

test('GUGU-05 DSH adapter reads snapshots, emits changes and releases all subscriptions', () => {
  const status = store(snapshot(false));
  const current = store({ key: 'active' });
  const connection = store('connected');
  const received = [];
  const binding = bindDsh({ uiSession: { sessionStatus: status, current }, connection: { state: connection } }, value => received.push(value), () => 'current');
  status.set(snapshot(true));
  status.set(snapshot(false));
  assert.equal(received.at(-1).completed, 1);
  binding.dispose();
  const count = received.length;
  status.set(snapshot(true));
  binding.refresh();
  assert.equal(received.length, count);
  for (const source of [status, current, connection]) assert.equal(source.listeners.size, 0);
});

test('GUGU-05 incompatible host explicitly reports unavailable', () => {
  let result;
  const binding = bindDsh({}, value => { result = value; }, () => 'current');
  assert.equal(result.unavailable, true);
  assert.equal(result.connected, false);
  binding.dispose();
});
