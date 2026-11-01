# v0.4.0 — Unified Workspace Expansion

User-approved scope change: 2026-10-31. All requirements in [specification](specification.md) target v0.4.0; no feature is silently deferred to another version. This is an integration checkpoint, not a release declaration.

## Verified baseline

- main `f90da8b`: PR #20 portrait tablet fix merged. Open PR #21 next-seven-days deadlines merged into integration only (`6cad355`); both browser regression scenarios retained.
- Existing release v0.3.1 is a prerelease with debug ARM64 APK built from `e812c65`. It does not contain these task fixes.
- Issue #13 remains open for real-device synchronization/overlay acceptance.
- React/TypeScript → WorkspaceRepository → Supabase (web) or Tauri/Rust/SQLite (native). Core 6 entities, settings, durable outbox/conflicts, secure refresh vault.
- SQLite schema 4; Cloud schema/core + 002 + 003 + 20261010030830. Native-only profile files. Backup consistent snapshot/archive/integrity/preview exists; restore/UI absent.
- Baseline: Node 52 tests; Rust 33 tests; TypeScript/Vite production build PASS. These are not device acceptance.
- Android stable signing credentials are not configured in this environment; Windows install/upgrade and Android data-preserving update acceptance are PENDING.

## Implementation matrix

Each row maps to the full acceptance list in the specification. PARTIAL never implies feature completion.

| Requirement ID | Feature | Modules | SQLite | Cloud schema | Sync | UI | Tests | Result | Commit/PR | Blocker / next step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TIMORA-V04-BASE-001 | Baseline/scope | docs/v0.4 | inspected v4 | inspected | inspected | existing | Node/Rust/build | PASS | this branch | none |
| TIMORA-V04-DATA-001 | Extended domain/persistence | domain, native, db | additive migrations | owner FK/RLS | capability version | provider | migration rollback | IN PROGRESS | this branch | full extended model |
| TIMORA-V04-SYNC-001 | Protocol/compatibility | cloud-sync, sync.rs, RPC | retained outbox | versioned RPC | old client isolation | explicit unsupported state | two SQLite/PG | IN PROGRESS | this branch | isolated integration |
| TIMORA-V04-TASK-001 | Subtasks | model/repository/editor | task child table | composite owner FK | durable CRUD | progress/reorder | CRUD/restart/concurrency | IN PROGRESS | this branch | implementation |
| TIMORA-V04-TASK-002 | Recurring tasks | recurrence domain/UI | rule + occurrences | same | deterministic identity | schedule/history | DST/leap/restart | NOT STARTED | — | rule lifecycle |
| TIMORA-V04-CAL-001 | Month/week/day + time blocks | Calendar/domain | time blocks | same | ordered parent | touch editor | timezone/overlap | NOT STARTED | — | existing month preserved |
| TIMORA-V04-NOTE-001 | Autosave/recovery | editor/draft | committed drafts | existing notes | local vs remote status | save/error/retry | restart/failure | NOT STARTED | — | durable draft design |
| TIMORA-V04-NOTE-002 | Tags/templates/search | notes/search | tags/links/templates | same + owner FK | new entities | CRUD/filter/insert | integrity/source | NOT STARTED | — | persistence |
| TIMORA-V04-PROJECT-001 | Kanban/detail/order | projects/tasks | board order | same | task status unchanged | DnD + buttons | conflict/reassign | NOT STARTED | — | ordering |
| TIMORA-V04-FILE-001 | Private attachments | native/storage/library | metadata | private Storage + metadata | bytes separate | picker/preview/states | corrupt/interrupted | NOT STARTED | — | native import/transport |
| TIMORA-V04-ROUTINE-001 | Daily routines/history | recurrence/Today | routines/completions | same | daily uniqueness | CRUD/progress | offline/convergence | NOT STARTED | — | recurrence foundation |
| TIMORA-V04-NOTIFY-001 | Opt-in OS reminders | native/scheduler | intent/device state | definitions only | no OS IDs | controls/deep links | scheduler/device | NOT STARTED | — | official API/device verification |
| TIMORA-V04-QUOTE-001 | Daily quotes | Today/catalog | settings/history/quotes | user quotes | local daily selection | dialog/management | restart/date/source | NOT STARTED | — | stable daily history |
| TIMORA-V04-GITHUB-001 | Account/repos/issues links | auth/native/references | metadata only | owner references | cached metadata | connect/link/disconnect | revoke/offline/isolation | NOT STARTED | — | OAuth/App configuration + vault |
| TIMORA-V04-REL-001 | Relations/backlinks | relation domain/editor | owner endpoint FK | same | delete/conflict | search/navigation | cycle/owner/restart | NOT STARTED | — | endpoint integrity |
| TIMORA-V04-BACKUP-001 | Backup/restore UI | backup.rs/runtime/UI | staged snapshot | no automatic stale push | restore guard | export/inspect/restore | rollback/old schema | PARTIAL | main #17/#18 | restore/UI/media |
| TIMORA-V04-SEC-001 | Security/retention | auth/RLS/capabilities | no destructive GC | owner isolation | retained tombstones | errors | full audit | PENDING | — | expanded surface |
| TIMORA-V04-PERF-001 | 100/1k/10k benchmark | load/search/calendar | indexes | paging | queue | responsive/accessibility | measured benchmarks | NOT STARTED | — | measure final implementation |
| TIMORA-V04-DIST-001 | Windows installer/ZIP | NSIS/CI | upgrade preserve | — | — | install | OS upgrade | PENDING | — | Windows runner + acceptance |
| TIMORA-V04-DIST-002 | Signed ARM64 APK | Android/CI | upgrade preserve | — | — | OS installer | signature/data | BLOCKED | — | stable signing identity + old signature compatibility |
| TIMORA-V04-UPDATE-001 | Update Center | release/updater/native | — | — | — | progress/consent | artifact authenticity | NOT STARTED | — | platform updater verification/signing |
| TIMORA-V04-RELEASE-001 | RC/release gate | CI/docs/artifacts | migration verified | no production apply | integration | acceptance | all specification gates | BLOCKED | — | mandatory features and device gates |

## Safety and execution

Production schema/data, main merges and official releases require explicit approval under the supplied specification. All implementation/tests use branches and disposable fixtures. Keep previous evidence; do not uninstall/reset a user's app. Feature commits merge into version/v0.4 after relevant checks. New tables must have explicit sync contracts before they can be described as synchronized.

## Resume checkpoint

Start with the current branch status and matrix; do not reinitialize the project. Complete data/sync foundation before dependent workflows. Record actual test commands and failures below as work proceeds.

## Checkpoint — 2026-11-01 (KST)

Implemented subtask vertical slice: SQLite schema 5, owner-safe PostgreSQL table/RLS, version 2 capability negotiation and RPCs, legacy v1 feed filtering, CRUD/progress/manual parent completion, atomic full-permutation reorder, touch/keyboard buttons, native durable queue, parent-delete conflict protection. Backup validation accepts schema 4–5 and checks manifest/DB version agreement. Core v0.3 imports remain accepted without extension arrays.

Verification: Node 53 tests PASS; Rust 37 tests PASS; production build PASS; Web browser fixture PASS; Android browser fixture including subtask creation/completion/reordering PASS. Isolated PostgreSQL 16: existing sync/core/profile SQL and new subtask RLS SQL PASS. Real two-SQLite/Rust + PostgreSQL integration PASS, including offline subtask completion, identical concurrent completion, reorder, owner isolation and explicit parent-delete conflict resolution. Auth is a fixture; this is not live Supabase/device acceptance.

Matrix update: TIMORA-V04-TASK-001 implemented with automated coverage; real-device acceptance PENDING. TIMORA-V04-DATA-001 and SYNC-001 PARTIAL: subtask foundation only; remaining entity contracts are not implemented. All other outstanding matrix items remain outstanding. No v0.4 APK/installer produced, no production migration applied, no official release published. Application version stays 0.3.1 until release engineering is ready; this branch is not a completed v0.4 build.

Next exact checkpoint: finish extended domain models and recurrence/routine persistence and contracts, then follow specification phases 2–8. Add explicit legacy schema-4 archive fixture coverage and native platform command compilation to CI evidence. Cloud v0.4 sync deliberately pauses with a server-update message until the new migration is approved and applied; local data and pending operations remain accessible. Web on legacy Cloud retains core functionality and disables subtask editing.

### Continued implementation — 2026-11-01

Added tested date-only recurrence calculator (daily/weekdays/weekly/monthly/yearly, custom intervals, end/count, pause, timezone day selection, bounded enumeration). Month-end and leap-day invalid dates are skipped. This is domain logic only: persisted rules/occurrences, deterministic UUID identity, routine UI and synchronization are still NOT implemented.

PR CI database passed. SQLite job failed formatting of the test driver; corrected. Web CI passed unit/build/Web browser but failed desktop UI; local desktop rerun passed. Subtask UI assertions now wait for rendered committed state to avoid observing pending asynchronous writes. CI rerun remains PENDING. CI log blob hosts were blocked by environment policy; job steps/annotations were accessible. No claim of full CI/platform acceptance.

### Post-merge checkpoint — 2026-11-01

Baseline main b6ae875 includes merged #21/#22. Fixed a duplicated upcoming-deadline fixture introduced by combining those branches (duplicate const declarations prevented browser tests from parsing). Added month/week/day Calendar selection, previous/next period, Today navigation and existing item detail editing. Date-only task semantics and instant-based event overlap stay unchanged. Node 57 tests, production build, Android and desktop browser fixtures PASS. Calendar time blocks/resizing and the other outstanding requirements remain unimplemented; this is not full Calendar 2.0 or v0.4 completion. No production schema, signing or release changes.

### Implementation-first checkpoint — 2026-11-01

Per user direction, full acceptance verification is deferred. Added existing-note debounced autosave through WorkspaceRepository, explicit save/retry, owner/note-scoped best-effort draft recovery, external-change stop, safe append-only starter templates, and local-vs-Cloud save messaging. New notes still require the initial explicit save. User-editable templates, tags, encrypted draft storage, automatic transient retry and per-note Cloud acknowledgement remain outstanding.

Added Project Task board/list switch, three existing status columns, counts, priority/date/title sorting, card details, drag status changes and accessible touch/keyboard select alternatives. Status persists through the existing Task repository/sync. Manual card ordering remains outstanding; this board uses derived sort order. No new schema or production changes. TypeScript check passes; UI/acceptance checks deferred, no full feature/release completion claim.

### Routine persistence checkpoint — 2026-11-01

Added SQLite schema 6 and additive PostgreSQL routines/routine_completions tables, owner-safe relationships, deterministic SHA-256-derived completion UUIDs, per-day status, archive/pause instead of discarding history, durable outbox and v3 RPCs. v1/v2 feeds exclude new entity types. Added routine CRUD/schedule controls, completion/undo/history, archive recovery and Today progress. Reminder preference is stored only; OS delivery is not implemented. Recurring Task linkage remains unfinished.

Minimal data-safety verification: existing Rust 37 tests, TypeScript, isolated migration and actual two-SQLite/PostgreSQL integration including concurrent same-day completion, undo, retained history and owner isolation. Test cleanup now rolls back failed transactions and removes the third fixture user. Full UI/device acceptance is deferred per user direction. Production schema is unchanged; native v3 sync waits for corresponding server support.
