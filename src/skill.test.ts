import { describe, expect, it } from 'vitest';

import { parseSkill } from './skill.js';

describe('parseSkill', () => {
  it('splits frontmatter from body', () => {
    const { frontmatter, body } = parseSkill(
      ['---', 'name: demo', '---', '', '# Demo', ''].join('\n'),
    );

    expect(frontmatter).toEqual({ name: 'demo' });
    expect(body).toBe('\n# Demo\n');
  });

  it('rejects a file with no frontmatter fence', () => {
    expect(() => parseSkill('# Demo\n')).toThrow(/frontmatter fence/);
  });

  it('rejects a file whose frontmatter fence never closes', () => {
    expect(() => parseSkill('---\nname: demo\n# Demo\n')).toThrow(
      /frontmatter fence/,
    );
  });

  it('reads a folded multi-line description', () => {
    // A `>` block scalar folds its lines into one,
    // joined by single spaces — this is the shape
    // every real SKILL.md description uses.
    const { frontmatter } = parseSkill(
      [
        '---',
        'description: >',
        '  Line one continues',
        '  onto line two.',
        '---',
        'body',
      ].join('\n'),
    );

    expect(frontmatter.description).toBe('Line one continues onto line two.\n');
  });

  it('reads a comma-separated allowed-tools list across lines', () => {
    // A plain scalar spanning several indented
    // lines — folded the same way, but easy for a
    // hand-rolled line splitter to get wrong.
    const { frontmatter } = parseSkill(
      [
        '---',
        'allowed-tools: tool_one, tool_two,',
        '  tool_three',
        '---',
        'body',
      ].join('\n'),
    );

    expect(frontmatter['allowed-tools']).toBe('tool_one, tool_two, tool_three');
  });
});
