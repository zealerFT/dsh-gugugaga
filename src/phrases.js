export const PHRASE_EVENTS = Object.freeze([
  'idle', 'greeting', 'pet', 'feed', 'sleep', 'wake', 'turn',
  'working', 'waiting', 'done', 'offline', 'rest', 'focusStart', 'focusDone', 'focusStop',
]);

export function normalizePhraseLines(input) {
  const lines = typeof input === 'string' ? input.split(/\r?\n/) : Array.isArray(input) ? input : [];
  return lines.filter(line => typeof line === 'string').map(line => [...line.trim()].slice(0, 120).join('')).filter(Boolean).slice(0, 20);
}

export function normalizePhrases(input) {
  const result = {};
  if (!input || typeof input !== 'object') return result;
  for (const event of PHRASE_EVENTS) {
    const lines = normalizePhraseLines(input[event]);
    if (lines.length) result[event] = lines;
  }
  return result;
}

export function choosePhrase(custom, defaults, event, index = 0) {
  const lines = normalizePhraseLines(custom[event]);
  const available = lines.length ? lines : defaults[event] ?? defaults.idle;
  return available[index % available.length];
}
