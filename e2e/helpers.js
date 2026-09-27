import { DAY_NAMES } from '../src/config.js';

/** Sets the faked wall clock (page.clock.setFixedTime only fakes Date, not timers) and navigates. */
export async function gotoAt(page, isoUtc) {
  await page.clock.setFixedTime(new Date(isoUtc));
  await page.goto('/');
}

/** The day-strip chip for a given weekday name, e.g. dayChip(page, 'Jueves'). */
export function dayChip(page, dayName) {
  return page.getByRole('button', { name: `Ver rutina de ${dayName}` });
}

export const heroDay = (page) => page.locator('.hero__day');
export const heroTag = (page) => page.locator('.hero .tag__label');
export const confirmBar = (page) => page.locator('.confirm');
export const volverButton = (page) => page.getByRole('button', { name: 'Volver' });
export const confirmarButton = (page) => page.getByRole('button', { name: 'Confirmar' });

export { DAY_NAMES };
