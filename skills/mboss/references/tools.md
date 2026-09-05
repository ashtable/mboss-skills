# Tool reference

The mboss MCP server's eleven tools, in the order you meet them: read and
change the workflow graph first, then build and run what the graph compiled
to. Each description below is copied verbatim from the server's own
`tools.manifest.json` — if the two ever disagree, the manifest is right and
this file is stale.

See references/conventions.md for why the compiler refuses some documents
that validate — guards and scope, and the zone a schedule runs in.

### `workflow_get`

Reads a workflow document, its revision and its diagnostics.

### `workflow_create`

Creates an empty workflow draft.

### `workflow_apply_spec`

Previews a complete workflow document as a proposal, or applies one.

### `workflow_validate`

Checks a workflow, or a spec not yet on disk, without changing anything.

### `workflow_scaffold_step`

Writes typed handler and test stubs for a node with no code behind it.

### `workflow_rename_node`

Renames a node and every reference to it.

### `workflow_delete_node`

Deletes a node and its edges, bridging the gap where that is unambiguous.

### `project_build`

Regenerates every workflow's code and type-checks the project.

### `project_test`

Runs the project's tests and reports what passed and what failed.

### `project_debug`

Reads recent workflow runs and their steps from the project's database.

### `project_deploy`

Runs the project's deploy script.
