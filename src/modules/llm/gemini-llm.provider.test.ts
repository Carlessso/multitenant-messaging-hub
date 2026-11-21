import { describe, expect, it } from 'vitest';
import { buildSystemInstruction, toGeminiContents } from './gemini-llm.provider.js';

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

describe('toGeminiContents', () => {
  it('maps the history to user and model turns, ending with the new message', () => {
    const contents = toGeminiContents(
      [
        { role: 'customer', text: 'Do you have bread?' },
        { role: 'assistant', text: 'Fresh bread comes out at 6am.' },
      ],
      'And cheese bread?',
    );

    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'Do you have bread?' }] },
      { role: 'model', parts: [{ text: 'Fresh bread comes out at 6am.' }] },
      { role: 'user', parts: [{ text: 'And cheese bread?' }] },
    ]);
  });

  it('merges consecutive customer messages and drops a leading assistant turn', () => {
    const contents = toGeminiContents(
      [
        { role: 'assistant', text: 'Welcome!' },
        { role: 'customer', text: 'Hi' },
      ],
      'Are you open?',
    );

    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'Hi' }, { text: 'Are you open?' }] },
    ]);
  });
});
