import { mountPet } from './pet.js';
import { createActivityTracker } from './adapter.js';
import { t } from './i18n/index.ts';
import characterPreview from '../assets/character-preview.png';

const root = document.getElementById('preview');
function element(tag, text, className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
const header = element('header', '');
header.append(element('span', t('name'), 'brand'), element('span', 'DEEPSEEK HARNESS · COMPANION 01', 'edition'));
const portrait = element('img', '', 'portrait'); portrait.src = characterPreview; portrait.alt = t('name');
const controls = element('div', '', 'controls');
const tracker = createActivityTracker();
let running = false;
let waiting = false;
let connected = true;
const pet = mountPet({ demo: true, onScopeChange: publish });
function publish() {
  pet.updateHost(tracker(new Map([['preview', { running, pendingInteraction: waiting ? {} : undefined }]]), 'preview', connected ? 'connected' : 'disconnected', pet.settings().scope));
}
const actions = {
  demoIdle: () => { running = false; waiting = false; connected = true; },
  demoWork: () => { running = true; waiting = false; connected = true; },
  demoWait: () => { running = true; waiting = true; connected = true; },
  demoFinish: () => { running = false; waiting = false; },
  demoDisconnect: () => { connected = false; }, demoReconnect: () => { connected = true; },
};
for (const [key, action] of Object.entries(actions)) {
  const control = element('button', t(key)); control.type = 'button'; control.setAttribute('aria-pressed', 'false');
  control.addEventListener('click', () => {
    for (const sibling of controls.children) sibling.setAttribute('aria-pressed', 'false');
    control.setAttribute('aria-pressed', 'true'); action(); publish();
  });
  controls.append(control);
}
const footer = element('footer', ''); footer.append(element('span', t('demoCompanion')), element('span', '01 / GUGUGAGA'));
root.append(header, element('h1', t('demoTitle')), element('p', t('demoSubtitle'), 'lead'), portrait,
  element('p', t('demoIdentity'), 'identity'), element('div', t('demoControls'), 'section'), controls,
  element('p', t('demoHint'), 'note'), element('p', t('demoNote'), 'note'), element('p', t('demoQuote'), 'quote'), footer);
publish();
