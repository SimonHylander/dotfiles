#!/usr/bin/env bash
# watch-pr.sh — poll a GitHub PR for new review activity from anyone but the
# invoking user, and exit as soon as something changes.
#
# Usage: watch-pr.sh <pr-number> [interval-seconds] [max-runtime-seconds] [baseline-json]
#
# Exit 0 — activity detected; prints {"before":…,"after":…} on stdout.
# Exit 3 — max runtime reached with no change; prints the current baseline on
#          stdout so the relauncher can pass it back in as the 4th argument.
#
# The signature covers inline review comments, top-level comments, and
# submitted reviews (all excluding the invoking user), plus PR state and review
# decision — so merges, closes, and approvals surface as changes too.
set -euo pipefail

pr="${1:?usage: watch-pr.sh <pr-number> [interval] [max-runtime] [baseline-json]}"
interval="${2:-180}"
max_runtime="${3:-540}"
baseline="${4:-}"

me="$(gh api user --jq .login)"
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

# Count items from an endpoint authored by anyone but $me. $2 is an extra jq
# filter clause. Returns non-zero if the API call itself failed, so a transient
# network error is never mistaken for a count of zero.
count_others() {
  local out
  out=$(gh api "$1" --paginate --jq ".[] | select(.user.login != \"$me\"$2) | .id") || return 1
  printf '%s' "$out" | grep -c . || true
}

signature() {
  local inline top reviews state
  inline=$(count_others "repos/$repo/pulls/$pr/comments" "") || return 1
  top=$(count_others "repos/$repo/issues/$pr/comments" "") || return 1
  reviews=$(count_others "repos/$repo/pulls/$pr/reviews" " and .state != \"PENDING\"") || return 1
  state=$(gh pr view "$pr" -R "$repo" --json state,reviewDecision \
    --jq '"\(.state):\(.reviewDecision)"') || return 1
  printf '{"inline":%s,"top":%s,"reviews":%s,"state":"%s"}' \
    "$inline" "$top" "$reviews" "$state"
}

[ -n "$baseline" ] || baseline="$(signature)"
echo "watching PR #$pr in $repo (baseline: $baseline)" >&2

elapsed=0
while [ "$elapsed" -lt "$max_runtime" ]; do
  sleep "$interval"
  elapsed=$((elapsed + interval))
  current="$(signature)" || continue
  if [ "$current" != "$baseline" ]; then
    printf '{"before":%s,"after":%s}\n' "$baseline" "$current"
    exit 0
  fi
done

printf '%s\n' "$baseline"
exit 3
