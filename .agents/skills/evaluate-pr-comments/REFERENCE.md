# Evaluate PR Comments — Reference

## GraphQL: unresolved review threads

```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$number:Int!) {
  repository(owner:$owner,name:$repo) {
    pullRequest(number:$number) {
      reviewThreads(first:100) {
        nodes {
          isResolved
          path
          line
          comments(last:20) {
            nodes {
              body
              author { login }
              createdAt
              path
              line
              originalLine
            }
          }
        }
      }
    }
  }
}' -f owner=<owner> -f repo=<repo> -F number=<number>
```

Filter to `isResolved: false`. Use the latest comment in each thread as the primary claim; read earlier comments only when context is needed.

## False-positive checklist

- Line/path no longer exists on the PR head
- Claim contradicted by tests, types, or runtime behavior
- Suggested pattern conflicts with established repo conventions
- Bot comment on generated output, lockfiles, or intentional config
- Refactor or style change with no feature, safety, or reviewability benefit in this PR
- Drive-by fix unrelated to PR intent (valid but → `defer`)

## Bot comments

Apply the same validity/correctness/scope bar to Bugbot, Greptile, CodeRabbit, and similar bots. Bots are wrong often enough that "bot said it" is never sufficient grounds for `accept`.
