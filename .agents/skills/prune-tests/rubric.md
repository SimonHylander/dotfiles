# Low-signal test rubric

A test has _signal_ when a plausible regression in this repo turns it red and nothing else catches that regression: not the type checker, not another test in the file. Each delete category is a known shape of a test with no signal. Each keep category is an area where a wrong deletion ships a bug to users.

Keep wins. A test that matches a keep category stays, whatever delete category it also matches. When no delete category clearly fits, the test stays.

## Delete

- `type-redundant`: asserts what the compiler already enforces. A typed function exists or returns its declared shape, an object has its required fields, a call with arguments the types reject throws. Runtime validation of untyped input is `parsing`.
- `trivial-logic`: the code under test has no branch or computation to break. Getters, constants, pass-through wrappers, one-line mappers, restated defaults.
- `dom-basics`: asserts what the browser or the UI framework does. Static markup renders, a click calls the `onClick` prop, an input shows what was typed, a class name is present. Rendering that depends on app state is app logic.
- `timers`: waits on real time (`sleep`, `setTimeout`, polling, long `waitFor` timeouts) or advances fake timers to check timing.
- `mock-mirror`: the assertions restate the calls the implementation makes to its mocks, with the same arguments the code passes, and check no value the code computes. A refactor breaks it and a bug passes it.
- `smoke`: asserts only that something exists, imports, constructs, or does not throw on the happy path. "Renders without crashing", "is defined".
- `duplicate-case`: a separate test or `.each` row that drives the same branch as an earlier case in the file, with different values. Vote the later cases. The first case of each branch stays.
- `wall-clock-perf`: asserts elapsed time against a threshold (`Date.now`, `performance.now`). Shared CI runners make it flaky.

## Keep

- `orchestration`: sequencing of workflows, jobs, and state machines. Event sourcing: applying, replaying, projecting, and ordering events, and idempotency.
- `protocol`: translation between internal models and a provider's wire format: requests, responses, and error mapping.
- `auth`: authentication, authorization, permission, and tenant guards, including the denied cases.
- `persistence`: queries, repositories, transactions, schemas, and migrations.
- `parsing`: parsing, validating, or serializing external formats: payloads, files, user input at a boundary.
- `race-fix`: a deterministic test that pins a fixed concurrency bug by forcing the order with deferred promises, fake timers, or controlled scheduling.
