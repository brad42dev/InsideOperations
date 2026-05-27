# Work Unit Log: workstream-2-claim-a-planning

planning-

Started: 2026-05-27T06:02:27+00:00
Session: 091b9b67-c8b9-42b5-8d09-82d94fe0356f

---


## #WRITE `/home/io/io-dev/io/ui-audit/06-claim-a-plan.md` (20240 chars written)

_2026-05-27T06:09:17+00:00_


## #PROMPT

_2026-05-27T06:09:27+00:00_

```
~initprompt~ workstream-2-claim-a-planning

Planning task. Read ui-audit/02-comparison.md and ui-audit/04-recommendations.md, focusing on entries that pertain to the application shell layer: the top bar, left navigation, routing, theming, and the token registry in index.css. Also read ui-audit/05-claim-c-deferral.md to confirm exclusions.

Goal: produce ui-audit/06-claim-a-plan.md as a work plan for converging the app shell layer. The plan will be executed in subsequent prompts; this prompt only plans.

Section one, scope. Enumerate every concrete change required to converge Claim A. Group changes into two categories: (a) token registry gaps meaning tokens referenced in code but not defined in index.css, or tokens that should be defined to support recommended convergence; (b) shell drift meaning places where Console, Designer, or Settings deviate from the app-shell pattern (sidebar widths, nav active-state indicators, top-bar styling). Cite the specific row in 02-comparison.md or recommendations section in 04-recommendations.md for each change.

Section two, multi-module implications. For each change, note whether it affects only one module, multiple modules, or the shell layer itself which affects all modules. This matters because the user plans to rebuild eight additional modules around the converged Console/Designer foundation, so shell-layer decisions get inherited by eleven modules total. Flag any change where the audit's recommendation has implications that should be reviewed by the user before executing rather than decided unilaterally by the model.

Section three, sequencing. Order the changes so that token registry work happens before shell drift work, because the drift fixes will likely reference tokens that need to exist first. Within token work, order so independent gaps go first and dependent ones go second. Note any change that could not be done as a small isolated PR and requires coordination.

Section four, definition of done for Claim A. State concrete completion criteria. Examples: every token referenced in shell components is defined in index.css; sidebar widths are consistent across all three modules with a documented value; nav active-state indicators render consistently across all three modules; the comparison file's Claim A rows are marked complete with references to the PRs or commits that landed them.

Section five, implications for future work. Per the user's longer-term plan, record two things. First, implications for the Claim C revisit (workstream 5) meaning any shell decision that may affect how the canvas seam is eventually unified. Second, implications for the eight-module rebuild meaning any shell convention being established now that the eight rebuilt modules should follow.

Do not start implementation. Do not modify any other audit files. This is planning only.

When done print the file path and the count of changes in each scope category and stop.
```


## #ASSISTANT

Reading the relevant audit files before writing the plan.


## #ASSISTANT

Now I have everything I need. Writing the plan document.


## #TURN_END

_2026-05-27T06:09:27+00:00_

---

