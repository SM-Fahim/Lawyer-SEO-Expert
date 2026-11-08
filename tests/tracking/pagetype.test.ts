import { describe, expect, it } from 'vitest';
import checkDist from '../../scripts/check-dist.mjs?raw';
import { PAGE_TYPES, pageTypeOf } from '../../worker/pagetype';

describe('page types', () => {
  it('are the five Meta audience values', () => {
    expect(PAGE_TYPES).toEqual(['service', 'pricing', 'booking', 'blog', 'company']);
  });

  it('match the list check-dist.mjs uses to fail the build', () => {
    const list = /const PAGE_TYPES = (\[[^\]]*\]);/.exec(checkDist)?.[1] ?? '';
    expect(JSON.parse(list.replace(/'/g, '"'))).toEqual([...PAGE_TYPES]);
  });

  it('accept only the five values', () => {
    for (const type of PAGE_TYPES) expect(pageTypeOf(type)).toBe(type);
    for (const bad of ['', 'Service', 'home', 'constructor', 1, null, undefined]) expect(pageTypeOf(bad)).toBeUndefined();
  });
});
