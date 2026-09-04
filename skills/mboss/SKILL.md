---
name: mboss
description: >
  Build and edit mBoss durable workflows (DBOS apps designed on a canvas). Use whenever a
  project contains a .mboss/ directory or the user asks to create, change, validate, build, or
  debug an mBoss workflow. Drives the mboss MCP server — never edit .mboss/workflows/*.json by
  hand.
license: MIT
compatibility: >
  Requires the mboss MCP server registered from this project (.mboss/mcp/server.js via
  .mcp.json or your agent's MCP config) and Node 24+.
metadata:
  mboss-skill-version: "1"
  mboss-tools: "workflow_get,workflow_create,workflow_apply_spec,workflow_validate,workflow_scaffold_step,workflow_rename_node,workflow_delete_node,project_build,project_test,project_debug,project_deploy"
allowed-tools: mcp__mboss__workflow_get, mcp__mboss__workflow_create,
  mcp__mboss__workflow_apply_spec, mcp__mboss__workflow_validate,
  mcp__mboss__workflow_scaffold_step, mcp__mboss__workflow_rename_node,
  mcp__mboss__workflow_delete_node, mcp__mboss__project_build, mcp__mboss__project_test,
  mcp__mboss__project_debug, mcp__mboss__project_deploy
---

# Working in mBoss projects

mBoss workflows are semantic graphs (the Workflow IR) that compile to durable DBOS code. The
canvas, this MCP server, and the compiler all share one semantic model — the Workflow Core.
You propose; mBoss validates; the human approves.

## The four rules

1. **Semantic graphs; positions belong to people.** A node may carry a `position` a person
   set on the canvas. Never write one, never invent one: a spec that omits positions keeps
   the ones on disk, and an Arrange in the editor recomputes them all. Describe nodes,
   edges, handlers, and config.
2. **MCP tools, never raw graph files.** Do not read or write `.mboss/workflows/*.workflow.json`
   directly — use `workflow_get` / `workflow_apply_spec`. Direct edits bypass validation and
   revision tracking and will be rejected or clobbered.
3. **Validate (dry-run) before applying.** Call `workflow_apply_spec` with `dryRun: true`
   first, always. Only apply (`dryRun: false`) after the human has approved the previewed
   change. In the mBoss sidebar the human approves on the canvas — after a dry run, stop and
   wait; the extension applies.
4. **Follow project conventions for code-behind.** Read `mboss://conventions` before writing
   or scaffolding anything in `lib/`. Handlers are ordinary typed TypeScript in `lib/`; the
   generated `src/workflows/**` is compiler-owned — never edit it.

## Workflow

1. Read `mboss://node-catalog` and `mboss://workflow-schema` before proposing anything.
2. `workflow_get` the current state (respect `revision` — pass it as `baseRevision`).
3. Build a complete spec (full desired document, not a patch) and dry-run it.
4. Present the returned summary and diagnostics to the human; refine until valid.
5. After approval and apply, `workflow_scaffold_step` each node whose handler is missing,
   implement the stubs in `lib/`, then `project_build` and `project_test`.
6. For run/crash questions, `project_debug` reads the DBOS ledger (status, recovery
   attempts, step timing) — the workflow state is rows in Postgres.

## What things mean

- `transaction` is reserved for writes to the app's own co-located Postgres (exactly-once).
  External side-effects (S3, Weaviate, Twilio Email, HTTP) are `step`/`apiCall` — durable and
  retried, idempotency via upsert/dedupe keys.
- A `transaction`'s handler must write through `appDb.client`, from `src/app/db.js` — the
  client scoped to that block's transaction, which is what joins its writes to the run's. A
  handler that builds a `PrismaClient` of its own commits outside the run's transaction, and
  nothing catches that at build time.
- `guard` skips a node when false, so the node produces nothing that run. Anything downstream
  that reads its output must carry the **same** guard and sit next to it in the chain: an
  input type that tolerates `undefined` does not satisfy it, and dropping the input silences
  the check and fails the build instead. See references/conventions.md.
- Signed links (forms, artifacts) are minted by the runtime — never construct URLs yourself.

See references/tools.md for the full tool reference and references/ir-examples.md for worked
IR specs.
