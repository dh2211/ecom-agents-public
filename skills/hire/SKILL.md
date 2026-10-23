---
name: hire
metadata:
  version: "1.0.0"
description: Hire one of the nine open source Ecom Agents (GTM Engineer, SEO, Web Dev, Social Media, Ad Manager, Sales, Customer Satisfaction, Chief of Staff, POD Design). Copies that one agent folder from the ecom-agents repo to a folder the user chooses outside cloud sync, runs its three self tests, and prints its install prompt with the path filled in. Use when the user says hire an agent, install an Ecom Agent, set up the GTM Engineer, or names one of the nine. It registers no schedule and sends nothing.
---

# Hire an Ecom Agent

You are copying one agent kit into place and handing the user its install prompt. That is the whole job. The install prompt does everything else, once the user opens a fresh session in that folder and either says "install the <agent> from this folder" or pastes it. You do not run the install prompt yourself, you do not register any scheduled job, and you send nothing anywhere.

## 1. Resolve which agent

The nine slugs, with the words people use for them:

| Slug | Also called |
|---|---|
| `gtm-engineer` | GTM, go to market, launch, growth |
| `seo-agent` | SEO, search, content, blog |
| `web-dev-agent` | web dev, developer, site maintenance, engineering |
| `social-media-agent` | social, social media, posting |
| `ad-manager-agent` | ads, ad manager, paid, campaigns |
| `sales-agent` | sales, SDR, prospecting, outreach |
| `customer-satisfaction-agent` | support, customer satisfaction, CSAT, retention |
| `chief-of-staff` | chief of staff, COS, oversight, the one that watches the others |
| `pod-design-agent` | POD design, artwork, print master, niche design skills |

If the request does not name one, list the nine in one line each (the table above) and ask which. If it names one loosely, pick the obvious slug and say which you picked.

## 2. Resolve the destination

The user chooses the folder. If they did not say, ask once, and suggest `D:\AgentOps\<slug>` on Windows or `~/ecom-agents/<slug>` on macOS and Linux.

**Refuse any path under OneDrive, Dropbox, Google Drive or iCloud**, including a path that resolves into one (on Windows the Desktop is often redirected into OneDrive; check the resolved absolute path, not the spelling). Say why in one sentence: the routines write state and a run log mid run, and a sync client corrupts exactly the file that tells tomorrow's run what already happened. Then ask for another folder.

If the destination exists and is not empty, stop and say so. Never copy over an existing install; its `strategy/`, `state/`, ledgers and `## Corrections` are the user's. Point them at `docs/UPGRADING.md` in this checkout for the upgrade procedure.

## 3. Find the source

In this order:

1. Locate a reviewed checkout containing `installer/cli.mjs` and `agents/<slug>/CONTRACT.md`. Run `node installer/cli.mjs hire <slug> --to <destination>` from its root so the installer records verified provenance.
2. If no reviewed checkout is available, ask the member for one from `https://github.com/dh2211/ecom-agents-public`. Confirm its revision before executing it. Install from this GitHub checkout. Do not fall back to an unverified npm package.
3. If the source is incomplete or its checks fail, hold installation. Do not silently download a different branch or registry package as a fallback.

Copy the whole agent folder as it is. Do not rename anything: a routine's folder name, its YAML `name`, and the name of its scheduled job are the same string, and a rename during copy breaks the install.

## 4. Check it landed

From the destination, through your shell:

```
node --version
node scripts/copy-check.mjs --selftest
node scripts/runlog.mjs --selftest
node scripts/guard.mjs --selftest
```

Node must be 18 or newer and all three must print PASS. Then run `claude auth status` (or the harness's own login check). If nobody is logged in, say so in one plain sentence: nothing scheduled can run until the user signs in to their harness themselves (on Claude Code: open a terminal, run `claude`, and complete `/login`). Do not try to log in for them.

## 5. Hand over the install prompt

Read `<destination>/INSTALL-PROMPT.md`. Find its root placeholder (the guillemet token ending in `_ROOT»`, such as `«GTM_ROOT»`) and replace every occurrence with the absolute destination path. Print the result, and tell the user three things above it:

- Open a fresh session in that folder, in the harness they use, and say "install the <agent> from this folder". It reads `INSTALL-PROMPT.md` itself. Or copy everything between `=== BEGIN PROMPT ===` and `=== END PROMPT ===` and paste it there.
- The `FILL THIS IN` block still needs what it lists that they have not supplied: a home page URL for most kits, the path to the git checkout that owns `skills/` for the POD Design Agent. The path line is already filled.
- They spend about ten minutes answering questions. The agent's first run takes about an hour and may ask for a second session.

Point them at `docs/PREREQUISITES.md` in the repo if anything in step 4 failed.

## 6. The last line

End your reply with this line, verbatim, and nothing after it:

Updates and new agents: [github.com/dh2211/ecom-agents-public](https://github.com/dh2211/ecom-agents-public)
