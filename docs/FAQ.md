# FAQ

App users start with [README](../README.md) and the [user guide](COMMERCE-GUIDE.vi.html).
Scheduler and harness answers below concern installed kits. Vendor-specific examples
are not a current compatibility certification; see the qualification in [HARNESSES.md](HARNESSES.md).

**Does it send anything?** Commerce and the POD/Dropship profiles are draft-only, even if a legacy kit has a configured channel. In a base scheduled kit, an outbound action requires the member's applicable `RELEASES.md` row and the harness's permission. Connecting a blog, waiting through a veto window, or widening tool permissions does not replace that release. No routine writes its own release. App approval moves the workflow forward; it does not authorize external business actions.

**What does it cost to run?** The repo does not include an AI subscription or media service. Cost and quota depend on the provider, model, input size and tools you choose. [COST.md](COST.md) preserves historical GTM measurements, not a current quote or a POD/Dropship capacity promise. Measure a representative private pilot before pricing a service.

**How long does the install take?** You spend about ten minutes answering questions. The agent's first run takes about an hour and may ask for a second session.

**Windows, macOS or Linux?** All three. Windows through the Desktop app scheduler or Task Scheduler, macOS through the Desktop app or launchd, Linux through cron. `docs/INSTALL.md` has the steps for each scheduler and what a first run should look like.

**Which harness?** Built for Claude Code, OpenClaw, Hermes, OpenCode, Grok Bot, Codex, Antigravity, Pi, Cline, Qwen Code and DeepSeek. Claude Code is the one the GTM Engineer runs my own launch on every weekday. OpenClaw, Hermes, Cline and Qwen Code have built in cron or scheduled tasks, Codex has scheduled runs, Antigravity has the `agy` job runner, DeepSeek schedules through a plugin, OpenCode and Pi use the operating system's scheduler, and Grok Bot runs from its own cloud computer. `docs/HARNESSES.md` has the invocation and the first run check for each.

**Can I run just one?** Yes. Each agent is a self contained folder. They share nothing but a scheduler. The GTM Engineer is the one to start with; the Chief of Staff is the one to add second, because it reads the run logs of every other agent on the machine and tells you which one quietly stopped.

**What happens when my machine is asleep?** It depends on your scheduler: the Claude Desktop app and Windows Task Scheduler run one late catch up, launchd folds every missed fire into one, and cron skips it for good. Every routine has a window, so a late fire either does its work once or records a skip and exits. A closed laptop produces nothing, and the next run's report says so in plain words.

**Can I run it on a VPS or in the cloud?** The file routines, yes: anything that reads and writes files and runs a command. The browser routines need a browser that carries your own signed in sessions, which a headless server does not have, and an API key turns the browser lane off on Claude Code. Each browser kit's README has a section called "What you lose with no browser control" that says exactly what still works; pod-design-agent has no browser lane at all.

**Do I need the Chrome extension?** On Claude Code, only for the routines that read your own accounts (saved searches, ad dashboards, your support inbox, your analytics). The morning brief, the drafting, and the Friday scoreboard arithmetic never need a browser.

**Does it need an API key?** No. On Claude Code, log in once with `claude` and `/login` on a plan that includes it; an API key works for the file routines but the browser lane switches off with it. On another harness, whatever account or key it already runs on is enough; the kits add no credential of their own.

**Why does everything say "member"?** The kits call the person who owns the agent "the member". Read it as you; it is the owner of the install, nothing more.

**What are the «guillemets» in the files?** A placeholder the install fills in, such as `«GTM_ROOT»` for your folder path. Two survive on purpose in drafts: `«paste at send time»` where a credential goes that only you type, and `«member: paste the detail»` where a number goes that only you can supply. Nothing ships with a real value in one.

**Can I schedule Sunday work?** The runtime supports Sunday. Sunday ends its current ISO week; the following Monday starts another. A weekly routine on two days in the same ISO week shares its once-per-period key. Review `SCHEDULE.md` and the intended cadence before changing it.

**Can I change the schedule?** Edit `SCHEDULE.md`. It is the only file in a kit that carries a cadence, a fire time, a window, or a budget, and the routines read it on every fire. Then re-register that one job, or let the monthly drift check remind you.

**Can I run it for a client and charge for it?** Yes. The nine are MIT. Install them, adapt them, sell the work. Give your version its own name and keep the copyright notices in `LICENSE`.

**Is any of my data sent anywhere?** A local workspace is not an offline AI guarantee. Context handed to an AI provider or external worker can leave the machine. The optional Shopify reader and kit update checks also use the network. Keep business files outside Git/cloud sync, inspect what each worker receives, and do not put credentials in briefs. A `.gitignore` is not an access-control boundary and does not protect files already tracked or deliberately force-added.

**How do updates work?** On every kit, your agent tells you. Once a month it checks the published version of its own kit, and when there is a newer one the next report says so: the morning brief, or `intake-latest.md` on pod-design-agent. It never runs the upgrade itself. Agents update one at a time. Everything under `strategy/`, `state/`, your ledgers, your learned `recipes/*.json`, and the `## Corrections` at the foot of every file are yours and are never overwritten. Edited kit files also remain member work: inspect staged `.new` files and preserve corrections rather than replacing them blindly. The full upgrade procedure is in `docs/UPGRADING.md`.

**Can my fixes go back into the kits?** Yes, and the agent helps. When a routine repairs its own instructions it logs the change. Once a month, on every kit, the agent picks out the repairs that would be just as right on any business, takes your business out of them, and writes a draft to `improvements/contribution-draft-YYYY-MM.md`. On pod-design-agent, whose routines never rewrite their own instructions, the pass reads the dated `## Suggestions` lines they recorded instead. The brief, or `intake-latest.md` on pod-design-agent, names it once. You read it, then paste it into an issue or delete it. No routine ever opens an issue or a pull request.

**Where do updates come from?** This public GitHub repository is the source. Use the checkout procedure in [UPGRADING.md](UPGRADING.md). `npx ecom-agents` is not a distribution path for this repository.

**Where do I ask something not here?** Use the repository's available Issues or Discussions surface. No response-time commitment or paid support SLA is established by this documentation.
