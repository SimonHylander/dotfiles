# Paved paths

The registry lists one paved path per recurring problem. Each repo keeps its registry at `docs/gardening/paved-paths.md`. This file gives the entry format, how to pick a winner, and the problems to check in a repo that has no registry yet.

## Entry format

```md
## HTTP calls

- **Path:** `apiClient` from `src/lib/api.ts`. Typed request and response. Failures arrive as `ApiError`.
- **Exemplar:** `src/features/billing/api.ts`
- **Enforced by:** `no-restricted-globals` on `fetch` outside `src/lib/api.ts` (weed W9)
- **Why:** auth headers, retries, and error mapping live in one place.
```

- **Path** names the real symbol and file. An agent must be able to import it from this line alone.
- **Exemplar** is one whole file. It shows the path in real use, not a demo.
- **Enforced by** names the rule and its weed id, or `unenforced`.
- **Why** records the reason behind the choice, which no config file holds. It is how the next person tells whether the path still fits.

## Pick the winner

When a problem has two or more live approaches, rank them in this order:

1. **Type safety.** Prefer the approach whose types flow from one source, such as a schema or a client, and that needs no `any` or `as`.
2. **Fewest concepts.** Prefer the approach that a new reader learns from one file.
3. **Usage.** Prefer the approach with the most correct uses, because it costs the least to migrate.

The human picks. Give them the ranking, the usage count of each approach, and the candidate exemplar.

## Create the registry

Run this when the repo has no `docs/gardening/`:

1. For each problem in the seed list below, search the repo for every approach to it. Count the uses of each approach.
2. If one approach clearly wins, write its entry with its best file as the exemplar.
3. If two or more approaches compete, record the problem as a fork with the counts. Leave **Path** empty until the human picks.
4. Add a line to the repo's `AGENTS.md`: `Follow the paved paths in docs/gardening/paved-paths.md. Each entry links an exemplar to copy.`

Done when every seed problem that the repo has is an entry or a fork, and problems the repo does not have are left out.

## Seed problems

The list is partial. Add problems the repo solves more than twice.

- HTTP calls and API clients
- Validation at I/O boundaries (requests, env, storage, third-party responses)
- Error handling and error types
- Configuration and environment variables
- Client state and server state
- Data fetching and caching in the UI
- Forms
- Logging
- Dates and time zones
- IDs
- Styling
- Tests: fixtures, mocks, and test data builders
