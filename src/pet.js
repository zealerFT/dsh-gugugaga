import front from '../assets/front.png';
import side from '../assets/side.png';
import back from '../assets/back.png';
import sleeping from '../assets/sleep.png';
import smile from '../assets/smile.png';
import happy from '../assets/happy.png';
import eating from '../assets/eating.png';
import blink from '../assets/blink.png';
import styles from './pet.css';
import { t } from './i18n/index.ts';
import { DEFAULT_SETTINGS, loadState, saveState, clampPosition, clampPanelPosition, clamp } from './storage.js';
import { PetModel, timerLabel, expressionFor } from './model.js';
import { PHRASE_EVENTS, normalizePhraseLines, choosePhrase } from './phrases.js';

const portraits = { front, side, back, sleep: sleeping, smile, happy, eating, blink };
const expressionLabels = {
  front: 'expressionFront', side: 'expressionSide', back: 'expressionBack', sleep: 'expressionSleep',
  smile: 'expressionSmile', happy: 'expressionHappy', eating: 'expressionEating', blink: 'expressionBlink',
};

const phraseKeys = {
  idle: ['sayIdle1', 'sayIdle2', 'sayIdle3'], greeting: ['greeting'], pet: ['sayPet'], feed: ['sayFeed'],
  sleep: ['saySleep'], wake: ['sayWake'], turn: ['sayTurn'], working: ['sayWorking'], waiting: ['sayWaiting'],
  done: ['sayDone'], offline: ['sayOffline'], rest: ['sayRest'], focusStart: ['sayFocusStart'],
  focusDone: ['sayFocusDone'], focusStop: ['sayFocusStop'],
};

const phraseLabels = {
  idle: 'phraseIdle', greeting: 'phraseGreeting', pet: 'phrasePet', feed: 'phraseFeed', sleep: 'phraseSleep',
  wake: 'phraseWake', turn: 'phraseTurn', working: 'phraseWorking', waiting: 'phraseWaiting', done: 'phraseDone',
  offline: 'phraseOffline', rest: 'phraseRest', focusStart: 'phraseFocusStart', focusDone: 'phraseFocusDone', focusStop: 'phraseFocusStop',
};

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function button(label, text, action, signal, className = '') {
  const node = element('button', className, text);
  node.type = 'button';
  node.title = label;
  node.setAttribute('aria-label', label);
  node.addEventListener('click', action, { signal });
  return node;
}

export function mountPet(options = {}) {
  document.getElementById('gugugaga-companion')?.dispatchEvent(new Event('gugugaga-dispose'));
  const controller = new AbortController();
  const { signal } = controller;
  let storage;
  try { storage = options.storage ?? window.localStorage; } catch { storage = null; }
  const loaded = loadState(storage);
  const model = new PetModel(loaded.state);
  const defaultPhrases = Object.fromEntries(Object.entries(phraseKeys).map(([event, keys]) => [event, keys.map(key => t(key))]));
  const phraseIndexes = new Map();
  const host = element('div');
  host.id = 'gugugaga-companion';
  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = element('style');
  sheet.textContent = styles;
  shadow.append(sheet);
  const reducedPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stage = element('div', 'stage');
  const sprite = button(t('pet'), '', () => {
    if (suppressClick) { suppressClick = false; return; }
    interact('pet');
  }, signal, 'sprite');
  const portrait = element('img');
  portrait.src = smile;
  portrait.alt = t('name');
  portrait.draggable = false;
  portrait.addEventListener('error', () => say(t('loadingImage'), 10000), { signal });
  const visual = element('div', 'visual');
  visual.append(portrait);
  sprite.append(visual);
  const shadowFloor = element('div', 'shadow');
  const effect = element('span', 'effect');
  effect.setAttribute('aria-hidden', 'true');
  const status = element('div', 'status');
  const statusDot = element('span', 'dot');
  const statusText = element('span');
  status.append(statusDot, statusText);
  const actions = element('div', 'actions');
  actions.setAttribute('role', 'toolbar');
  actions.setAttribute('aria-label', t('name'));
  const petButton = button(t('pet'), '♡', () => interact('pet'), signal);
  const feedButton = button(t('feed'), '♧', () => interact('feed'), signal);
  const talkButton = button(t('talk'), '…', talk, signal);
  const menuButton = button(t('settings'), '☷', () => toggleMenu(), signal);
  menuButton.setAttribute('aria-expanded', 'false');
  actions.append(petButton, feedButton, talkButton, menuButton);
  stage.append(shadowFloor, sprite, effect, status, actions);
  const bubble = element('div', 'bubble');
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  const bubbleText = element('span');
  bubble.append(bubbleText);
  const launcher = button(t('show'), t('launcher'), () => {
    hidden = false;
    render();
    say(phrase('greeting'));
    sprite.focus();
  }, signal, 'launcher');
  launcher.hidden = true;
  const menu = element('section', 'menu');
  menu.setAttribute('aria-label', t('settings'));
  menu.hidden = true;
  const header = element('div', 'menu-header');
  const panelGrip = element('div', 'menu-grip');
  panelGrip.tabIndex = 0;
  panelGrip.setAttribute('role', 'button');
  panelGrip.setAttribute('aria-label', t('movePanel'));
  panelGrip.title = t('movePanelHint');
  const avatar = element('img', 'avatar');
  avatar.src = smile;
  avatar.alt = '';
  avatar.draggable = false;
  const heading = element('div', 'heading');
  heading.append(element('strong', '', t('name')), element('span', 'muted', t('tagline')));
  const closeButton = button(t('close'), '×', () => toggleMenu(false), signal, 'icon-close');
  panelGrip.append(avatar, heading);
  header.append(panelGrip, closeButton);
  const connectionLabel = element('p', 'connection');
  const stats = element('div', 'stats');
  const affectionValue = element('strong');
  const energyValue = element('strong');
  const roundValue = element('strong');
  for (const [label, value] of [['affinity', affectionValue], ['energy', energyValue], ['rounds', roundValue]]) {
    const stat = element('div');
    stat.append(value, element('span', 'muted', t(label)));
    stats.append(stat);
  }
  const care = element('div', 'care');
  const sleepButton = button(t('sleep'), t('sleep'), () => interact('sleep'), signal);
  care.append(button(t('pet'), t('pet'), () => interact('pet'), signal), button(t('feed'), t('feed'), () => interact('feed'), signal), sleepButton, button(t('turn'), t('turn'), () => interact('turn'), signal));
  const focusBox = element('div', 'focus-box');
  const focusHeader = element('div', 'focus-header');
  const focusTime = element('strong', 'timer', '25:00');
  focusHeader.append(element('span', '', t('focusTitle')), focusTime);
  const focusControls = element('div', 'focus-controls');
  const focusSelect = element('select');
  focusSelect.setAttribute('aria-label', t('focusTitle'));
  for (const minutes of [15, 25, 45, 60]) {
    const option = element('option', '', t(`minutes${minutes}`));
    option.value = String(minutes);
    focusSelect.append(option);
  }
  focusSelect.value = '25';
  const focusButton = button(t('focusStart'), t('focusStart'), () => {
    if (model.state.focus) {
      model.state.focus = null;
      say(phrase('focusStop'));
    } else {
      model.startFocus(Number(focusSelect.value), Date.now());
      say(phrase('focusStart'));
    }
    persist();
    render();
  }, signal, 'primary');
  focusControls.append(focusSelect, focusButton);
  focusBox.append(focusHeader, focusControls);
  const settingsBox = element('div', 'settings');
  const inputs = new Map();
  function inputRow(key, control) {
    const label = element('label', 'setting');
    label.append(element('span', '', t(key)), control);
    settingsBox.append(label);
    control.addEventListener('change', () => {
      const value = control.type === 'checkbox' ? control.checked : key === 'scope' ? control.value : Number(control.value);
      model.configure({ [key]: value }, Date.now());
      if (key === 'scope') options.onScopeChange?.();
      if (key === 'sound' && value) void enableSound();
      if (key === 'speech' && value) speak(phrase('greeting'));
      if (key === 'notifications' && value) void enableNotifications();
      persist();
      render();
    }, { signal });
    inputs.set(key, control);
  }
  for (const [key, minimum, maximum] of [['size', 96, 224], ['opacity', 45, 100]]) {
    const input = element('input');
    input.type = 'range'; input.min = String(minimum); input.max = String(maximum); input.step = '1';
    inputRow(key, input);
  }
  for (const key of ['scope', 'reminder']) {
    const select = element('select');
    const choices = key === 'scope' ? [['current', 'scopeCurrent'], ['all', 'scopeAll']]
      : [[0, 'reminderOff'], [30, 'reminder30'], [60, 'reminder60'], [90, 'reminder90']];
    for (const [value, label] of choices) {
      const option = element('option', '', t(label)); option.value = String(value); select.append(option);
    }
    inputRow(key, select);
  }
  for (const key of ['wander', 'chatter', 'quiet', 'sound', 'speech', 'notifications', 'reducedMotion']) {
    const input = element('input'); input.type = 'checkbox'; input.setAttribute('role', 'switch'); inputRow(key, input);
  }
  const phraseSettings = element('details', 'phrase-settings');
  phraseSettings.append(element('summary', '', t('customPhrases')));
  const sceneLabel = element('label', 'setting');
  const sceneSelect = element('select');
  for (const event of PHRASE_EVENTS) {
    const option = element('option', '', t(phraseLabels[event])); option.value = event; sceneSelect.append(option);
  }
  sceneLabel.append(element('span', '', t('phraseScene')), sceneSelect);
  const phraseLabel = element('label', 'phrase-label');
  const phraseInput = element('textarea');
  phraseInput.rows = 3;
  phraseInput.maxLength = 4800;
  phraseInput.value = (model.state.phrases.idle ?? []).join('\n');
  phraseInput.placeholder = defaultPhrases.idle.join('\n');
  phraseLabel.append(element('span', '', t('phraseText')), phraseInput);
  const phraseFeedback = element('p', 'hint');
  phraseFeedback.setAttribute('role', 'status');
  let phraseScene = 'idle';
  function savePhraseInput() {
    model.state.phrases[phraseScene] = normalizePhraseLines(phraseInput.value);
    phraseIndexes.delete(phraseScene);
    phraseFeedback.textContent = t(persist() ? 'phrasesSaved' : 'phrasesSaveError');
  }
  sceneSelect.addEventListener('change', () => {
    savePhraseInput();
    phraseScene = sceneSelect.value;
    phraseInput.value = (model.state.phrases[phraseScene] ?? []).join('\n');
    phraseInput.placeholder = defaultPhrases[phraseScene].join('\n');
  }, { signal });
  const phraseActions = element('div', 'phrase-actions');
  phraseActions.append(
    button(t('savePhrases'), t('savePhrases'), savePhraseInput, signal),
    button(t('previewPhrase'), t('previewPhrase'), () => {
      savePhraseInput();
      const message = phrase(phraseScene);
      toggleMenu(false);
      say(message); speak(message);
    }, signal),
  );
  phraseSettings.append(sceneLabel, phraseLabel, element('p', 'hint', t('phraseHint')), phraseActions, phraseFeedback);
  const footer = element('div', 'footer');
  footer.append(
    button(t('position'), t('position'), () => { position = null; docked = true; persistPosition(); render(); }, signal),
    button(t('resetPanel'), t('resetPanel'), () => { panelPosition = null; render(); persistPosition(); }, signal),
    button(t('reset'), t('reset'), () => {
      model.configure(DEFAULT_SETTINGS, Date.now()); position = null; docked = true; options.onScopeChange?.(); persistPosition(); render();
    }, signal),
    button(t('hide'), t('hide'), () => { hidden = true; toggleMenu(false); render(); launcher.focus(); }, signal),
  );
  const notice = element('p', 'notice');
  notice.hidden = !loaded.error;
  notice.textContent = t('storageError');
  menu.append(header, connectionLabel, stats, care, focusBox, settingsBox, phraseSettings, footer, notice, element('p', 'hint', t('shortcuts')));
  shadow.append(stage, bubble, menu, launcher);
  document.body.append(host);

  let disposed = false;
  let hidden = false;
  let menuOpen = false;
  let position = model.state.position;
  let docked = position === null;
  let panelPosition = model.state.panelPosition;
  let panelDrag = null;
  let drag = null;
  let suppressClick = false;
  let bubbleUntil = 0;
  let nextChatter = Date.now() + 75000;
  let nextWalk = Date.now() + 20000;
  let nextBlink = Date.now() + 5000;
  let blinking = false;
  let blinkTimeout;
  let walkUntil = 0;
  let walkDirection = 1;
  let audio;
  let utterance;
  let speakingOwn = false;
  const pendingEvents = new Set();
  const notifications = new Set();
  let lastPersist = Date.now();
  let lastMode = '';

  function persist() {
    const saved = saveState(storage, model.state);
    if (!saved) { notice.textContent = t('storageError'); notice.hidden = false; }
    return saved;
  }

  function persistPosition() {
    model.state.position = docked ? null : position;
    model.state.panelPosition = panelPosition;
    persist();
  }

  function phrase(event) {
    const index = phraseIndexes.get(event) ?? 0;
    phraseIndexes.set(event, index + 1);
    return choosePhrase(model.state.phrases, defaultPhrases, event, index);
  }

  function say(message, duration = 5500) {
    bubbleText.textContent = message;
    bubbleUntil = Date.now() + duration;
    render();
  }

  function speak(message) {
    if (!model.state.settings.speech) return;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      model.configure({ speech: false }, Date.now()); say(t('speechError')); return;
    }
    if (window.speechSynthesis.speaking) return;
    utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'zh-CN'; utterance.rate = 1.05; utterance.pitch = 1.3; utterance.volume = 0.55;
    speakingOwn = true;
    utterance.onend = utterance.onerror = () => { speakingOwn = false; };
    window.speechSynthesis.speak(utterance);
  }

  async function enableSound() {
    try {
      audio ??= new AudioContext();
      await audio.resume();
      if (!disposed) chime();
    } catch {
      if (disposed) return;
      model.configure({ sound: false }, Date.now()); persist(); say(t('soundError'));
    }
  }

  function chime() {
    if (!model.state.settings.sound || !audio || audio.state !== 'running' || model.isQuiet(Date.now())) return;
    for (const [index, frequency] of [660, 880].entries()) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + index * 0.12;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.065, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + 0.2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }

  async function enableNotifications() {
    try {
      if (!('Notification' in window)) throw new Error('unavailable');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('denied');
    } catch {
      if (disposed) return;
      model.configure({ notifications: false }, Date.now()); persist(); say(t('notificationError'));
    }
  }

  function notify(message) {
    if (disposed || !model.state.settings.notifications || model.isQuiet(Date.now()) || model.state.asleep
      || (!document.hidden && document.hasFocus()) || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const notification = new Notification(t('name'), { body: message, icon: smile, tag: 'gugugaga-companion', silent: true });
      notifications.add(notification);
      notification.onclick = () => { window.focus(); notification.close(); };
      notification.onclose = () => notifications.delete(notification);
    } catch {
      notice.textContent = t('notificationError'); notice.hidden = false;
    }
  }

  function talk(manual = true) {
    const message = phrase('idle');
    if (manual) model.lastActivity = Date.now();
    say(message); speak(message);
  }

  function interact(kind) {
    const outcome = model.interact(kind, Date.now());
    if (outcome === 'cooldown') say(t('sayCooldown'));
    else if (outcome) { const message = phrase(outcome); say(message); speak(message); }
    persist(); render();
  }

  function toggleMenu(value = !menuOpen) {
    menuOpen = value;
    walkUntil = 0;
    menu.hidden = !value;
    menuButton.setAttribute('aria-expanded', String(value));
    render();
    persistPosition();
    if (value) closeButton.focus(); else sprite.focus();
  }

  function render() {
    if (disposed) return;
    const now = Date.now();
    const settings = model.state.settings;
    const width = Math.min(settings.size, Math.max(96, window.innerWidth - 32));
    const height = width * 160 / 112;
    const reduced = settings.reducedMotion || reducedPreference.matches;
    const mode = drag?.moved ? 'dragging' : model.mode(now);
    const walking = !reduced && !menuOpen && !drag && mode === 'idle' && now < walkUntil;
    position = clampPosition(docked ? null : position, window.innerWidth, window.innerHeight, width, height + 34);
    stage.style.left = `${position.x}px`; stage.style.top = `${position.y}px`;
    stage.style.width = `${width}px`; stage.style.height = `${height}px`;
    stage.style.opacity = String(settings.opacity / 100);
    stage.dataset.mode = walking ? 'walking' : mode;
    stage.dataset.reduced = String(reduced);
    stage.dataset.menu = String(menuOpen);
    const expression = expressionFor(model.state.asleep ? 'sleeping' : walking ? 'walking' : mode, blinking && !reduced);
    const imageSource = portraits[expression];
    if (portrait.src !== imageSource) portrait.src = imageSource;
    portrait.alt = `${t('name')} · ${t(expressionLabels[expression])}`;
    portrait.style.transform = walking && walkDirection > 0 ? 'scaleX(-1)' : '';
    statusText.textContent = t(walking ? 'walking' : mode);
    stage.hidden = hidden; launcher.hidden = !hidden;
    bubble.hidden = hidden || menuOpen || now >= bubbleUntil;
    const bubbleWidth = Math.min(238, window.innerWidth - 24);
    bubble.style.width = `${bubbleWidth}px`;
    bubble.style.left = `${clamp(position.x + width / 2 - bubbleWidth / 2, 12, Math.max(12, window.innerWidth - bubbleWidth - 12))}px`;
    bubble.style.top = `${position.y > 96 ? position.y - 76 : Math.min(window.innerHeight - 86, position.y + height + 40)}px`;
    const menuWidth = Math.min(326, window.innerWidth - 24);
    menu.style.width = `${menuWidth}px`;
    if (menuOpen) {
      panelPosition = clampPanelPosition(panelPosition, window.innerWidth, window.innerHeight, menuWidth);
      menu.style.left = `${panelPosition.x}px`;
      menu.style.top = `${panelPosition.y}px`;
      menu.style.maxHeight = `${Math.max(0, Math.min(720, window.innerHeight - panelPosition.y - 12))}px`;
      menu.dataset.dragging = String(Boolean(panelDrag));
    }
    effect.textContent = { happy: '♥', eating: '🐟', sleeping: 'z Z', done: '✦', working: '· · ·', waiting: '!', focus: '◷' }[mode] ?? '';
    affectionValue.textContent = `${t('level')} ${Math.floor(model.state.care.affection / 20) + 1}`;
    energyValue.textContent = `${Math.round(model.state.care.energy)}%`;
    roundValue.textContent = String(model.state.rounds);
    sleepButton.textContent = t(model.state.asleep ? 'wake' : 'sleep');
    sleepButton.setAttribute('aria-label', sleepButton.textContent);
    sleepButton.title = sleepButton.textContent;
    focusTime.textContent = model.state.focus ? timerLabel(model.state.focus.endsAt, now) : `${focusSelect.value}:00`;
    focusButton.textContent = t(model.state.focus ? 'focusCancel' : 'focusStart');
    focusButton.setAttribute('aria-label', focusButton.textContent); focusButton.title = focusButton.textContent;
    focusSelect.disabled = Boolean(model.state.focus);
    connectionLabel.textContent = options.demo ? t('demo') : model.host.unavailable ? t('integrationMissing') : t(model.host.connected ? 'connected' : 'offline');
    if (model.host.running) connectionLabel.textContent += ` · ${t('statusWorking', { count: model.host.running })}`;
    if (model.host.waiting) connectionLabel.textContent += ` · ${t('statusWaiting', { count: model.host.waiting })}`;
    for (const [key, input] of inputs) {
      if (input.type === 'checkbox') input.checked = settings[key]; else if (shadow.activeElement !== input) input.value = String(settings[key]);
    }
    if (mode !== lastMode) { lastMode = mode; options.onMode?.(mode); }
  }

  sprite.addEventListener('contextmenu', event => { event.preventDefault(); toggleMenu(); }, { signal });
  sprite.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const bounds = stage.getBoundingClientRect();
    position = { x: bounds.left, y: bounds.top }; walkUntil = 0;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: position.x, top: position.y, moved: false };
    suppressClick = false;
    sprite.setPointerCapture(event.pointerId);
    model.lastActivity = Date.now(); render();
  }, { signal });
  sprite.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const deltaX = event.clientX - drag.x;
    const deltaY = event.clientY - drag.y;
    if (Math.hypot(deltaX, deltaY) > 5) drag.moved = true;
    if (!drag.moved) return;
    docked = false;
    position = { x: drag.left + deltaX, y: drag.top + deltaY };
    render();
  }, { signal });
  const endDrag = event => {
    if (!drag || drag.id !== event.pointerId) return;
    suppressClick = drag.moved; drag = null; persistPosition(); render();
  };
  sprite.addEventListener('pointerup', endDrag, { signal });
  sprite.addEventListener('pointercancel', endDrag, { signal });
  sprite.addEventListener('lostpointercapture', endDrag, { signal });
  panelGrip.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    panelGrip.focus({ preventScroll: true });
    panelDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: panelPosition.x, top: panelPosition.y };
    panelGrip.setPointerCapture(event.pointerId);
    render();
  }, { signal });
  panelGrip.addEventListener('pointermove', event => {
    if (!panelDrag || panelDrag.id !== event.pointerId) return;
    panelPosition = { x: panelDrag.left + event.clientX - panelDrag.x, y: panelDrag.top + event.clientY - panelDrag.y };
    render();
  }, { signal });
  const endPanelDrag = event => {
    if (!panelDrag || panelDrag.id !== event.pointerId) return;
    panelDrag = null; persistPosition(); render();
  };
  panelGrip.addEventListener('pointerup', endPanelDrag, { signal });
  panelGrip.addEventListener('pointercancel', endPanelDrag, { signal });
  panelGrip.addEventListener('lostpointercapture', endPanelDrag, { signal });
  panelGrip.addEventListener('keydown', event => {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault();
    const distance = event.shiftKey ? 30 : 10;
    panelPosition = { x: panelPosition.x + direction[0] * distance, y: panelPosition.y + direction[1] * distance };
    render(); persistPosition();
  }, { signal });
  shadow.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuOpen) { event.stopPropagation(); toggleMenu(false); }
  }, { signal });
  document.addEventListener('pointerdown', event => {
    if (menuOpen && !event.composedPath().includes(host)) toggleMenu(false);
  }, { signal });
  window.addEventListener('resize', render, { signal });
  reducedPreference.addEventListener('change', render, { signal });
  focusSelect.addEventListener('change', render, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) persist(); else tick();
  }, { signal });
  window.addEventListener('pagehide', persist, { signal });

  function tick() {
    if (disposed) return;
    const now = Date.now();
    const events = model.tick(now);
    for (const event of events) {
      const message = phrase(event);
      pendingEvents.add(message);
      notify(message);
    }
    if (document.hidden) { if (events.length) persist(); return; }
    for (const message of pendingEvents) {
      say(message, 9000);
      chime();
    }
    pendingEvents.clear();
    const mode = model.mode(now);
    if (now >= nextBlink) {
      nextBlink = now + 5000;
      if (!hidden && !drag && ['idle', 'offline', 'focus'].includes(mode)
        && !model.state.settings.reducedMotion && !reducedPreference.matches) {
        blinking = true;
        blinkTimeout = window.setTimeout(() => { blinking = false; render(); }, 160);
      }
    }
    if (now >= nextChatter) {
      nextChatter = now + 75000;
      if (!hidden && !menuOpen && mode === 'idle' && model.state.settings.chatter && !model.isQuiet(now)) talk(false);
    }
    if (now >= nextWalk) {
      nextWalk = now + 20000;
      if (!hidden && !menuOpen && !drag && mode === 'idle' && model.state.settings.wander && !model.isQuiet(now)) {
        walkDirection *= -1;
        docked = false;
        position = { x: position.x + walkDirection * 64, y: position.y };
        walkUntil = now + 2000;
      }
    }
    if (now - lastPersist > 60000) { persistPosition(); lastPersist = now; }
    render();
  }
  const interval = window.setInterval(tick, 1000);

  function dispose() {
    if (disposed) return;
    disposed = true;
    persistPosition();
    controller.abort();
    window.clearInterval(interval);
    window.clearTimeout(blinkTimeout);
    void audio?.close();
    if (speakingOwn) window.speechSynthesis.cancel();
    for (const notification of notifications) notification.close();
    notifications.clear();
    host.remove();
  }
  host.addEventListener('gugugaga-dispose', dispose, { signal });
  say(phrase('greeting'));
  return {
    settings: () => ({ ...model.state.settings }),
    updateHost(snapshot) {
      if (disposed) return;
      const oldHost = model.host;
      const event = model.updateHost(snapshot, Date.now());
      if (event === 'done') { const message = phrase('done'); persist(); say(message, 7500); chime(); notify(message); }
      else if (snapshot.waiting && !oldHost.waiting) { const message = phrase('waiting'); say(message, 12000); chime(); notify(message); }
      else if (snapshot.running && !oldHost.running) say(phrase('working'));
      else if (!snapshot.connected && oldHost.connected) say(phrase('offline'));
      render();
    },
    dispose,
  };
}
