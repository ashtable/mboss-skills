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
const CONVENTIONS_PATH = join(REFERENCES_DIR, 'conventions.md');

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
    expect(body).toContain('Semantic graphs; positions belong to people.');
    expect(body).toContain('MCP tools, never raw graph files.');
    expect(body).toContain('Validate (dry-run) before applying.');
    expect(body).toContain('Follow project conventions for code-behind.');
  });

  // A person's positions are the one thing in the
  // document an agent can destroy by being helpful,
  // so rule 1 has to say both halves: leave the ones
  // on disk alone, and do not make new ones up.
  it('says who a position belongs to', () => {
    expect(body).toContain('Never write one, never invent one');
    expect(body).toContain('a spec that omits positions keeps');
    expect(body).toContain('an Arrange in the editor recomputes them all');
  });

  // Nothing at build time catches a handler that
  // writes around the run's transaction, so the
  // skill is where an agent finds out.
  it('names the client a transaction handler writes through', () => {
    expect(body).toContain('must write through `appDb.client`');
    expect(body).toContain("commits outside the run's transaction");
  });

  // The guard rule looks at whether a consumer
  // declares an `in` at all, never at what that
  // `in` is, so no type is a way past a guard. This
  // body is loaded every time, and an agent that
  // reads otherwise here builds a document the
  // apply refuses — and finds that out from a
  // reference it opens only once something has
  // already failed.
  it('says the same guard is the only way past a guard', () => {
    // The claim runs over more than one line, and
    // where it wraps is not what this is about.
    const prose = body.replaceAll(/\s+/g, ' ');

    expect(prose).toContain('must carry the **same** guard');
    expect(prose).toContain(
      'an input type that tolerates `undefined` does not satisfy it',
    );
  });

  // A transaction whose handler dials out is
  // refused now, not merely discouraged, and the
  // refusal lands on the apply. An agent picking a
  // kind reads this body and nothing else, so the
  // rule has to be here or the first it hears of it
  // is a document that will not save.
  it('says a handler that dials out is refused a transaction', () => {
    // The claim runs over more than one line, and
    // where it wraps is not what this is about.
    const prose = body.replaceAll(/\s+/g, ' ');

    expect(prose).toContain(
      'Validation **refuses** a `transaction` whose handler dials out',
    );
    expect(prose).toContain(
      "written in the handler's own body is a `V16` error",
    );
    expect(prose).toContain('Work that calls a service is a `step`');
  });

  // What is refused is a closed list of the calls
  // that open a connection, not the modules those
  // calls live in. Told the module itself is
  // refused, an agent moves a `net.isIP` or a
  // `dns.getServers` out of the transaction to be
  // safe — splitting a commit that had no reason to
  // be split, and never hearing otherwise, because
  // a call that is not on the list draws no
  // diagnostic either way.
  it('refuses the calls that dial out, not whole modules', () => {
    // The claim runs over more than one line, and
    // where it wraps is not what this is about.
    const prose = body.replaceAll(/\s+/g, ' ');

    expect(prose).toContain(
      "one of the calls Node's networking modules use to open a connection",
    );
  });

  // The check reads one body and does not follow
  // what it calls. An agent told only that calls
  // out are caught would read a clean validation as
  // permission to keep a helper's HTTP call inside
  // a transaction — which is the fault this rule
  // exists to prevent, arriving with the rule's own
  // blessing.
  it('does not let its silence read as permission', () => {
    const prose = body.replaceAll(/\s+/g, ' ');

    expect(prose).toContain(
      'silence about a helper of your own is not permission',
    );
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
 * SKILL.md stays short on purpose and names two of
 * them, so a third is reached by a hop from one of
 * those two — and this is what says that hop is
 * there. A file nobody links is a file nobody
 * reads, and worse than no file at all when it is
 * there to correct something.
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

describe('references/conventions.md', () => {
  const text = readFileSync(CONVENTIONS_PATH, 'utf8');

  it('says how a decision branch writes its cases', () => {
    expect(text).toContain('## Decision branches');
    expect(text).toContain('"when": { "path": "", "op": "eq"');
    expect(text).toContain('`elsePort` stays unwired');
  });

  // The body says a transaction handler that dials
  // out is refused; an agent that has to act on
  // that needs to know which calls are meant, and
  // that its own database client is not one of
  // them.
  it('names the calls that refuse a transaction', () => {
    // The list runs over more than one line, and
    // where it wraps is not what this is about.
    const prose = text.replaceAll(/\s+/g, ' ');

    expect(text).toContain('## Transactions and the calls that dial out');
    expect(prose).toContain('`get` and `request` from `http` and `https`');
    expect(text).toContain('`createSocket` from `dgram`');
    expect(text).toContain('`appDb.client` writes are fine');
  });

  // Two ways to be wrong about the check, both of
  // which end in an agent arguing with a refusal or
  // trusting a silence: it reads what a call
  // resolves to rather than what it is spelled, and
  // it says nothing at all about a call it cannot
  // place.
  it('says how the check decides, and where it stops', () => {
    expect(text).toContain('not by what it is called');
    expect(text).toContain('A call it cannot place says nothing');
  });

  // What the handler may return belongs to the
  // project's own conventions file, which is what
  // rule 4 sends an agent to. Naming that file
  // instead of repeating it is what keeps the two
  // from drifting apart.
  it('sends the handler side to the project it belongs to', () => {
    expect(text).toContain('.mboss/conventions.md');
    expect(text).not.toContain('Promise<boolean>');
  });
});

describe('references/ir-examples.md', () => {
  const text = readFileSync(IR_EXAMPLES_PATH, 'utf8');
  const documents = [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(
    (match) => match[1]!,
  );

  it('embeds a groom_booking example that parses as a document', () => {
    const ir = JSON.parse(documents[0]!) as {
      name: string;
      nodes: unknown[];
      edges: unknown[];
    };

    expect(ir.name).toBe('groom_booking');
    expect(ir.nodes).toHaveLength(10);
    expect(ir.edges).toHaveLength(11);
  });

  it('embeds a loop a decision branch closes', () => {
    const ir = JSON.parse(documents[1]!) as {
      name: string;
      nodes: {
        id: string;
        kind: string;
        handler?: { export: string };
        config: { cases?: { port: string; when: unknown }[] };
      }[];
      edges: { from: { node: string; port: string }; back?: boolean }[];
    };

    expect(ir.name).toBe('slot_retry_abort');

    const decision = ir.nodes.find((node) => node.kind === 'branch')!;

    expect(decision.handler?.export).toBe('tryAgain');
    expect(decision.config.cases?.map((each) => each.when)).toEqual([
      { path: '', op: 'eq', value: true },
      { path: '', op: 'eq', value: false },
    ]);

    const back = ir.edges.find((edge) => edge.back)!;

    expect(back.from).toEqual({ node: decision.id, port: 'again' });
  });

  // These are copied out of mboss-core's fixtures by
  // hand — this repo cannot see them — so the one
  // thing it can check for itself is that nothing was
  // dropped or half-pasted on the way over.
  it('embeds nothing but documents that parse', () => {
    expect(documents.length).toBeGreaterThan(1);

    for (const document of documents) {
      expect(() => JSON.parse(document)).not.toThrow();
    }
  });
});
