/** Shared configuration. Change the timezone or cutoff here and nothing else. */

export const TIMEZONE = 'America/Costa_Rica';

/** Before this time (Costa Rica) the warm up opens by default; at or after, the night stretch opens. */
export const STRETCH_CUTOFF = { hour: 18, minute: 30 };
export const STRETCH_CUTOFF_MINUTES = STRETCH_CUTOFF.hour * 60 + STRETCH_CUTOFF.minute;

/** Weekday index follows JS Date: 0 = Sunday. */
export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DAY_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
export const JSON_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Order of chips in the day strip: Monday first, Sunday last. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Days without a strength routine in routine.json. */
export const WEEKEND = {
  6: { focus: 'Ciclismo', note: 'Día de bici. Sin rutina de fuerza.' },
  0: { focus: 'Descanso', note: 'Descanso total. Sin rutina hoy.' },
};

export const SECTIONS = [
  { key: 'mobility', num: '01', title: 'Calentamiento' },
  { key: 'exercises', num: '02', title: 'Ejercicios' },
  { key: 'stretch', num: '03', title: 'Estiramiento nocturno' },
];

export const LABELS = {
  appName: 'Rutina semanal',
  today: 'Hoy',
  preview: 'Vista previa',
  changed: 'Cambiado',
  confirmQuestion: (dayName) => `¿Usar ${dayName} como rutina de hoy?`,
  confirm: 'Confirmar',
  back: 'Volver',
  superset: 'Superserie',
  pickDay: (dayName) => `Ver rutina de ${dayName}`,
  searchVideo: (name) => `Buscar video de ${name}`,
  copyName: (name) => `Copiar nombre de ${name}`,
  copied: 'Copiado',
  startTimer: (name) => `Iniciar temporizador de ${name}`,
  timerRegion: 'Temporizador',
  timerHold: 'Aguante',
  timerRest: 'Descanso',
  timerGetReady: 'Prepárate',
  timerRound: (round, rounds, side, sides) =>
    `SERIE ${round}/${rounds}${sides > 1 ? ` · LADO ${side}/${sides}` : ''}`,
  timerPause: 'Pausar',
  timerResume: 'Reanudar',
  timerReset: 'Reiniciar',
  timerClose: 'Cerrar temporizador',
  timerMinus: (s) => `Restar ${s} segundos`,
  timerPlus: (s) => `Sumar ${s} segundos`,
  timerDone: 'Tiempo',
  timerAnnounceRound: (round, rounds, side, sides) =>
    `Serie ${round} de ${rounds}${sides > 1 ? `, lado ${side} de ${sides}` : ''}`,
};

/** Wait this long after launching the YouTube app on iOS before falling back to the web page. */
export const YOUTUBE_FALLBACK_MS = 1500;
/** How long the copy button shows its "copied" check before reverting. */
export const COPY_FEEDBACK_MS = 2000;

/** Default rest countdown for rep-based items, and the ± step of the bar's adjust buttons. */
export const REST_DEFAULT_S = 60;
export const REST_STEP_S = 15;
/** "Get ready" gap between rounds of a multi-round hold. */
export const ROUND_GAP_S = 5;
/** How often the running bar re-reads the clock (the value itself comes from Date.now deltas). */
export const TIMER_TICK_MS = 250;
/** How long the bar flashes acid green when a countdown hits zero. */
export const TIMER_FLASH_MS = 1200;
