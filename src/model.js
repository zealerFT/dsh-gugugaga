import { clamp, normalizeState } from './storage.js';

export class PetModel {
  constructor(state, now = Date.now()) {
    this.state = normalizeState(state, now);
    this.host = { connected: false, running: 0, waiting: 0 };
    this.action = null;
    this.celebrateUntil = 0;
    this.lastCare = { pet: -Infinity, feed: -Infinity };
    this.lastTick = now;
    this.lastActivity = now;
    this.nextReminder = now + this.state.settings.reminder * 60000;
  }

  updateHost(snapshot, now) {
    this.host = snapshot;
    if (snapshot.running || snapshot.waiting) this.lastActivity = now;
    if (snapshot.completed > 0) {
      this.state.rounds += snapshot.completed;
      this.celebrateUntil = now + 6000;
      return 'done';
    }
    return null;
  }

  interact(kind, now) {
    this.lastActivity = now;
    if (kind === 'sleep') {
      this.state.asleep = !this.state.asleep;
      this.action = null;
      return this.state.asleep ? 'sleep' : 'wake';
    }
    if (kind === 'turn') {
      this.action = { kind: 'turning', until: now + 3500 };
      return 'turn';
    }
    if (!['pet', 'feed'].includes(kind)) return null;
    const cooldown = kind === 'feed' ? 10000 : 1800;
    if (now - this.lastCare[kind] < cooldown) return 'cooldown';
    this.lastCare[kind] = now;
    this.state.asleep = false;
    this.state.care.affection = Math.min(100000, this.state.care.affection + (kind === 'feed' ? 3 : 1));
    if (kind === 'feed') this.state.care.energy = clamp(this.state.care.energy + 8, 0, 100);
    this.action = { kind: kind === 'feed' ? 'eating' : 'happy', until: now + 3500 };
    return kind;
  }

  isQuiet(now) {
    const hour = new Date(now).getHours();
    return this.state.settings.quiet && (hour >= 23 || hour < 7);
  }

  mode(now) {
    if (this.state.asleep) return 'sleeping';
    if (this.host.connected && this.host.waiting) return 'waiting';
    if (this.action && now < this.action.until) return this.action.kind;
    if (this.host.connected && this.host.running) return 'working';
    if (now < this.celebrateUntil) return 'done';
    if (this.state.focus) return 'focus';
    if (now - this.lastActivity > 180000) return 'sleeping';
    return this.host.connected ? 'idle' : 'offline';
  }

  startFocus(minutes, now) {
    if (![15, 25, 45, 60].includes(minutes)) return false;
    this.state.focus = { minutes, endsAt: now + minutes * 60000 };
    this.state.asleep = false;
    this.lastActivity = now;
    return true;
  }

  configure(settings, now) {
    const previous = this.state.settings.reminder;
    this.state.settings = normalizeState({ settings: { ...this.state.settings, ...settings } }, now).settings;
    if (previous !== this.state.settings.reminder) this.nextReminder = now + this.state.settings.reminder * 60000;
  }

  tick(now) {
    const events = [];
    const elapsedMinutes = clamp((now - this.lastTick) / 60000, 0, 480);
    this.lastTick = now;
    const sleeping = this.mode(now) === 'sleeping';
    this.state.care.energy = clamp(this.state.care.energy + elapsedMinutes * (sleeping ? 0.7 : -0.08), 0, 100);
    this.state.care.updatedAt = now;
    if (this.state.focus && now >= this.state.focus.endsAt) {
      this.state.focus = null;
      this.celebrateUntil = now + 6000;
      this.lastActivity = now;
      events.push('focusDone');
    }
    if (this.state.settings.reminder > 0 && now >= this.nextReminder) {
      this.nextReminder = now + this.state.settings.reminder * 60000;
      if (!this.isQuiet(now) && !this.state.asleep && !this.state.focus && !this.host.waiting) events.push('rest');
    }
    return events;
  }
}

export function timerLabel(endsAt, now) {
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function expressionFor(mode, blinking = false) {
  if (mode === 'happy' || mode === 'done') return 'happy';
  if (mode === 'eating') return 'eating';
  if (mode === 'sleeping') return 'sleep';
  if (mode === 'walking') return 'side';
  if (mode === 'turning') return 'back';
  if (['idle', 'offline', 'focus'].includes(mode)) return blinking ? 'blink' : 'smile';
  return 'front';
}
