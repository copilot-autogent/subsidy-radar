import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

interface Subsidy {
  id: string;
  title: string;
  category: string;
  agency: string;
  summary: string;
  eligibility?: string[];
  amount: string;
  deadline: string;
  deadlineStatus: string;
  applicationUrl?: string;
  officialUrl?: string;
  situations?: string[];
  difficulty?: string;
  steps?: string[];
  requiredDocs?: string[];
  lastVerifiedDate?: string;
  deadlineDate?: string;
}

const distRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');

function getSubsidies(): Subsidy[] {
  const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');
  const raw: unknown = JSON.parse(readFileSync(dataPath, 'utf-8'));
  if (!Array.isArray(raw)) throw new Error('subsidies.json must be an array');
  return raw as Subsidy[];
}

test.describe('Subsidy detail pages — static build', () => {
  let subsidies: Subsidy[];

  test.beforeAll(() => {
    subsidies = getSubsidies();
  });

  test('each subsidy has a generated HTML file in dist/', () => {
    if (!existsSync(distRoot)) {
      test.skip(true, 'dist/ not found — run `npm run build` first');
      return;
    }
    for (const s of subsidies) {
      const htmlPath = resolve(distRoot, 'subsidy', s.id, 'index.html');
      expect(existsSync(htmlPath), `Missing detail page for ${s.id}`).toBe(true);
    }
  });

  test('detail pages contain the subsidy title', () => {
    if (!existsSync(distRoot)) {
      test.skip(true, 'dist/ not found');
      return;
    }
    for (const s of subsidies) {
      const htmlPath = resolve(distRoot, 'subsidy', s.id, 'index.html');
      if (!existsSync(htmlPath)) continue;
      const html = readFileSync(htmlPath, 'utf-8');
      expect(html).toContain(s.title);
    }
  });

  test('detail pages contain agency name', () => {
    if (!existsSync(distRoot)) {
      test.skip(true, 'dist/ not found');
      return;
    }
    for (const s of subsidies) {
      const htmlPath = resolve(distRoot, 'subsidy', s.id, 'index.html');
      if (!existsSync(htmlPath)) continue;
      const html = readFileSync(htmlPath, 'utf-8');
      expect(html).toContain(s.agency);
    }
  });

  test('detail pages have canonical URL meta tag', () => {
    if (!existsSync(distRoot)) {
      test.skip(true, 'dist/ not found');
      return;
    }
    // Check a sample of pages, not just the first
    const sample = subsidies.slice(0, Math.min(5, subsidies.length));
    for (const s of sample) {
      const htmlPath = resolve(distRoot, 'subsidy', s.id, 'index.html');
      if (!existsSync(htmlPath)) continue;
      const html = readFileSync(htmlPath, 'utf-8');
      expect(html).toContain(`rel="canonical"`);
      expect(html).toContain(`/subsidy/${s.id}/`);
    }
  });

  test('detail pages have JSON-LD GovernmentService structured data', () => {
    if (!existsSync(distRoot)) {
      test.skip(true, 'dist/ not found');
      return;
    }
    const sample = subsidies.slice(0, Math.min(5, subsidies.length));
    for (const s of sample) {
      const htmlPath = resolve(distRoot, 'subsidy', s.id, 'index.html');
      if (!existsSync(htmlPath)) continue;
      const html = readFileSync(htmlPath, 'utf-8');
      expect(html).toContain('application/ld+json');
      expect(html).toContain('GovernmentService');
    }
  });

  test('detail pages have a back link to the index', () => {
    if (!existsSync(distRoot)) {
      test.skip(true, 'dist/ not found');
      return;
    }
    const sample = subsidies.slice(0, Math.min(5, subsidies.length));
    for (const s of sample) {
      const htmlPath = resolve(distRoot, 'subsidy', s.id, 'index.html');
      if (!existsSync(htmlPath)) continue;
      const html = readFileSync(htmlPath, 'utf-8');
      expect(html).toContain('返回補助列表');
    }
  });

  test('detail pages render application steps when present', () => {
    if (!existsSync(distRoot)) {
      test.skip(true, 'dist/ not found');
      return;
    }
    const withSteps = subsidies.filter(s => s.steps && s.steps.length > 0);
    if (withSteps.length === 0) return;
    const s = withSteps[0];
    const htmlPath = resolve(distRoot, 'subsidy', s.id, 'index.html');
    if (!existsSync(htmlPath)) return;
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('申請步驟');
    expect(html).toContain(s.steps![0]);
  });

  test('detail pages render required docs when present', () => {
    if (!existsSync(distRoot)) {
      test.skip(true, 'dist/ not found');
      return;
    }
    const withDocs = subsidies.filter(s => s.requiredDocs && s.requiredDocs.length > 0);
    if (withDocs.length === 0) return;
    const s = withDocs[0];
    const htmlPath = resolve(distRoot, 'subsidy', s.id, 'index.html');
    if (!existsSync(htmlPath)) return;
    const html = readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('所需文件');
    expect(html).toContain(s.requiredDocs![0]);
  });

  test('index page has detail page links for each subsidy', () => {
    const htmlPath = resolve(distRoot, 'index.html');
    if (!existsSync(htmlPath)) {
      test.skip(true, 'dist/index.html not found');
      return;
    }
    const html = readFileSync(htmlPath, 'utf-8');
    // Each subsidy card should have a .card-detail-link pointing to its detail page
    for (const s of subsidies) {
      // Check for the specific card-detail-link anchor (not just any URL containing the id)
      expect(html).toContain(`card-detail-link" aria-label="查看 ${s.title} 詳細資訊"`);
    }
  });

  test('LINE share URLs on index use canonical detail page URLs', () => {
    const htmlPath = resolve(distRoot, 'index.html');
    if (!existsSync(htmlPath)) {
      test.skip(true, 'dist/index.html not found');
      return;
    }
    const html = readFileSync(htmlPath, 'utf-8');
    // LINE share links should use canonical detail page URLs, not hash anchors
    expect(html).not.toMatch(/line\.me\/lineit\/share\?url=[^"]*%23/);
  });
});

test.describe('Subsidy detail pages — browser render', () => {
  test('detail page renders title heading', async ({ page }) => {
    const subsidies = getSubsidies();
    if (subsidies.length === 0) return;
    const s = subsidies[0];
    // playwright.config baseURL is http://localhost:4321; site is served at /subsidy-radar/
    await page.goto(`/subsidy-radar/subsidy/${s.id}/`);
    const h1 = page.locator('h1.detail-title');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(s.title);
  });

  test('detail page has working back link to index', async ({ page }) => {
    const subsidies = getSubsidies();
    if (subsidies.length === 0) return;
    const s = subsidies[0];
    await page.goto(`/subsidy-radar/subsidy/${s.id}/`);
    const backLink = page.locator('a.back-link').first();
    await expect(backLink).toBeVisible();
    await expect(backLink).toContainText('返回補助列表');
  });

  test('detail page shows eligibility section when data present', async ({ page }) => {
    const subsidies = getSubsidies();
    const withEligibility = subsidies.find(s => s.eligibility && s.eligibility.length > 0);
    if (!withEligibility) return;
    await page.goto(`/subsidy-radar/subsidy/${withEligibility.id}/`);
    await expect(page.locator('text=申請資格')).toBeVisible();
  });

  test('detail page CTA buttons are visible when URLs present', async ({ page }) => {
    const subsidies = getSubsidies();
    const withUrl = subsidies.find(s => s.officialUrl || s.applicationUrl);
    if (!withUrl) return;
    await page.goto(`/subsidy-radar/subsidy/${withUrl.id}/`);
    if (withUrl.officialUrl) {
      await expect(page.locator('a.cta-primary')).toBeVisible();
    }
    if (withUrl.applicationUrl) {
      await expect(page.locator('a.cta-secondary')).toBeVisible();
    }
  });
});
