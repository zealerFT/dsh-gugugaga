import { normalizePhrases } from './phrases.js';

export const STORAGE_KEY = 'dsh-gugugaga-pet:v1';

export const DEFAULT_SETTINGS = Object.freeze({
  size: 152, opacity: 100, wander: false, chatter: true, quiet: true,
  sound: false, speech: false, notifications: false, reducedMotion: false, scope: 'current', reminder: 0,
});

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function bounded(value, fallback, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, minimum, maximum) : fallback;
}

function normalizePosition(position) {
  return position && Number.isFinite(position.x) && Number.isFinite(position.y)
    ? { x: clamp(position.x, 0, 100000), y: clamp(position.y, 0, 100000) } : null;
}

export function normalizeState(input, now = Date.now()) {
  const record = input && typeof input === 'object' ? input : {};
  const settings = { ...DEFAULT_SETTINGS };
  const candidate = record.settings ?? {};
  for (const name of ['wander', 'chatter', 'quiet', 'sound', 'speech', 'notifications', 'reducedMotion']) {
    if (typeof candidate[name] === 'boolean') settings[name] = candidate[name];
  }
  settings.size = bounded(candidate.size, 152, 96, 224);
  settings.opacity = bounded(candidate.opacity, 100, 45, 100);
  settings.scope = candidate.scope === 'all' ? 'all' : 'current';
  settings.reminder = [0, 30, 60, 90].includes(candidate.reminder) ? candidate.reminder : 0;
  const focus = record.focus;
  return {
    version: 1, settings,
    position: normalizePosition(record.position),
    panelPosition: normalizePosition(record.panelPosition),
    phrases: normalizePhrases(record.phrases),
    care: {
      affection: bounded(record.care?.affection, 0, 0, 100000),
      energy: bounded(record.care?.energy, 85, 0, 100),
      updatedAt: bounded(record.care?.updatedAt, now, now - 8 * 60 * 60 * 1000, now),
    },
    rounds: Math.floor(bounded(record.rounds, 0, 0, 1000000)),
    focus: focus && [15, 25, 45, 60].includes(focus.minutes) && Number.isFinite(focus.endsAt)
      && focus.endsAt > now && focus.endsAt <= now + focus.minutes * 60000
      ? { minutes: focus.minutes, endsAt: focus.endsAt } : null,
    asleep: record.asleep === true,
  };
}

export function loadState(storage, now = Date.now()) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return { state: normalizeState(raw ? JSON.parse(raw) : null, now), error: false };
  } catch {
    return { state: normalizeState(null, now), error: true };
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clampPosition(position, width, height, petWidth, petHeight) {
  const maximumX = Math.max(8, width - petWidth - 8);
  const maximumY = Math.max(8, height - petHeight - 8);
  return {
    x: clamp(position?.x ?? maximumX - 18, 8, maximumX),
    y: clamp(position?.y ?? maximumY - 22, 8, maximumY),
  };
}

export function clampPanelPosition(position, width, height, panelWidth) {
  const maximumX = Math.max(12, width - panelWidth - 12);
  const minimumHeight = Math.min(200, Math.max(0, height - 24));
  const maximumY = Math.max(12, height - minimumHeight - 12);
  return { x: clamp(position?.x ?? maximumX, 12, maximumX), y: clamp(position?.y ?? 16, 12, maximumY) };
}
