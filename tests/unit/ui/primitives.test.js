import { describe, it, expect, vi } from 'vitest';
import { Button, Chip, Tag, Panel, Details, Input, IconButton } from '../../../src/ui/primitives/index.js';
import * as primitives from '../../../src/ui/primitives/index.js';
import { Button as ButtonDirect } from '../../../src/ui/primitives/Button.js';
import { Chip as ChipDirect } from '../../../src/ui/primitives/Chip.js';
import { Tag as TagDirect } from '../../../src/ui/primitives/Tag.js';
import { Panel as PanelDirect } from '../../../src/ui/primitives/Panel.js';
import { Details as DetailsDirect } from '../../../src/ui/primitives/Details.js';
import { Input as InputDirect } from '../../../src/ui/primitives/Input.js';
import { IconButton as IconButtonDirect } from '../../../src/ui/primitives/IconButton.js';

describe('primitives/index.js re-exports', () => {
  it('re-exports the same function objects as each module', () => {
    expect(primitives.Button).toBe(ButtonDirect);
    expect(primitives.Chip).toBe(ChipDirect);
    expect(primitives.Tag).toBe(TagDirect);
    expect(primitives.Panel).toBe(PanelDirect);
    expect(primitives.Details).toBe(DetailsDirect);
    expect(primitives.Input).toBe(InputDirect);
    expect(primitives.IconButton).toBe(IconButtonDirect);
  });
});

describe('Button', () => {
  it('defaults to variant=primary, size=md, no aria-label', () => {
    const el = Button({ label: 'Go' });
    expect(el.tagName).toBe('BUTTON');
    expect(el.type).toBe('button');
    expect(el.className).toBe('btn btn--primary btn--md');
    expect(el.textContent).toBe('Go');
    expect(el.hasAttribute('aria-label')).toBe(false);
  });

  it('applies a custom variant, size and aria-label', () => {
    const el = Button({ label: 'Back', variant: 'secondary', size: 'sm', ariaLabel: 'go back' });
    expect(el.className).toBe('btn btn--secondary btn--sm');
    expect(el.getAttribute('aria-label')).toBe('go back');
  });

  it('attaches the click handler only when one is given', () => {
    const onClick = vi.fn();
    const el = Button({ label: 'Go', onClick });
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    const noHandler = Button({ label: 'Go' });
    expect(() => noHandler.click()).not.toThrow();
  });
});

describe('Chip', () => {
  it('has no state classes and aria-pressed=false by default', () => {
    const el = Chip({ label: 'LUN' });
    expect(el.className).toBe('chip');
    expect(el.getAttribute('aria-pressed')).toBe('false');
    expect(el.querySelector('.chip__label').textContent).toBe('LUN');
  });

  it('applies selected, preview and marker states independently', () => {
    const el = Chip({ label: 'MAR', selected: true, preview: true, marker: true });
    expect(el.classList.contains('chip--selected')).toBe(true);
    expect(el.classList.contains('chip--preview')).toBe(true);
    expect(el.classList.contains('chip--marker')).toBe(true);
    expect(el.getAttribute('aria-pressed')).toBe('true');
  });

  it('sets aria-label when given and fires onClick', () => {
    const onClick = vi.fn();
    const el = Chip({ label: 'JUE', ariaLabel: 'Ver rutina de Jueves', onClick });
    expect(el.getAttribute('aria-label')).toBe('Ver rutina de Jueves');
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Tag', () => {
  it('defaults to variant=outline', () => {
    const el = Tag({ label: 'Hoy' });
    expect(el.className).toBe('tag tag--outline');
    expect(el.querySelector('.tag__label').textContent).toBe('Hoy');
  });

  it('applies a custom variant', () => {
    const el = Tag({ label: 'Cambiado', variant: 'accent' });
    expect(el.className).toBe('tag tag--accent');
  });
});

describe('Panel', () => {
  it('defaults to a div with no shadow class and no thin class', () => {
    const el = Panel({ children: ['hi'] });
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('panel');
    expect(el.textContent).toBe('hi');
  });

  it('renders as a custom element tag via `as`', () => {
    const el = Panel({ as: 'section' });
    expect(el.tagName).toBe('SECTION');
  });

  it('joins shadow, thin and className without stray spaces', () => {
    const el = Panel({ shadow: 'accent', thin: true, className: 'confirm' });
    expect(el.className).toBe('panel panel--thin panel--shadow-accent confirm');
  });

  it('omits the shadow class when shadow is "none"', () => {
    const el = Panel({ shadow: 'none', className: 'x' });
    expect(el.className).toBe('panel x');
  });

  it('accepts Node children alongside strings', () => {
    const child = document.createElement('span');
    child.textContent = 'node';
    const el = Panel({ children: ['text', child] });
    expect(el.childNodes).toHaveLength(2);
    expect(el.lastElementChild).toBe(child);
  });
});

describe('Details', () => {
  it('defaults to closed, with num/title/glyph but no count', () => {
    const el = Details({ num: '01', title: 'Calentamiento' });
    expect(el.tagName).toBe('DETAILS');
    expect(el.open).toBe(false);
    expect(el.querySelector('.acc__num').textContent).toBe('01');
    expect(el.querySelector('.acc__title').textContent).toBe('Calentamiento');
    expect(el.querySelector('.acc__count')).toBeNull();
    expect(el.querySelector('.acc__glyph').getAttribute('aria-hidden')).toBe('true');
  });

  it('renders a count of 0 (not treated the same as missing)', () => {
    const el = Details({ num: '02', title: 'Ejercicios', count: 0 });
    expect(el.querySelector('.acc__count').textContent).toBe('0');
  });

  it('omits the count element only for undefined/null', () => {
    expect(Details({ num: '01', title: 'x', count: undefined }).querySelector('.acc__count')).toBeNull();
    expect(Details({ num: '01', title: 'x', count: null }).querySelector('.acc__count')).toBeNull();
  });

  it('reflects the `open` prop and appends children into .acc__body', () => {
    const child = document.createElement('p');
    const el = Details({ num: '03', title: 'Estiramiento', open: true, children: [child] });
    expect(el.open).toBe(true);
    expect(el.querySelector('.acc__body').firstElementChild).toBe(child);
  });

  it('calls onToggle(open) when the user toggles it', async () => {
    const onToggle = vi.fn();
    const el = Details({ num: '01', title: 'x', onToggle });
    document.body.append(el);
    el.querySelector('summary').click();
    expect(el.open).toBe(true); // `open` flips synchronously
    // jsdom (like browsers) queues the `toggle` event as a task, not a microtask.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('does not attach a toggle listener when onToggle is omitted', async () => {
    const el = Details({ num: '01', title: 'x' });
    document.body.append(el);
    el.querySelector('summary').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(el.open).toBe(true); // still toggles natively, just nothing to notify
  });
});

describe('Input', () => {
  it('defaults to an empty text input with no name/aria-label', () => {
    const el = Input();
    expect(el.tagName).toBe('INPUT');
    expect(el.type).toBe('text');
    expect(el.value).toBe('');
    expect(el.placeholder).toBe('');
    expect(el.name).toBe('');
    expect(el.hasAttribute('aria-label')).toBe(false);
  });

  it('applies value, placeholder, type, name and aria-label', () => {
    const el = Input({ value: 'x', placeholder: 'search', type: 'search', name: 'q', ariaLabel: 'Search' });
    expect(el.value).toBe('x');
    expect(el.placeholder).toBe('search');
    expect(el.type).toBe('search');
    expect(el.name).toBe('q');
    expect(el.getAttribute('aria-label')).toBe('Search');
  });

  it('calls onInput(value, event) on input', () => {
    const onInput = vi.fn();
    const el = Input({ onInput });
    el.value = 'hello';
    el.dispatchEvent(new Event('input'));
    expect(onInput).toHaveBeenCalledExactlyOnceWith('hello', expect.any(Event));
  });
});

describe('IconButton', () => {
  const icon = () => document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  it('renders a <button type=button> by default with an aria-label and the icon', () => {
    const svg = icon();
    const el = IconButton({ icon: svg, ariaLabel: 'Copiar' });
    expect(el.tagName).toBe('BUTTON');
    expect(el.type).toBe('button');
    expect(el.className).toBe('icon-btn icon-btn--secondary');
    expect(el.getAttribute('aria-label')).toBe('Copiar');
    expect(el.firstChild).toBe(svg);
  });

  it('renders an external <a> when given an href', () => {
    const el = IconButton({ icon: icon(), ariaLabel: 'Buscar', variant: 'primary', href: 'https://x.test/?q=a' });
    expect(el.tagName).toBe('A');
    expect(el.className).toBe('icon-btn icon-btn--primary');
    expect(el.getAttribute('href')).toBe('https://x.test/?q=a');
    expect(el.target).toBe('_blank');
    expect(el.rel).toBe('noopener noreferrer');
  });

  it('attaches the click handler only when one is given', () => {
    const onClick = vi.fn();
    const el = IconButton({ icon: icon(), ariaLabel: 'x', onClick });
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(() => IconButton({ icon: icon(), ariaLabel: 'x' }).click()).not.toThrow();
  });
});
