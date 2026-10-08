import { describe, it, expect } from 'vitest';
import {
  DAY_NAMES,
  DAY_SHORT,
  JSON_DAY_NAMES,
  DAY_ORDER,
  STRETCH_CUTOFF,
  STRETCH_CUTOFF_MINUTES,
  WEEKEND,
  SECTIONS,
  LABELS,
} from '../../src/config.js';

describe('config', () => {
  it('day-name arrays have 7 entries and are index-aligned (0 = Sunday)', () => {
    for (const arr of [DAY_NAMES, DAY_SHORT, JSON_DAY_NAMES]) expect(arr).toHaveLength(7);
    expect(DAY_NAMES).toEqual(['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);
    expect(DAY_SHORT[0]).toBe('DOM');
    expect(JSON_DAY_NAMES).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  });

  it('DAY_ORDER is a permutation of 0-6 starting at Monday(1) and ending at Sunday(0)', () => {
    expect(DAY_ORDER).toHaveLength(7);
    expect([...DAY_ORDER].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(DAY_ORDER[0]).toBe(1);
    expect(DAY_ORDER[DAY_ORDER.length - 1]).toBe(0);
  });

  it('STRETCH_CUTOFF_MINUTES is derived from STRETCH_CUTOFF', () => {
    expect(STRETCH_CUTOFF).toEqual({ hour: 18, minute: 30 });
    expect(STRETCH_CUTOFF_MINUTES).toBe(18 * 60 + 30);
    expect(STRETCH_CUTOFF_MINUTES).toBe(1110);
  });

  it('WEEKEND covers exactly Saturday(6) and Sunday(0), each with a focus and a note', () => {
    expect(Object.keys(WEEKEND).map(Number).sort()).toEqual([0, 6]);
    expect(WEEKEND[6]).toEqual({ focus: 'Ciclismo', note: 'Día de bici. Sin rutina de fuerza.' });
    expect(WEEKEND[0]).toEqual({ focus: 'Descanso', note: 'Descanso total. Sin rutina hoy.' });
  });

  it('SECTIONS lists mobility/exercises/stretch numbered 01-03', () => {
    expect(SECTIONS.map((s) => s.key)).toEqual(['mobility', 'exercises', 'stretch']);
    expect(SECTIONS.map((s) => s.num)).toEqual(['01', '02', '03']);
    for (const s of SECTIONS) expect(s.title).toBeTruthy();
  });

  it('LABELS.appName is set', () => {
    expect(LABELS.appName).toBe('Rutina semanal');
  });

  it('LABELS.confirmQuestion interpolates the day name', () => {
    expect(LABELS.confirmQuestion('Jueves')).toBe('¿Usar Jueves como rutina de hoy?');
  });

  it('LABELS.pickDay interpolates the day name', () => {
    expect(LABELS.pickDay('Lunes')).toBe('Ver rutina de Lunes');
  });

  it('LABELS.searchVideo and LABELS.copyName name the exercise', () => {
    expect(LABELS.searchVideo('Sentadilla')).toBe('Buscar video de Sentadilla');
    expect(LABELS.copyName('Sentadilla')).toBe('Copiar nombre de Sentadilla');
    expect(LABELS.copied).toBe('Copiado');
  });
});
