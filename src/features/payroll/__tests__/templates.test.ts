import {
  decimalOnly,
  deletableTemplateId,
  digitsOnly,
  findDuplicate,
  isDeletableTemplate,
  nextTemplateNumber,
  templateDisplayName,
  templateNumber,
  type TemplateBase,
} from '../utils/templates';

const t = (id: string, name: string): TemplateBase => ({ id, name, assignedCount: 0 });

describe('template numbering', () => {
  it('reads plain numeric names only', () => {
    expect(templateNumber('3')).toBe(3);
    expect(templateNumber(' 12 ')).toBe(12);
    expect(templateNumber('3a')).toBeNull();
    expect(templateNumber('')).toBeNull();
    expect(templateNumber(null)).toBeNull();
  });

  it('numbers the next template as highest + 1 (not list length + 1)', () => {
    expect(nextTemplateNumber([])).toBe('1');
    expect(nextTemplateNumber([t('a', '1'), t('b', '2')])).toBe('3');
    expect(nextTemplateNumber([t('a', '1'), t('b', '5')])).toBe('6');
    expect(nextTemplateNumber([t('a', 'x'), t('b', '')])).toBe('1');
  });

  it('falls back to the list position for blank names', () => {
    expect(templateDisplayName(t('a', '4'), 0)).toBe('4');
    expect(templateDisplayName(t('a', ''), 2)).toBe('3');
  });
});

describe('delete rule (highest-numbered template only)', () => {
  it('offers Delete only on the highest number', () => {
    const items = [t('a', '1'), t('c', '3'), t('b', '2')];
    expect(deletableTemplateId(items)).toBe('c');
    expect(isDeletableTemplate(items, 'c')).toBe(true);
    expect(isDeletableTemplate(items, 'a')).toBe(false);
    expect(isDeletableTemplate(items, 'b')).toBe(false);
  });

  it('compares numbers, not strings ("10" beats "9")', () => {
    expect(deletableTemplateId([t('a', '9'), t('b', '10')])).toBe('b');
  });

  it('uses the last template when no name is numeric, and none for an empty list', () => {
    expect(deletableTemplateId([t('a', ''), t('b', '')])).toBe('b');
    expect(deletableTemplateId([])).toBeNull();
  });
});

describe('duplicates and input filters', () => {
  const items = [
    { ...t('a', '1'), v: 100 },
    { ...t('b', '2'), v: 250.5 },
  ];
  it('finds another template with the same value and ignores the one being edited', () => {
    expect(findDuplicate(items, 250.5, (i) => i.v)?.id).toBe('b');
    expect(findDuplicate(items, 250.5, (i) => i.v, 'b')).toBeNull();
    expect(findDuplicate(items, 7, (i) => i.v)).toBeNull();
  });

  it('filters typed text', () => {
    expect(digitsOnly('1a2.3')).toBe('123');
    expect(decimalOnly('1a2.3.4')).toBe('12.34');
    expect(decimalOnly('abc')).toBe('');
  });
});
