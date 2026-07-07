import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

interface Subsidy {
  id: string;
  title: string;
  category?: string;
  deadlineStatus?: string;
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
    const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');
    const raw: unknown = JSON.parse(readFileSync(dataPath, 'utf-8'));
    if (!Array.isArray(raw)) {
      throw new Error(`subsidies.json root must be an array, got ${typeof raw}`);
    }
    subsidies = raw as Subsidy[];
  });

  test('no duplicate ids across all subsidies', () => {
    const seen = new Map<string, Subsidy[]>();
    for (const s of subsidies) {
      if (s == null || typeof s !== 'object') {
        throw new Error(`subsidies.json contains a non-object entry: ${JSON.stringify(s)}`);
      }
      if (typeof s.id !== 'string' || s.id.trim() === '') {
        throw new Error(`Subsidy entry has missing, non-string, or whitespace-only id: ${JSON.stringify(s)}`);
      }
      const entries = seen.get(s.id.trim()) ?? [];
      entries.push(s);
      seen.set(s.id.trim(), entries);
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
      if (s == null || typeof s !== 'object') {
        throw new Error(`subsidies.json contains a non-object entry: ${JSON.stringify(s)}`);
      }
      if (typeof s.title !== 'string' || s.title.trim() === '') {
        throw new Error(`Subsidy entry has missing, non-string, or empty title (id="${s.id}"): ${JSON.stringify(s)}`);
      }
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

  test('every subsidy has a valid deadlineStatus field', () => {
    const validValues = new Set(['open', 'ongoing', 'periodic', 'closed', 'seasonal']);
    const missing: string[] = [];

    for (const s of subsidies) {
      if (typeof s.deadlineStatus !== 'string' || !validValues.has(s.deadlineStatus)) {
        missing.push(`  id="${s.id}" (deadlineStatus=${JSON.stringify(s.deadlineStatus)})`);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Found ${missing.length} subsidy(ies) with missing or invalid deadlineStatus:\n${missing.join('\n')}`,
      );
    }

    expect(missing.length).toBe(0);
  });

  test('every subsidy has a non-empty deadline string', () => {
    const missing: string[] = [];

    for (const s of subsidies) {
      if (typeof (s as Record<string, unknown>).deadline !== 'string' || ((s as Record<string, unknown>).deadline as string).trim() === '') {
        missing.push(`  id="${s.id}"`);
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Found ${missing.length} subsidy(ies) with missing or empty deadline:\n${missing.join('\n')}`,
      );
    }

    expect(missing.length).toBe(0);
  });
});
