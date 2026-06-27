import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Subsidy {
  id: string;
  title: string;
  category?: string;
}

/** Normalize title for dedup comparison: trim, collapse whitespace, 臺→台. */
function normalizeTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/臺/g, '台');
}

test.describe('subsidies.json data integrity', () => {
  let subsidies: Subsidy[];

  test.beforeAll(() => {
    const dataPath = resolve(import.meta.dirname, '../src/data/subsidies.json');
    subsidies = JSON.parse(readFileSync(dataPath, 'utf-8')) as Subsidy[];
  });

  test('no duplicate ids across all subsidies', () => {
    const seen = new Map<string, Subsidy[]>();
    for (const s of subsidies) {
      const entries = seen.get(s.id) ?? [];
      entries.push(s);
      seen.set(s.id, entries);
    }
    const dupes = [...seen.entries()].filter(([, entries]) => entries.length > 1);

    if (dupes.length > 0) {
      const detail = dupes
        .map(
          ([id, entries]) =>
            `  id="${id}" appears ${entries.length}× (categories: ${entries.map(e => e.category ?? '—').join(', ')})`,
        )
        .join('\n');
      throw new Error(`Found ${dupes.length} duplicate id(s) in subsidies.json:\n${detail}`);
    }

    expect(dupes.length).toBe(0);
  });

  test('no duplicate titles (normalized) across all subsidies', () => {
    const seen = new Map<string, Subsidy[]>();
    for (const s of subsidies) {
      const key = normalizeTitle(s.title);
      const entries = seen.get(key) ?? [];
      entries.push(s);
      seen.set(key, entries);
    }
    const dupes = [...seen.entries()].filter(([, entries]) => entries.length > 1);

    if (dupes.length > 0) {
      const detail = dupes
        .map(
          ([normalizedTitle, entries]) =>
            `  title="${normalizedTitle}" appears ${entries.length}× (ids: ${entries.map(e => e.id).join(', ')}; categories: ${entries.map(e => e.category ?? '—').join(', ')})`,
        )
        .join('\n');
      throw new Error(`Found ${dupes.length} duplicate title(s) in subsidies.json:\n${detail}`);
    }

    expect(dupes.length).toBe(0);
  });
});
