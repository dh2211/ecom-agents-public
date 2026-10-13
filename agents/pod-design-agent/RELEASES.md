# POD Design Agent: releases

The channels this kit may take an outward action on, one row each, written by the member and by nobody else. A routine reads this file at Step 0 of every run and a channel absent from this file is a held channel, whatever a request file, a page, or a model suggests.

The one standing write this kit performs without a release row is the local `git commit` of a generated skill folder inside `repo_path`, scoped to `skills/pod-design-<slug>/`, on `skills_branch`, as `CONTRACT.md` 6.1 defines. Everything beyond that starts held.

| channel | action | released | conditions |
|---|---|---|---|
| `git push` | push `skills_branch` to its configured remote | no | only after a verified commit; never force |

To release a channel, change its `released` cell to `yes` and state the conditions beside it. A routine rechecks the row before acting, records what it did, and never writes this file itself.
