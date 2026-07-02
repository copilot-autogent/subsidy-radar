import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

interface Subsidy {
  id: string;
  officialUrl?: string;
}

test.describe('Official URL link on subsidy cards', () => {
  let subsidies: Subsidy[];

  test.beforeAll(() => {
    const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');
    subsidies = JSON.parse(readFileSync(dataPath, 'utf-8')) as Subsidy[];
  });

  test('at least 20 subsidies have officialUrl populated', () => {
    const withUrl = subsidies.filter(s => s.officialUrl);
    expect(withUrl.length).toBeGreaterThanOrEqual(20);
  });

  test('built HTML: card with officialUrl shows the official link', () => {
    const htmlPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.html');
    if (!existsSync(htmlPath)) {
      test.skip(true, 'dist/index.html not found — run `npm run build` first');
      return;
    }
    const html = readFileSync(htmlPath, 'utf-8');
    const withUrl = subsidies.filter(s => s.officialUrl);
    expect(withUrl.length).toBeGreaterThan(0);

    for (const subsidy of withUrl.slice(0, 3)) {
      const cardRe = new RegExp(`<article[^>]*id="${subsidy.id}"[^>]*>`);
      const cardMatch = cardRe.exec(html);
      expect(cardMatch, `card for ${subsidy.id} not found`).not.toBeNull();
      const cardIdx = cardMatch!.index;
      const nextCardIdx = html.indexOf('<article', cardIdx + cardMatch![0].length);
      const cardSlice = nextCardIdx > -1 ? html.slice(cardIdx, nextCardIdx) : html.slice(cardIdx);
      expect(cardSlice).toContain('card-official-link');
      expect(cardSlice).toContain('查看官方說明');
      expect(cardSlice).toContain(subsidy.officialUrl!);
    }
  });

  test('built HTML: card without officialUrl does not show the official link', () => {
    const htmlPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.html');
    if (!existsSync(htmlPath)) {
      test.skip(true, 'dist/index.html not found — run `npm run build` first');
      return;
    }
    const html = readFileSync(htmlPath, 'utf-8');
    const withoutUrl = subsidies.find(s => !s.officialUrl);
    if (!withoutUrl) return;

    const cardRe = new RegExp(`<article[^>]*id="${withoutUrl.id}"[^>]*>`);
    const cardMatch = cardRe.exec(html);
    expect(cardMatch, `card for ${withoutUrl.id} not found`).not.toBeNull();
    const cardIdx = cardMatch!.index;
    const nextCardIdx = html.indexOf('<article', cardIdx + cardMatch![0].length);
    const cardSlice = nextCardIdx > -1 ? html.slice(cardIdx, nextCardIdx) : html.slice(cardIdx);
    expect(cardSlice).not.toContain('card-official-link');
  });

  test('built HTML: official links have rel="nofollow noreferrer" and target="_blank"', () => {
    const htmlPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.html');
    if (!existsSync(htmlPath)) {
      test.skip(true, 'dist/index.html not found — run `npm run build` first');
      return;
    }
    const html = readFileSync(htmlPath, 'utf-8');
    const linkRe = /class="card-official-link"/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = linkRe.exec(html)) !== null) {
      const tagStart = html.lastIndexOf('<a', m.index);
      const tagEnd = html.indexOf('>', m.index) + 1;
      const tag = html.slice(tagStart, tagEnd);
      expect(tag).toContain('rel="nofollow noreferrer"');
      expect(tag).toContain('target="_blank"');
      count++;
    }
    expect(count).toBeGreaterThanOrEqual(20);
  });
});
