# Agent Skills

Skills for driving code-review workflows with an agent: requesting reviews, watching for feedback, and triaging it.

## Language

**Review round**:
One cycle of a PR review — feedback arrives, gets evaluated, fixes get pushed. Bounded by the watcher re-snapshotting its baseline.
_Avoid_: review cycle, iteration

**Baseline**:
The snapshot of a PR's comments, reviews, and state that a watcher measures "new activity" against.
_Avoid_: snapshot, checkpoint

**Watcher**:
A background poller on one PR that exits the moment activity diverges from its baseline.
_Avoid_: monitor, poller

**Verdict**:
The per-comment judgment `evaluate-pr-comments` assigns: accept, acknowledge, defer, dispute, unclear, or resolved.
