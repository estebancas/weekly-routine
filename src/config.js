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
};
