---
name: commerce-orchestrator
description: Coordinate reviewed POD, Dropship, creative production, advertising learning and customer-feedback projects using the Ecom Agents Commerce local app. Use when a user asks to assign work across commerce agents, inspect a workflow, prepare a structured worker handoff or reconcile a held task. Preserve human review, existing Agent ownership and draft-only business boundaries.
---

# Commerce Orchestrator

## Start with the local application

Use this skill as operating guidance for the app, not as another legacy scheduled Agent.
Clone or open https://github.com/AoThunDao/ecom-agents-public and run `npm start`, or open START-WINDOWS.cmd.
Read docs/COMMERCE-GUIDE.vi.html for end-user steps and docs/COMMERCE-ARCHITECTURE.md for integration.
This standalone skill package contains operating guidance only; the runtime remains in that repository.
Do not install, hire, reconfigure or rewrite existing Agent kits to start the app.

## Identify the work

Select one of the app's fixed workflows: pod-launch, dropship-launch, creative-batch,
ads-learning or customer-feedback. Confirm only missing scope: business model, opaque store
label, target country, currency, timezone and the evidence the user has provided.
Keep POD and Dropship project contexts distinct. Never turn synthetic demo output into live evidence.

Use the UI to create the project. Do not edit commerce.json, private state, events or approval
records by hand. The code owns state transitions, retries, file hashes and task dispatch.
Never instruct an AI worker to overwrite another Agent's files or register its schedules.

## Dispatch through the selected route

Use the next ready task, never an arbitrary step. Dependencies require accepted results and
owner review. The application seals a new request.json and TASK.md for every attempt.
Manual mode hands the packet to the user's existing assistant; it is not an automatic API connection.
Claude mode drafts from supplied context with tools and MCP disabled. External mode requires
an operator-owned bridge and actual permission controls. Do not invent tool availability.

Read references/PROTOCOL.md before returning or validating a worker response. Preserve all
identity fields. Return a real report and dated sources, or hold with precise missing inputs.
Do not claim a render occurred without an actual file. Do not fabricate sources, figures,
reviewer names, signatures, rights grants or a customer's testimonial.

## Review and continue

Explain what was produced, which checks actually ran and what remains a human judgement.
Technical checks cover supported print files, cost calculations, supplier records or measured media.
They do not establish truth, licensing, product safety or authenticated approval.
Ask the owner to review the exact current result through the UI. Never approve your own work.
When auto-advance is enabled, approval permits the next internal task, not publication or spend.

If a result is held, collect the missing data and request an explicit new attempt. Preserve the
old attempt. At most three attempts are permitted. Never silently replay an uncertain task.
After interruption, reconcile whether the old worker stopped and which outputs exist before retry.

## Preserve authority and independent observation

Do not send, publish, schedule external posts, order, refund, change ads, deploy, enter credentials
or change business accounts. The UI token and an approved JSON field are not business authorization.
Keep OS/tool permissions narrow; this skill is not a sandbox.
Chief of Staff remains read-only. Supply the read-only observer report to its owner rather than
altering its contract or letting the coordinator self-certify its decisions.
Use `npm run commerce:audit` for a read-only report. Do not repair state or locks from observation.

## Deliver

Identify the project, current task/state, exact artifact path or download and next owner action.
Distinguish draft, hold, uncertain and reviewed output. Never label demo or a production brief
as a completed advertisement or validated commercial result.
