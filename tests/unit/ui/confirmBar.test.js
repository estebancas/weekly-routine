import { describe, it, expect, vi } from 'vitest';
import { renderConfirmBar } from '../../../src/ui/confirmBar.js';

describe('renderConfirmBar', () => {
  it('asks the confirm question for the given weekday', () => {
    const el = renderConfirmBar({ weekday: 3, onConfirm: () => {}, onBack: () => {} });
    expect(el.querySelector('.confirm__question').textContent).toBe('¿Usar Miércoles como rutina de hoy?');
  });

  it('renders Volver then Confirmar, wired to onBack/onConfirm respectively', () => {
    const onConfirm = vi.fn();
    const onBack = vi.fn();
    const el = renderConfirmBar({ weekday: 4, onConfirm, onBack });
    const buttons = el.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe('Volver');
    expect(buttons[0].className).toContain('btn--secondary');
    expect(buttons[1].textContent).toBe('Confirmar');
    expect(buttons[1].className).toContain('btn--primary');

    buttons[0].click();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    buttons[1].click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('is a Panel section with the accent shadow and confirm class', () => {
    const el = renderConfirmBar({ weekday: 1, onConfirm: () => {}, onBack: () => {} });
    expect(el.tagName).toBe('SECTION');
    expect(el.classList.contains('panel')).toBe(true);
    expect(el.classList.contains('panel--shadow-accent')).toBe(true);
    expect(el.classList.contains('confirm')).toBe(true);
  });
});
