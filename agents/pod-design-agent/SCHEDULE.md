# POD Design Agent: the schedule

This file is the only place cadences, fire times, windows, budgets, period keys, and browser lanes live. Every routine reads its own row here at the top of every run, as Step 0.1, and takes `days`, `window_start`, `window_end`, `key`, `budget`, and `browser` from it and from nowhere else.

If a routine cannot find its row here, or cannot parse it, it records `failed` with `no SCHEDULE.md row for <routine-id>` and stops. **A routine never guesses a window and never widens its own row.** A routine that concludes its cadence or budget is wrong writes a line into `improvements/CHANGELOG.md` under `## Suggestions` and leaves the row alone. Changing this file is the member's job, by hand, between runs.

`CONTRACT.md` section 1 carries the same two routines with their cadence in words. **Where the two disagree, this file wins**, because this is the file the member edits and the file the guard reads.

All times are 24 hour local machine time. No time in this file is UTC and none is relative to any other zone.

---

## 1. The rows

This table is authoritative. Edit it, and the routines follow on their next fire.

| routine | days | fire | window_start | window_end | key | budget | browser |
|---|---|---|---|---|---|---|---|
| `design-request` | `daily` | 09:00 | 08:45 | 21:00 | `YYYY-MM-DD` | 45 min | never |
| `design-intake` | `first-weekday` | 11:30 | 11:15 | 15:00 | `YYYY-MM` | 30 min | never |

Two rows, two routines, and every id carries the `design-` prefix so they namespace cleanly beside other Ecom Agents.

### 1.1 The column meanings

| Column | Meaning |
|---|---|
| `routine` | The routine id. It equals the folder name under `routines/` and the YAML `name` key in that folder's SKILL.md. All three are always the same string |
| `days` | Which days the routine is allowed to run. Vocabulary in section 3 |
| `fire` | The time to register in whatever schedules this machine. Not a guarantee, and not what the window guard checks |
| `window_start`, `window_end` | The only thing the window guard checks. Outside this range the routine records `skipped-out-of-window` and exits |
| `key` | The period key format used by the once per period guard. Local date for the daily sweep, calendar month for the intake, computed from the local date and never from a UTC timestamp |
| `budget` | Hard wall clock budget. At budget the routine writes what it has and records `partial` |
| `browser` | How much browser control the routine needs. Both routines here read `never`: this Agent's whole job is files, local commands, and a configured image runtime. It never takes a browser mutex |

### 1.2 Why both rows read `never`

The design loop is deliberately browser free. A niche skill is built by a local Python builder from a master data file, and committed by a local git command. Artwork is produced by the image runtime named in `config/targets.json`, or held as a prompt package when no runtime is configured. Nothing in this kit opens a page, and a machine with no browser control configured runs it to full function.

### 1.3 What a missed fire does

`design-request` is a queue sweeper. A missed day does not lose a request: the request file still sits in `requests/inbox/` and the next in-window run picks it up. What a missed day costs is turnaround, never the request itself. A manual launch through `scripts/run-routine.mjs` inside the window does the same sweep early.

`design-intake` keys on the calendar month. A missed day in the first seven days is picked up on the next in-window day inside that same span, and the once per period guard holds the second fire. A fire arriving after that span fails the day test and exits clean.

---

## 2. The day vocabulary

| Value | Means |
|---|---|
| `daily` | Every calendar day, Sunday included |
| `mon-fri` | Weekdays only |
| `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun` | That weekday. A Sunday run keys on the ISO week that just ended only when the row's key is `YYYY-Www`; this kit has no weekly rows |
| `first-weekday` | Any Monday to Friday date in the first seven days of the calendar month |
| `last-weekday` | Any Monday to Friday date in the last seven days of the calendar month |
| `off` | Never fires. The row stays so the guard can still be read |

Comma lists are accepted (`mon,wed,fri`). An unknown day name is a parse failure, not a skip.

---

## 3. Registering the schedule

`design-intake` registers the jobs and re-verifies them each month. On a machine where no scheduler route exists it writes the exact commands to `schedule-commands.txt`, expanded, and names that file in its report. One job per routine, never a chained job. `CAPABILITIES.md` section 8 owns what the invocation looks like on each harness, and `run/` carries one `<id>.cmd.example` per routine.

Both jobs invoke `scripts/run-routine.mjs`, never a bare model prompt. The supervisor owns the exclusive-run lock, the runtime journal, and the timeout; a job that skips it is an unguarded run with no receipt.
