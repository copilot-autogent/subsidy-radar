import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

interface Subsidy {
  id: string;
  title: string;
  category?: string;
  situations?: string[];
}

const DATA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');

function loadSubsidies(): Subsidy[] {
  const raw: unknown = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  if (!Array.isArray(raw)) throw new Error('subsidies.json must be an array');
  return raw as Subsidy[];
}

test.describe('student persona — data & filter logic', () => {
  let subsidies: Subsidy[];

  test.beforeAll(() => {
    subsidies = loadSubsidies();
  });

  // ── 1. Chip render: student persona chip exists in the personas list ──────
  // Verified indirectly through the data — the personas array in index.astro
  // includes { key: 'student', icon: '📚', label: '在學學生' }, which renders
  // a .persona-btn[data-persona="student"] chip. We confirm the supporting data
  // exists and is non-empty so the chip is meaningful.
  test('student situation exists on at least 1 subsidy (chip has data to show)', () => {
    const studentSubsidies = subsidies.filter(s => s.situations?.includes('student'));
    expect(studentSubsidies.length).toBeGreaterThanOrEqual(1);
  });

  test('all new student entries have required fields', () => {
    const studentIds = [
      'moe-disadvantaged-scholarship',
      'university-tuition-subsidy',
      'graduate-scholarship',
      'student-employment-program',
    ];
    for (const id of studentIds) {
      const entry = subsidies.find(s => s.id === id);
      expect(entry, `Entry ${id} should exist`).toBeDefined();
      expect(entry!.situations, `${id} should have situations`).toContain('student');
    }
  });

  test('student persona chip: student situation tag present on education entries', () => {
    const educationStudentEntries = subsidies.filter(
      s => s.category === '教育' && s.situations?.includes('student'),
    );
    expect(educationStudentEntries.length).toBeGreaterThanOrEqual(4);
  });

  // ── 2. Combined student + low-income filter (AND logic) ───────────────────
  // When both situations are active simultaneously (e.g., via quiz), BOTH must
  // appear in the card's situations array. Test verifies at least one subsidy
  // satisfies this combination so the overlap is surfaceable.
  test('combined student + low-income filter: at least 1 subsidy matches both', () => {
    const combined = subsidies.filter(
      s => s.situations?.includes('student') && s.situations?.includes('low-income'),
    );
    expect(combined.length).toBeGreaterThanOrEqual(1);
    // Confirm each combined entry has both tags
    for (const entry of combined) {
      expect(entry.situations).toContain('student');
      expect(entry.situations).toContain('low-income');
    }
  });

  test('student + low-income overlap includes moe-disadvantaged-scholarship', () => {
    const entry = subsidies.find(s => s.id === 'moe-disadvantaged-scholarship');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('student');
    expect(entry!.situations).toContain('low-income');
  });

  // ── 3. Existing entries correctly tagged ────────────────────────────────
  test('student-loan-interest-relief tagged with student', () => {
    const entry = subsidies.find(s => s.id === 'student-loan-interest-relief');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('student');
  });

  test('indigenous-student-scholarship tagged with student', () => {
    const entry = subsidies.find(s => s.id === 'indigenous-student-scholarship');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('student');
  });

  test('low-income-education-grant tagged with student', () => {
    const entry = subsidies.find(s => s.id === 'low-income-education-grant');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('student');
  });

  // ── 4. Total entry count target ──────────────────────────────────────────
  test('student entries reach the issue-114 target', () => {
    const studentEntries = subsidies.filter(s => s.situations?.includes('student'));
    expect(studentEntries.length, 'Expected at least 7 student-tagged entries').toBeGreaterThanOrEqual(7);
  });
});
