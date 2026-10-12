import './timerBar.css';
import { LABELS, REST_STEP_S, TIMER_TICK_MS, TIMER_FLASH_MS } from '../config.js';
import { createEngine } from '../timer/engine.js';
import { Button, DockBar } from './primitives/index.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Docked countdown bar. It is mounted once, outside the tree main.js rebuilds on every
 * render, and updates its own nodes in place, so picking a day never resets it.
 * @param {object} o
 * @param {HTMLElement} o.app          the #app root, gets `app--timer` while the bar is open
 * @param {ReturnType<typeof import('../timer/alerts.js').createAlerts>} o.alerts
 * @param {() => number} [o.now]
 * @param {HTMLElement} [o.mount]
 */
export function createTimerBar({ app, alerts, now = Date.now, mount = document.body }) {
  const engine = createEngine({ now });
  let timer = null;
  let flashTimer = null;
  let bar = null;
  let refs = null;

  function build() {
    const name = el('p', 'timer__name');
    const kind = el('span', 'timer__kind');
    const round = el('span', 'timer__round');
    const head = el('div', 'timer__head');
    head.append(kind, round);
    const clock = el('div', 'timer__clock');
    const live = el('div', 'u-sr-only');
    live.setAttribute('aria-live', 'polite');

    const minus = Button({
      label: `−${REST_STEP_S}`,
      variant: 'secondary',
      size: 'sm',
      ariaLabel: LABELS.timerMinus(REST_STEP_S),
      onClick: () => change(() => engine.adjust(-REST_STEP_S)),
    });
    const plus = Button({
      label: `+${REST_STEP_S}`,
      variant: 'secondary',
      size: 'sm',
      ariaLabel: LABELS.timerPlus(REST_STEP_S),
      onClick: () => change(() => engine.adjust(REST_STEP_S)),
    });
    const toggle = Button({ label: LABELS.timerPause, variant: 'primary', size: 'sm', onClick: onToggle });
    const reset = Button({
      label: '↺',
      variant: 'secondary',
      size: 'sm',
      ariaLabel: LABELS.timerReset,
      onClick: () => change(() => engine.reset()),
    });
    const close = Button({
      label: '✕',
      variant: 'ghost',
      size: 'sm',
      ariaLabel: LABELS.timerClose,
      onClick: () => api.close(),
    });
    const controls = el('div', 'timer__controls');
    controls.append(minus, toggle, plus, reset, close);

    bar = DockBar({
      shadow: 'accent-2',
      className: 'timer-dock',
      panelClassName: 'timer',
      role: 'timer',
      ariaLabel: LABELS.timerRegion,
      children: [head, name, clock, controls, live],
    });
    const panel = bar.firstElementChild;
    refs = { panel, name, kind, round, clock, live, toggle };
    mount.append(bar);
  }

  function render() {
    const snap = engine.snapshot();
    refs.kind.textContent = snap.phase === 'gap' ? LABELS.timerGetReady : snap.kind === 'hold' ? LABELS.timerHold : LABELS.timerRest;
    refs.round.textContent =
      snap.kind === 'hold' ? LABELS.timerRound(snap.round, snap.rounds, snap.side, snap.sides) : '';
    refs.clock.textContent = formatClock(snap.remainingMs);
    refs.toggle.textContent = snap.status === 'paused' ? LABELS.timerResume : LABELS.timerPause;
    refs.toggle.disabled = snap.status === 'done';
    refs.panel.classList.toggle('timer--done', snap.status === 'done');
    return snap;
  }

  function flash() {
    refs.panel.classList.add('timer--flash');
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => refs?.panel.classList.remove('timer--flash'), TIMER_FLASH_MS);
  }

  function sync() {
    if (!bar) return;
    const events = engine.tick();
    const snap = render();
    if (events.length) {
      alerts.alert();
      flash();
      if (events.includes('done')) refs.live.textContent = LABELS.timerDone;
      else if (events.includes('round-start')) {
        refs.live.textContent = LABELS.timerAnnounceRound(snap.round, snap.rounds, snap.side, snap.sides);
      }
    }
    if (snap.status !== 'running') stopLoop();
  }

  function startLoop() {
    if (timer === null) timer = setInterval(sync, TIMER_TICK_MS);
    alerts.acquireWakeLock();
  }

  function stopLoop() {
    clearInterval(timer);
    timer = null;
    alerts.releaseWakeLock();
  }

  function change(fn) {
    fn();
    const snap = render();
    if (snap.status === 'running') startLoop();
    else stopLoop();
  }

  function onToggle() {
    const { status } = engine.snapshot();
    change(() => (status === 'paused' ? engine.resume() : engine.pause()));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !bar) return;
    sync();
    if (engine.snapshot().status === 'running') alerts.acquireWakeLock();
  });

  const api = {
    /** Start (or replace) the timer for an item. Call from a tap: it unlocks audio. */
    start(name, config) {
      alerts.unlock();
      if (!bar) build();
      refs.name.textContent = name;
      refs.live.textContent = '';
      app.classList.add('app--timer');
      change(() => engine.start(config));
    },
    close() {
      if (!bar) return;
      stopLoop();
      clearTimeout(flashTimer);
      bar.remove();
      bar = null;
      refs = null;
      app.classList.remove('app--timer');
    },
  };
  return api;
}
