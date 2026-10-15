# Ledgerly — AI Working Rules

Ledgerly is an organization-first expense management app with personal and platform account types. It is a frontend-only
React 19 + TypeScript + Vite app; the "backend" is Mock Service Worker + IndexedDB running in the browser.

## Workflow (mandatory)

1. **Inspect first.** Read the affected code and the relevant architecture documentation before proposing anything.
2. **Plan and wait for approval.** Present a concise plan: files to add/modify, what changes and why, new dependencies,
   risks, and how it will be verified. Do not edit any project file until the user explicitly approves the plan.
3. **Implement exactly the approved plan.** If more changes turn out to be necessary, or the plan conflicts with the
   architecture, stop and ask. No unrequested features, refactors or dependencies.
4. **Do not break existing functionality.** Run `npm test`, `npx tsc -b`, `npm run lint` and `npm run build` after every
   change, and add or update tests for the behavior changed. Report failures honestly with their output.
5. **Explain the result.** After implementing, explain what changed and why, file by file, plus verification results and
   any remaining issues.
6. **Branch per phase.** Each roadmap phase is developed on its own branch created from `main`
   (`phase-<n>-<short-name>`). Never commit directly to `main`.
7. **Commit and push to the phase branch** once an approved item is implemented and verified. One focused commit per
   item. Never force-push.
8. **Pull request at phase completion only.** Ask before opening the PR to `main`, and never merge it without approval.
9. **Track progress.** Mark completed items in the project roadmap and record follow-ups discovered during the work.

## Constraints

- Only free or open-source libraries and services. No paid or freemium APIs, no API keys.
- No real backend for now. All "server" behavior lives in `src/mocks/`.
- New dependencies require approval; prefer the platform or an existing dependency.

## Commands

```bash
npm run dev       # Vite dev server (MSW enabled in dev)
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm run preview   # serve the production build
npm test          # Vitest, single run
npm run test:watch
```

## Testing

- Vitest with three projects (`vitest.config.ts`): `unit` (Node, `src/**/*.test.ts`), `api` (jsdom,
  `src/mocks/handler/**/*.test.ts`) and `dom` (jsdom, `src/**/*.test.tsx`). Tests sit next to the code they test.
- IndexedDB is provided by fake-indexeddb; `src/test/setup.ts` resets and reseeds the mock database before every test.
- API tests go through the real MSW handlers with `setupApiServer()`, `signIn()` and `apiFetch()` from
  `src/test/apiServer.ts`, so authentication and authorization are exercised as in the app.
- Tests assert behavior and authorization outcomes (including negative cases), not implementation details. Use
  `vi.setSystemTime` for date-dependent rules; each scenario creates the data (e.g. budgets) it needs.

Production on Netlify sets `VITE_ENABLE_MOCKS=true`, so the mock backend also runs in the deployed app.

## Architecture rules

- **Feature-oriented structure.** Domain code lives in `src/features/<feature>/` (`api`, `components`, `pages`, `types`,
  `utils`, ...). `src/components/common` holds domain-neutral UI; `src/types` only genuinely app-wide contracts.
- **Dependency rule.** A feature may use another feature's public types/API, never its internal helpers.
- **API boundary.** UI talks to data only through RTK Query endpoints in the owning feature's `api/`. Components never
  touch IndexedDB, repositories or mock services directly.
- **Mock backend layering:** `MSW handler → auth guard / authorization → service → repository → IndexedDB`
  (`src/mocks/handler`, `src/mocks/services`, `src/mocks/repositories`, `src/mocks/db`). Handlers stay thin; business
  rules live in services.
- **Authorization is enforced by the API.** Every protected handler checks permission, organization, scope
  (own/team/department/organization), record state and domain rules. UI checks only hide what the API already refuses.
- **Organization isolation and account types.** Organization, personal and platform data never cross. Personal and
  platform routes stay behind their account-type guards.
- **Audit atomicity.** Business mutations and their audit events are written in one IndexedDB transaction.
- **Schema changes** to IndexedDB require a version bump and a migration in `src/mocks/db/indexedDb.ts`; existing user
  data in browsers must keep working.
- **Server vs client state.** Server data stays in RTK Query; Redux/client state only for UI concerns. Binary documents are
  never stored in Redux.
- **Lazy routes.** New pages are lazily loaded in `src/routes/router.tsx` and guarded with the existing route guards.

## UX and text conventions

- Every change that mutates data is confirmed through the shared confirmation dialog; preferences save immediately.
- Use the shared loading / empty / error / feedback components in `src/components/common`.
- Title Case for page titles, buttons, tabs and dialog titles; sentence case for card titles, labels, helper text and
  messages. Formal tone, no contractions, no internal terms (API, IDs, status codes) in user-facing text.
- Dates: "27 Sep 2026" / "27 Sep 2026, 1:21 pm" via the shared `formatDate` / `formatDateTime`.
- Currency: ₹ with Indian digit grouping via the shared `Amount` component (until multi-currency lands).
- Spend metrics count reimbursed expenses only, and pages say so.
- Accessibility: never rely on color alone; fields have associated errors; controls are keyboard accessible.

## Code style

- Match surrounding code: naming, comment density, MUI + theme usage (`src/theme`), and existing patterns in the feature.
- TypeScript strict; no `any` without a reason.
- Keep components focused; extract feature components rather than growing very large pages.
