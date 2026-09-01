import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseSkill } from './skill.js';

const SKILL_PATH = fileURLToPath(
  new URL('../skills/mboss/SKILL.md', import.meta.url),
);
const REFERENCES_DIR = fileURLToPath(
  new URL('../skills/mboss/references/', import.meta.url),
);
const TOOLS_REFERENCE_PATH = join(REFERENCES_DIR, 'tools.md');
const IR_EXAMPLES_PATH = join(REFERENCES_DIR, 'ir-examples.md');

// The eleven tools the mboss MCP server registers, in
// the order its own registry lists them (workflow
// tools first, then project tools). This is the one
// place that order is pinned for this repo's own
// tests — task 47 validates shape against this fixed
// list; task 49 later checks it against the server's
// real, generated tools.manifest.json.
const EXPECTED_TOOLS = [
  'workflow_get',
  'workflow_create',
  'workflow_apply_spec',
  'workflow_validate',
  'workflow_scaffold_step',
  'workflow_rename_node',
  'workflow_delete_node',
  'project_build',
  'project_test',
  'project_debug',
  'project_deploy',
];

const PORTABLE_FRONTMATTER_FIELDS = [
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
];

describe('the shipped skill', () => {
  const skillText = readFileSync(SKILL_PATH, 'utf8');
  const { frontmatter, body } = parseSkill(skillText);

  it('declares exactly the six portable frontmatter fields', () => {
    expect(Object.keys(frontmatter).sort()).toEqual(
      [...PORTABLE_FRONTMATTER_FIELDS].sort(),
    );
  });

  it('names itself mboss under the MIT license', () => {
    expect(frontmatter.name).toBe('mboss');
    expect(frontmatter.license).toBe('MIT');
  });

  it('lists the eleven tools in metadata.mboss-tools', () => {
    const metadata = frontmatter.metadata as Record<string, unknown>;

    expect(metadata['mboss-tools']).toBe(EXPECTED_TOOLS.join(','));
  });

  it('lists the same eleven in allowed-tools, mcp-prefixed', () => {
    const allowedTools = (frontmatter['allowed-tools'] as string)
      .split(',')
      .map((entry) => entry.trim());

    expect(allowedTools).toEqual(
      EXPECTED_TOOLS.map((name) => `mcp__mboss__${name}`),
    );
  });

  it('teaches the four rules in its body', () => {
    expect(body).toContain('## The four rules');
    expect(body).toContain('Semantic graphs, never pixel coordinates.');
    expect(body).toContain('MCP tools, never raw graph files.');
    expect(body).toContain('Validate (dry-run) before applying.');
    expect(body).toContain('Follow project conventions for code-behind.');
  });

  it('points to the reference files', () => {
    expect(body).toContain('references/tools.md');
    expect(body).toContain('references/ir-examples.md');
  });
});

/**
 * Every reference has to be reachable by following
 * links from SKILL.md, or an agent never opens it.
 *
 * SKILL.md is byte-locked to the design document
 * that specifies it, so a new reference cannot be
 * linked from there — it is linked from one of the
 * two SKILL.md already names, and this is what
 * says that hop exists. A file nobody links is a
 * file nobody reads, and worse than no file at all
 * when it is there to correct something.
 */
describe('the references', () => {
  const files = readdirSync(REFERENCES_DIR).sort();

  function linksIn(path: string): string[] {
    const text = readFileSync(path, 'utf8');

    return [...text.matchAll(/references\/([a-z-]+\.md)/g)].map(
      (match) => match[1] as string,
    );
  }

  it('are every one of them reachable from SKILL.md', () => {
    const reached = new Set<string>();
    const pending = linksIn(SKILL_PATH);

    while (pending.length > 0) {
      const name = pending.pop() as string;
      if (reached.has(name) || !files.includes(name)) continue;

      reached.add(name);
      pending.push(...linksIn(join(REFERENCES_DIR, name)));
    }

    expect([...reached].sort()).toEqual(files);
  });
});

describe('references/tools.md', () => {
  const text = readFileSync(TOOLS_REFERENCE_PATH, 'utf8');

  // Each tool gets a `### `name`` heading followed by
  // exactly one description line — a shape task 49
  // parses to diff against tools.manifest.json.
  const headings = [...text.matchAll(/^### `([a-z_]+)`$/gm)].map(
    (match) => match[1],
  );

  it('documents exactly the eleven tools, once each', () => {
    expect(headings).toEqual(EXPECTED_TOOLS);
  });

  it('gives every tool a one-line, non-empty description', () => {
    const sections = text.split(/^### `[a-z_]+`$/m).slice(1);

    for (const section of sections) {
      const description = section.trim().split('\n')[0]?.trim();

      expect(description).toBeTruthy();
      expect(description).not.toContain('\n');
    }
  });
});

describe('references/ir-examples.md', () => {
  const text = readFileSync(IR_EXAMPLES_PATH, 'utf8');

  it('embeds a groom_booking example that parses as a document', () => {
    const match = text.match(/```json\n([\s\S]*?)\n```/);

    expect(match).not.toBeNull();

    const ir = JSON.parse(match![1]!) as {
      name: string;
      nodes: unknown[];
      edges: unknown[];
    };

    expect(ir.name).toBe('groom_booking');
    expect(ir.nodes).toHaveLength(10);
    expect(ir.edges).toHaveLength(11);
  });
});
