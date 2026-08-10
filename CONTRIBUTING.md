# Working on this repo

Read this before you change anything here, whichever project you are working from.

## This repo is shared, and it is ADDITIVE

Several of Sean's projects publish to this repository: the job-search project
(`NEWTONS in the USA\Resume's`, which keeps a working copy at `Sean Newton\Portfolio\` on Drive
along with the inventory and plan), and the Cloudflare workstream (`atmops`, `cashtrace`,
`boxroom`). More may follow.

**The rule is additive. Nothing already here gets destroyed, only enhanced.** It is a portfolio: its
whole job is to accumulate everything Sean has built. If your project's work makes a section better,
improve that section. Do not narrow the repo to the slice your project cares about.

Concretely, when you rewrite a shared file, especially `README.md`:

- **Diff what you are about to remove, and check each removal is deliberate.**
  `git diff <old> <new> -- README.md | grep '^-'` takes ten seconds and shows you exactly what your
  rewrite drops.
- **Never drop a dimension of his positioning because it is not your project's dimension.** He is a
  builder AND a salesperson AND a designer, and the portfolio has to carry all of it. An engineering
  rewrite that quietly deletes the pre-sales and founder-operator material has damaged the portfolio
  even if every sentence it added was an improvement.
- Rewriting prose into a better form is fine. Deleting a subject is not.

## Never assume Drive is ahead of the remote

`Sean Newton\Portfolio\` on Drive is a working copy, **not** the source of truth. Other projects push
straight to the remote, so Drive is regularly behind.

1. `git fetch origin` FIRST, then compare. A push rejected as non-fast-forward means someone else
   contributed; that is normal here, not an error.
2. Reconcile per file, newest wins. Where both sides changed the same file, take the remote's version
   and re-apply only what is genuinely yours on top.
3. Sync the reconciled result back to `Sean Newton\Portfolio\` so Drive stops being a stale trap.
4. Do not force-push. Do not blind-merge. Do not copy Drive over the repo without checking.

On 2026-08-10 a Drive-over-repo copy would have destroyed an entire README repositioning, two new
code samples and an estate-count correction, none of which existed on Drive.

## Content rules

- **No client data, names or figures.** One engagement is under NDA and is described only in general
  terms ("a regional cash-in-transit operator"), never named, never with its KPI numbers.
- **Published code is Sean's own client-agnostic tooling only**, with synthetic configuration.
  Single-company applications (FLOW, the NDA client's routing and allocator, Cash Automation ledger
  logic) are described in prose writeups and never published as code.
- **No LinkedIn links.** Sean has no LinkedIn account and never wants one. Do not add profile links
  or article links, and do not re-add the dead ones from the repo's history.
- Sean reviews every code sample before it goes public.

## Where the working copies live

| Piece | Home |
|---|---|
| This repo | `C:\Users\sean\Repos\solutions-engineering-portfolio` |
| Drive working copy | `J:\Shared drives\NEWTONS in the USA\Resume's\Sean Newton\Portfolio\` |
| Inventory and plan | Same Drive folder. **Never push `portfolio_inventory.md` or `plan.md`**, they are internal. |
