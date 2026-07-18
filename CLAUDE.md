## Picking the right models for workflows and subagents

Rankings, higher = better. Cost reflects what I actually pay (OpenAI has really generous
limits), not list price. Intelligence is how hard a problem you can hand the model
unsupervised. Taste covers UI/UX, code quality, API design, and copy.

| model   | cost | intelligence | taste |
|---------|------|--------------|-------|
| gpt-5.6 | 9    | 8.5          | 5     |
| sonnet-5| 5    | 5            | 7     |
| opus-4.8| 4    | 7            | 8     |
| fable-5 | 2    | 9            | 9     |

How to apply:
- These are defaults, not limits. You have standing permission to override them: if a cheaper
  model's output doesn't meet the bar, rerun or redo the work with a smarter model without
  asking. Judge the output, not the price tag. Escalating costs less than shipping mediocre
  work.
- Cost is a tie-breaker only; when axes conflict for anything that ships, intelligence >
  taste > cost.
- Bulk/mechanical work (clear-spec implementation, data analysis, migrations): gpt-5.6 — it's
  effectively free.
- Anything user-facing (UI, copy, API design) needs taste ≥ 7.
- Reviews of plans/implementations: fable-5, gpt-5.6-sol or opus-4.8 as an extra
  independent perspective.
- Never use Haiku.
- Mechanics: gpt-5.6 is reachable through the the "claudex" alias.
- Claude models (sonnet-5, opus-4.8, fable-5) run via the Agent/Workflow model parameter.

