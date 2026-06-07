import { describe, it, expect } from 'vitest';
import { parseImportJson } from '../../app/src/import/parse-import.js';

describe('parseImportJson', () => {
  it('parses a valid question array', () => {
    const payload = [
      {
        number: 1,
        question: 'Sample question?',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 2,
        category: 'Procedure',
      },
    ];
    const drafts = parseImportJson(payload);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].included).toBe(true);
    expect(drafts[0].issues).toHaveLength(0);
    expect(drafts[0].correctIndex).toBe(2);
  });

  it('flags sparse options as issues', () => {
    const drafts = parseImportJson([
      { question: 'Broken?', options: ['Only one'], correctIndex: 0 },
    ]);
    expect(drafts[0].issues.length).toBeGreaterThan(0);
    expect(drafts[0].issues.some((i) => i.includes('empty') || i.includes('2 answer'))).toBe(true);
  });
});
