# Conventions

Why the compiler refuses some documents that validate, and the two
places its answer differs from what you would guess. Read this when a
`workflow_apply_spec` diagnostic or a `project_build` failure does not
match what you expected.

## Guards and what stays in scope

A `guard` skips its node when the condition is false, so the node
produces nothing that run. Anything downstream that reads its output
must carry the **same** guard and sit next to it in the chain.

Two things follow that are easy to get wrong.

**An optional input type is not a way through.** The V10 rule looks at
whether a consumer declares an `in` at all, never at what that `in` is.
Declaring the input as something that tolerates `undefined` does not
satisfy it — only the same guard does.

**Dropping `in` silences V10 and does not fix the build.** A handler's
arguments come from what `lib/` exports, not from the node's `in`. So a
consumer with no declared input still gets called with a value, the
compiler finds the guarded value out of scope, and refuses the document
with an `UNSUPPORTED` failure that `project_build` reports under
`unsupported`. The only real fix is the same guard.

**Same guard, but not adjacent, is also refused.** The compiler puts
consecutive blocks sharing a condition into one emitted `if`, and that
is what makes the producer's value nameable where the consumer runs. A
loop or an unguarded block between the two ends the group, and the
compiler refuses with a message naming both blocks. Move them together,
or move the work that came between them.

## Schedules and time zones

A `trigger` in `schedule` mode has an optional `timezone`. Leave it
unset and the schedule runs on **UTC** — so "every day at 9" drawn by
an author in Chicago fires at 03:00 or 04:00 their time.

Set `config.timezone` to the IANA zone the schedule is meant for
(`America/Chicago`, `Europe/London`) whenever the hour matters to
somebody. `project_build` names every schedule that left it unset, in
its `warnings`.

The zone is fixed rather than read from the machine that runs the build
on purpose: regenerating a project has to produce the same code on a
laptop as in CI. Which zone a schedule belongs to is a fact about the
workflow, so it belongs in the document.
