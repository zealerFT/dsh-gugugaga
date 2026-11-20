export function createActivityTracker() {
  let previous = new Map();
  let previousScope = '';
  let wasConnected = false;
  let eligible = new Set();
  return (statuses, currentId, connectionState, scope = 'current') => {
    const connected = connectionState === 'connected';
    const scopeKey = scope === 'all' ? 'all' : `current:${currentId ?? ''}`;
    const selected = statuses instanceof Map ? new Map([...statuses].filter(([identifier]) => scope === 'all' || identifier === currentId)) : new Map();
    let running = 0;
    let waiting = 0;
    let completed = 0;
    if (!connected || !wasConnected || scopeKey !== previousScope) eligible = new Set();
    for (const [identifier, status] of selected) {
      if (status?.running) running += 1;
      if (status?.pendingInteraction) waiting += 1;
      if (connected && wasConnected && scopeKey === previousScope && status?.running === true && previous.get(identifier) !== true) eligible.add(identifier);
      if (eligible.has(identifier) && status?.running === false && !status.pendingInteraction) {
        completed += 1;
        eligible.delete(identifier);
      }
    }
    for (const identifier of eligible) if (!selected.has(identifier)) eligible.delete(identifier);
    previous = new Map([...selected].map(([identifier, status]) => [identifier, status?.running]));
    previousScope = scopeKey;
    wasConnected = connected;
    return { connected, running: connected ? running : 0, waiting: connected ? waiting : 0, completed };
  };
}

export function bindDsh(context, publish, scope) {
  const tracker = createActivityTracker();
  const sources = [context.uiSession?.sessionStatus, context.uiSession?.current, context.connection?.state];
  if (sources.some(source => typeof source?.getSnapshot !== 'function' || typeof source?.subscribe !== 'function')) {
    publish({ connected: false, running: 0, waiting: 0, completed: 0, unavailable: true });
    return { refresh() {}, dispose() {} };
  }
  let active = true;
  const refresh = () => {
    if (!active) return;
    publish(tracker(sources[0].getSnapshot(), sources[1].getSnapshot()?.key, sources[2].getSnapshot(), scope()));
  };
  const disposers = sources.map(source => source.subscribe(refresh));
  refresh();
  return {
    refresh,
    dispose() {
      active = false;
      for (const dispose of disposers) dispose();
    },
  };
}
