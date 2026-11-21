import { describe, expect, it } from 'vitest';
import { buildSystemInstruction } from './gemini-llm.provider.js';

describe('buildSystemInstruction', () => {
  it("puts the store owner's instructions before the fixed guardrails", () => {
    const prompt = buildSystemInstruction({
      name: 'Loja X',
      instructions: 'Always mention our new mango flavor.',
    });

    expect(prompt).toContain('"Loja X"');
    expect(prompt.indexOf('mango flavor')).toBeLessThan(prompt.indexOf('Never make up'));
  });

  it('omits the owner block when the tenant has no instructions', () => {
    const prompt = buildSystemInstruction({ name: 'Loja X', instructions: null });

    expect(prompt).not.toContain('Instructions from the store owner');
    expect(prompt).toContain('Never make up');
  });
});
