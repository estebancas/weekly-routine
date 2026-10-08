import '@fontsource/archivo-black/latin-400.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';

import { registerSW } from 'virtual:pwa-register';
import { STRETCH_CUTOFF_MINUTES } from './config.js';
import { nowInZone } from './time.js';
import { getRoutine } from './routine.js';
import { getOverride, setOverride, clearOverride, requestPersistence } from './store.js';
import { createState } from './state.js';
import { motionPlan } from './motion.js';
import { renderHero } from './ui/hero.js';
import { renderDayStrip } from './ui/dayStrip.js';
import { renderConfirmBar } from './ui/confirmBar.js';
import { renderSections } from './ui/sections.js';

registerSW({ immediate: true });

async function boot() {
  const today = nowInZone();

  let selected = today.weekday;
  const override = await getOverride();
  if (override && override.dateKey === today.dateKey) {
    selected = override.weekday;
  } else if (override) {
    clearOverride();
  }

  const evening = today.minutesOfDay >= STRETCH_CUTOFF_MINUTES;
  const state = createState({
    today,
    selected,
    preview: selected,
    openSections: { mobility: !evening, exercises: false, stretch: evening },
  });

  const root = document.getElementById('app');
  let prevView = null; // previous render's view state, for motionPlan

  function render(s) {
    const routine = getRoutine(s.preview);
    const isPreview = s.preview !== s.selected;
    const motion = motionPlan(prevView, { preview: s.preview, isPreview });
    prevView = { preview: s.preview, isPreview };

    const nodes = [
      renderHero({
        routine,
        dateLabel: s.today.dateLabel,
        isPreview,
        isOverridden: s.selected !== s.today.weekday,
      }),
      renderDayStrip({
        today: s.today.weekday,
        selected: s.selected,
        preview: s.preview,
        onPick: (wd) => state.set({ preview: wd }),
      }),
    ];

    nodes.push(
      renderSections({
        routine,
        openSections: s.openSections,
        onToggle: (key, open) => state.patch({ openSections: { ...state.get().openSections, [key]: open } }),
      }),
    );

    if (motion.swap) {
      nodes[0].classList.add('anim-swap'); // hero
      nodes[2].classList.add('anim-swap'); // sections
    }

    if (isPreview) {
      const dock = document.createElement('div');
      dock.className = motion.dockEnter ? 'confirm-dock confirm-dock--enter' : 'confirm-dock';
      dock.append(
        renderConfirmBar({
          weekday: s.preview,
          onConfirm: async () => {
            await setOverride({ dateKey: s.today.dateKey, weekday: s.preview });
            state.set({ selected: s.preview });
          },
          onBack: () => state.set({ preview: s.selected }),
        }),
      );
      nodes.push(dock);
    }

    root.classList.toggle('app--docked', isPreview);
    root.replaceChildren(...nodes);
  }

  state.subscribe(render);
  render(state.get());
  requestPersistence();
}

boot();
