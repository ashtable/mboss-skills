# Conventions

Why the compiler refuses some documents that validate, and the places
its answer differs from what you would guess. Read this when a
`workflow_apply_spec` diagnostic or a `project_build` failure does not
match what you expected, and before you draw a branch that runs code of
yours.

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

## Two arms that end at the same blocks

**Two arms may share the blocks below them only when no block on
either arm binds a value between the fork and the first block they
both reach, and no arm rejoins later than that block.**

A shared block gets one name for the value it reads. An arm that
produces something of its own before the two meet would leave that
block reading one value down one route and a different one down the
other, and there is no name that means both. An arm that comes back
further down comes back to blocks the other arm has already been
through, and running them a second time would do the work twice under
a step name that is already taken.

The second is always refused. The first is refused whenever the shared
block says what it takes in — and where it says nothing, it compiles,
and the block quietly reads the value from before the fork rather than
the one the arm produced. Declaring both ends of every block is what
turns that into a message instead of a surprise.

The way out of either is the same: give each arm its own copy of the
blocks after the fork, wired to the same handlers. The copies record
different step names, so a run can still be read back to the arm it
took. `refund_approval` in references/ir-examples.md is the share that
is allowed: both arms arrive at the refund carrying the purchase they
were handed at the fork, and neither binds anything of its own.

## Transactions and the calls that dial out

A `transaction` runs its handler inside the run's own database
transaction, so what it writes commits with the checkpoint or not at
all. A call to another system in there gets none of that: it is not
checkpointed, and the rollback does not undo it. So validation reports
one as `V16`, an error — it names the call and the line it is written
on, fails `project_build`, and refuses the apply with
`VALIDATION_FAILED`. Move the work to a `step`.

**What is detected.** The global `fetch`, and the calls Node's own
networking modules use to open a connection: `get` and `request` from
`http` and `https`, `connect` from `http2` and from `tls`, `connect`
and `createConnection` from `net`, `createSocket` from `dgram`, and
the query functions of `dns` and `dns/promises` (`lookup`, the
`resolve*` family, `reverse`). Both spellings of an import are the
same module here — `node:https` and `https` are one entry, not two.

The rest of what those modules export is not networking and is not
detected: `net.isIP` tests a string, `dns.getServers` reads this
machine's own configuration, and a `createServer` waits to be called
rather than calling.

**By what a call resolves to, not by what it is called.** The check
asks the type checker which declaration a call reaches. So a name your
own module re-exports from `node:https` is found under the specifier
`./net.js`, and a `fetch` of your own — a local `const`, or a helper
of that name you imported — resolves to itself and is not reported.
Nothing is decided from the text of an import specifier or of an
identifier.

**`appDb.client` writes are fine**, and not by an exception written
for them: they resolve into your generated Prisma client, which is not
one of Node's modules. Nothing else an ordinary handler does is caught
either — `randomUUID`, a read through `node:fs/promises`, or
`new https.Agent({})`, because building a thing that can talk to a
machine is not talking to it.

**A call it cannot place says nothing.** A helper of your own that
itself dials out, an SDK's client like `stripe.charges.create`, a call
through an `any` — none of them is reported, because a wrong refusal
greys a legitimate handler out with nothing a person can say back,
while a miss only leaves the behaviour there was before. What is
caught is the direct call in the handler's own body, never every call
underneath it. The convention is the same either way: work that talks
to another system belongs in a `step`.

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

## Decision branches

A `branch` either tests a value the run is already carrying or calls
code of yours. Give it a `handler` and it is the second kind: the
function runs as a step of its own, and what it returned is what the
branch tests — directly, with no field to read off it.

So its cases are written differently from a predicate branch's. Write
one per answer the code can give, each matching the whole value:

```json
{ "port": "again", "when": { "path": "", "op": "eq", "value": true } }
```

The empty `path` names the returned value itself.

`elsePort` stays unwired. Cases that cover every answer leave nothing
to fall through to, and that arm compiles to a `return` — the right
thing to do about a value the type said could not happen.

A loop closes on one of the case ports, the same way it closes on a
predicate branch's: the `back` edge leaves the case that means "go
round again" and carries the run to the block the loop starts at. See
`slot_retry_abort` in references/ir-examples.md for the whole shape.

What the handler itself may return is a rule about your code, not about
the document, so it lives with your code: the project's own
`.mboss/conventions.md` — the file `mboss://conventions` serves, and the
one rule 4 sends you to before you write anything in `lib/` — has a
section on it. Read that one rather than assuming; it is written once
per project and is the project's from then on.

## Queues

A `queue` block runs its handler once per item of a collection, and each
item is a workflow execution of its own: started under the queue's
limits, recorded on its own row, and recovered on its own if the process
it was running in went away. A queue block's handler takes one item of
the collection and returns one result; the block's item type is its
parameter type. The block reads the collection off its input at
`itemsPath` and collects the results in the order the items were listed,
so a block after a queue either declares no `in` or declares the array —
one item's type is not what it is handed. `document_ingestion_queued` in
references/ir-examples.md is the whole shape.

**Any per-partition limit partitions the queue.** There is no separate
field that turns partitioning on: setting `partitionConcurrency`,
`partitionWorkerConcurrency` or `partitionRateLimit` is what turns it
on, and the three things `V17` refuses all follow from that.

A partitioned queue needs `enqueue.partitionPath`, because a row
enqueued with no partition key is never dispatched — it sits `ENQUEUED`
with no error and nothing says why — so the document is refused before a
run can wait for ever. Naming a partition path on a queue that has no
per-partition limit is the same mistake read from the other end: the key
would be ignored, so that is refused too. And a partitioned queue cannot
also deduplicate: DBOS refuses that combination mid-run with the item in
hand, which is a failed run rather than a thing to fix, so validation
refuses the document first.

**Under deduplication a colliding item comes back with the first one's
result.** `enqueue.deduplicationPath` reads a key off each item, and an
item whose key a run already in flight holds joins the run already in
flight rather than starting a second — the block's list holds that run's
result in the colliding item's place. That is what deduplicating is for,
and it is a wrong answer rather than a missing one when the path names
something a whole batch shares. Deduplicate on something each item has
its own of.

**A project made before queues existed has two lines to add and a floor
to meet.** `src/app/` is the project's own — mBoss wrote it when the
project was created and nothing regenerates it — so the boot code has to
be edited by hand. In `src/app/main.ts`:

```ts
import { registerQueues } from './queues.js';

await DBOS.launch();
await registerQueues(queues);
```

`queues` comes from `../workflows/index.js`, beside `schedules` and
`workflows`. Registering has to follow `DBOS.launch()`, which owns the
connection it writes through, and precede the schedules, because a
scheduled run may enqueue the moment its schedule is applied. It happens
on every boot rather than once, because a queue's configuration lives in
the system database and the row belongs to the deployment that wrote it.
The module the import names, `src/app/queues.ts`, arrives with a project
created today; one older than queues has to take that file too. All of
it needs `@dbos-inc/dbos-sdk` at `^4.27.6` or later.
