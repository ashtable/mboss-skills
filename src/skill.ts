import { parse as parseYaml } from 'yaml';

/**
 * A SKILL.md file split into its two parts.
 *
 * The Agent Skill format is markdown with a YAML
 * frontmatter fence at the top; everything after
 * the closing fence is the body an agent reads once
 * the skill is loaded.
 */
export type ParsedSkill = {
  frontmatter: Record<string, unknown>;
  body: string;
};

const FENCE = '---';

/**
 * Splits a SKILL.md file into frontmatter and body.
 *
 * The frontmatter is parsed as real YAML rather
 * than picked apart with a regex — a folded
 * description or a multi-line `allowed-tools` list
 * only comes out right through an actual parser.
 */
export function parseSkill(markdown: string): ParsedSkill {
  const lines = markdown.split('\n');

  if (lines[0]?.trim() !== FENCE) {
    throw new Error('SKILL.md has no opening frontmatter fence');
  }

  const closeAt = lines.findIndex(
    (line, index) => index > 0 && line.trim() === FENCE,
  );
  if (closeAt === -1) {
    throw new Error('SKILL.md frontmatter fence is never closed');
  }

  const frontmatterText = lines.slice(1, closeAt).join('\n');
  const frontmatter = parseYaml(frontmatterText) as Record<string, unknown>;
  const body = lines.slice(closeAt + 1).join('\n');

  return { frontmatter, body };
}
