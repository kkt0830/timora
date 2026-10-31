# TIMORA v0.4.0 — UNIFIED WORKSPACE EXPANSION
## Master Engineering & Implementation Directive

### ROLE

You are the Principal Software Architect, Lead Full-Stack Engineer, Native Application Engineer, Database Engineer, Security Engineer, Release Engineer, and QA Lead responsible for developing Timora v0.4.0.

This is an **implementation assignment**, not a request for a proposal, roadmap-only document, or superficial code generation.

You must inspect the real repository, establish its verified baseline, implement the agreed features, run actual tests, fix failures, commit changes, and prepare a reviewable integration pull request.

Do not falsely claim that code works merely because it compiles.

Do not claim that an APK, installer, database migration, or synchronization workflow is verified unless corresponding evidence exists.

### Repository

- Repository: `https://github.com/kkt0830/timora`
- Target: `v0.4.0`
- Version name: `Unified Workspace Expansion`
- Integration branch: `version/v0.4`
- Default branch: `main`

### Product Vision

Timora:

> 나의 일상과 시간, 기록과 작업을 하나의 흐름으로.

The goal is to transform Timora into a reliable, connected, cross-platform productivity workspace, combining features previously planned through v1.0.

The resulting application must support Android, Windows, and the existing web architecture without abandoning its Local-first principles.

**Preserve user data above all other development objectives.**

---

# SECTION 1 — NON-NEGOTIABLE ENGINEERING RULES

## 1.1 Source of Truth

Before implementing anything, inspect:

- Current `main` HEAD, tags, releases, branches, and relevant open PRs
- `README.md`
- `ROADMAP.md`
- `REQUIREMENTS.md`
- `CHANGELOG.md`
- `DESIGN.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/cloud-sync.md`
- `docs/offline.md`
- `docs/verification.md`
- Existing SQLite migration files
- PostgreSQL migrations and RLS
- Actual React components, services, and providers
- Native Rust/Tauri commands
- Android native integration
- Windows installer configuration
- GitHub Actions
- Available tests and their verified results

Existing documentation may be outdated.

Determine the actual state by comparing code, tests, commit history, and documentation.

Never assume a feature is completed merely because a roadmap claims it is.

## 1.2 Preserve Existing Architecture

Current architecture is broadly:

```text
React / TypeScript
       |
Domain / Providers
       |
WorkspaceRepository
       |
+------+------+
|             |
Web           Native
Supabase      Tauri IPC
PostgreSQL    Rust
RLS           SQLite
              |
          Sync Outbox
              |
          Supabase RPC
```

Preserve and extend this architecture unless an alternative is clearly justified by code-level evidence.

Do not introduce duplicate backend implementations for Android and Windows.

Do not rebuild the application from scratch.

Do not remove existing working capabilities.

Do not replace Local-first persistence with mandatory online storage.

## 1.3 Data Preservation

Never perform the following automatically:

- Delete existing user databases
- Reset SQLite after migration failure
- Delete production Supabase records
- Reset production RLS
- Replace a user's workspace with test fixtures
- Destroy pending sync operations
- Remove unresolved conflict data
- Overwrite private attachments during migration
- Uninstall the existing Android app to resolve signing conflicts

All schema changes must use versioned migrations with tests.

If a migration cannot be safely completed, stop that migration and preserve the original data.

## 1.4 Security and External Actions

Never commit or log:

- Supabase service-role keys
- Secret API keys
- OAuth client secrets
- GitHub access tokens
- Android keystores
- Private signing keys
- User passwords or refresh credentials

Use narrowly scoped access, secure credential storage, and operating-system permission boundaries.

Do not modify production Supabase schema or data without explicit authorization.

Do not deploy to production, publish an official release, or merge into `main` without explicit user approval.

Development branches, test databases, drafts, and review PRs are permitted within existing authorized repository access.

## 1.5 Dependency Verification

Consult the current official documentation for Tauri 2, Android SDK, Supabase, GitHub OAuth/GitHub Apps, and relevant libraries before integrating their APIs.

Do not invent unavailable API calls or assume a plugin supports a capability without verifying it.

Prefer existing dependencies and stable official integrations.

---

# SECTION 2 — PROJECT MANAGEMENT AND EXECUTION

## 2.1 Target Version

All features specified below belong to one integrated version:

**Timora v0.4.0**

Do not split required functionality into later product versions merely because the scope is large.

However, divide actual engineering work into isolated feature branches, milestones, test gates, and integration checkpoints.

Do not treat a single long model run as proof that the entire project is complete.

## 2.2 Branch Strategy

Create or update `version/v0.4` from the verified baseline.

Suggested working branches:

```text
version/v0.4
|
+-- feature/v04-data-foundation
+-- feature/v04-tasks-routines
+-- feature/v04-calendar-notes
+-- feature/v04-projects-library
+-- feature/v04-relations-github
+-- feature/v04-notifications-quotes
+-- feature/v04-platform-performance
+-- feature/v04-release-distribution
```

Adapt names to repository conventions and avoid replacing existing work.

Merge feature changes into the integration branch only after the relevant tests pass.

Preserve separate commits for distinct features.

## 2.3 Requirement Tracking

Create an implementation matrix with the following fields:

- Requirement ID
- Feature
- Affected modules
- SQLite changes
- Cloud schema changes
- Sync changes
- UI changes
- Tests
- Verification result
- Commit or PR reference
- Remaining blocker

Use stable requirement IDs, such as:

`TIMORA-V04-TASK-001`

Update the matrix throughout development.

If tools are unavailable, record the limitation and continue independent tasks.

## 2.4 Documentation

Update `ROADMAP.md` and `REQUIREMENTS.md` so that they reflect the new unified v0.4 scope.

Preserve historical milestones accurately.

Do not erase earlier verification evidence.

Record this new scope as a user-approved planning change, not as a previously completed implementation.

---

# SECTION 3 — DATA PLATFORM FOUNDATION

## 3.1 Extended Domain Architecture

Design and implement domain support for:

- Subtasks
- Recurrence rules
- Recurrence occurrences
- Calendar time blocks
- Note tags
- Note templates
- Project board ordering
- Library attachments
- Routines
- Routine completion records
- Quotes and quote history
- Reminder definitions
- Object relations
- GitHub integration metadata
- Backup manifests

Ensure these entities follow shared ownership, validation, and serialization rules.

## 3.2 SQLite Schema

Use additive, versioned SQLite migrations.

Existing database versions must migrate to the new schema without losing:

- Entity UUIDs
- Local identity
- Cloud identity mappings
- Task dates
- Existing notes
- Project associations
- Profile pictures
- Sync revisions
- Pending outbox operations
- Conflicts
- Tombstones
- Failed operations

Do not hardcode the next SQLite schema number until the actual repository's latest schema has been inspected.

Apply migrations transactionally.

A newer unsupported schema must not be silently downgraded.

## 3.3 PostgreSQL Schema

Create corresponding PostgreSQL migrations for data intended to synchronize.

Use:

- UUID primary keys
- Owner-bound `user_id`
- Foreign keys
- Owner-safe composite relationships where needed
- RLS policies
- Required indexes
- Referential integrity constraints

Do not apply a newly written migration to production as part of local testing.

Test it against an isolated PostgreSQL instance.

## 3.4 Sync Protocol Evolution

Existing Cloud Sync supports core workspace entities.

Extend the protocol safely for new synchronized objects.

Requirements:

- Durable outbox
- Stable operation IDs
- Idempotent retries
- Owner isolation
- Ordered dependency application
- Deletion propagation
- Conflict detection
- Recovery after connection loss
- Recovery after app restart
- String-safe remote revision/cursor handling
- Cross-version compatibility strategy

New entities must be explicitly included in the synchronization contract or clearly marked local-only.

Do not silently report successful Cloud synchronization for local-only features.

## 3.5 Cross-Version Compatibility

Define how old v0.3.1 clients behave after the Cloud schema is upgraded.

Prevent older clients from corrupting newer entities or deleting unknown records.

Consider capability negotiation, minimum sync protocol versions, and safe update-required states.

Offline access to existing local data must remain available when Cloud synchronization is blocked by a version mismatch.

---

# SECTION 4 — TASKS 2.0

## 4.1 Subtasks

Implement first-level subtasks under existing Tasks.

Required capabilities:

- Create
- Rename
- Complete and uncomplete
- Delete
- Reorder
- View completion percentage
- Preserve parent relationship
- Work offline
- Synchronize across devices

For v0.4, limit nesting to one level unless existing architecture already supports safe recursive nesting.

Do not create duplicate full Task records just to represent checklist items without an explicit design rationale.

## 4.2 Completion Rules

The parent Task and its subtasks have separate completion states.

Default policy:

- Completing a subtask does not automatically complete its parent.
- Completing all subtasks does not silently change parent status.
- The parent displays calculated subtask progress.

Provide clear UI for manual completion.

## 4.3 Recurring Tasks

Implement recurrence types:

- Daily
- Weekdays
- Weekly
- Monthly
- Yearly
- Custom interval

Support:

- Start date
- Optional end date
- Optional occurrence limit
- Selected weekdays
- User timezone
- Pause/resume
- Rule editing
- Individual occurrence completion

## 4.4 Recurrence Engine

Separate recurrence definitions from occurrence history.

Do not represent all repeated work as one mutable completion flag.

Use deterministic occurrence identities and uniqueness constraints.

Handle:

- Timezone differences
- Daylight Saving Time
- Month-end dates
- Leap years
- Missed occurrences
- Offline device restarts
- Two devices creating the same occurrence
- Rule modifications
- Rule deletion
- Completed historical occurrences

Do not generate an unbounded number of overdue records.

## 4.5 Tests

Test at minimum:

- Parent/subtask CRUD
- Progress calculation
- Reordering
- Parent deletion
- Offline persistence
- Two-device synchronization
- Daily/weekly/monthly recurrence
- February and leap-year behavior
- DST boundaries
- Duplicate occurrence prevention
- Concurrent completion
- Restart recovery

---

# SECTION 5 — CALENDAR 2.0

## 5.1 Views

Implement:

- Month view
- Week view
- Day view
- Today navigation
- Previous/next period
- Responsive mobile/tablet layout

Preserve the existing month view.

## 5.2 Task and Event Integration

Display Tasks and Events on the same calendar without duplicating their source records.

Tasks retain their date-only semantics unless explicitly assigned time blocks.

Events retain instant-based timestamps.

Do not automatically reinterpret an existing due date as UTC midnight.

## 5.3 Time Blocks

Allow users to:

- Assign time blocks to Tasks
- Create and edit scheduled Events
- Move scheduled items
- Resize time blocks where appropriate
- View overlapping items
- Open the underlying Task or Event

Use a defined timezone policy.

## 5.4 Mobile Interaction

Support touch navigation, scrolling, and accessible alternatives to drag-and-drop.

A user must be able to move or edit an event without relying entirely on dragging.

## 5.5 Tests

Cover:

- Day/week/month navigation
- Midnight boundary behavior
- All-day items
- Timezone differences
- Overlapping events
- Drag/drop updates
- Touch editing
- Offline changes
- Cloud synchronization
- Screen rotation

---

# SECTION 6 — NOTES 2.0

## 6.1 Autosave

Implement reliable local autosave.

Requirements:

- Debounced saving
- Saving status
- Saved status
- Sync pending status
- Sync complete status
- Explicit error handling
- Retry after transient failure

Distinguish between locally saved and remotely synchronized.

Do not show "saved" before the local transaction commits.

## 6.2 Draft Recovery

Investigate process termination and application restart behavior.

Preserve the latest successfully committed draft.

For unsaved in-progress text, provide a best-effort recovery strategy using a safe local draft mechanism.

Do not imply full crash recovery if it cannot be guaranteed.

## 6.3 Note Tags

Implement:

- Tag creation
- Tag renaming
- Tag deletion
- Multiple tags per note
- Tag filtering
- Tag-based searching

Prevent cross-account links.

## 6.4 Templates

Implement reusable templates.

Provide starter categories:

- General note
- Development log
- Reading journal
- Meeting notes

Users must be able to create and edit their own templates.

Template insertion must not silently overwrite existing note content.

## 6.5 Markdown Integrity

Preserve existing Markdown source.

Any editor improvement must not damage:

- Headings
- Lists
- Links
- Code blocks
- Korean text
- Line breaks
- Unicode characters

Do not render unsafe raw HTML or executable links.

## 6.6 Tests

Cover:

- Autosave timing
- Save failure
- Process restart
- Markdown preservation
- Tag relationship integrity
- Template insertion
- Simultaneous edits
- Search results
- Offline editing
- Sync conflicts

---

# SECTION 7 — PROJECTS 2.0 / KANBAN

## 7.1 Board View

Implement Kanban for project Tasks.

Default columns:

- Todo
- In Progress
- Done

Use the existing Task status as the source of truth.

Do not maintain a second conflicting Task status in Kanban-specific storage.

## 7.2 Board Features

Required:

- List/Board view switch
- Drag-and-drop card movement
- Touch-friendly movement alternative
- Column counts
- Project progress
- Sorting
- Priority display
- Due-date display
- Quick Task details

## 7.3 Persistence

Persist card order separately from Task status where necessary.

Changing a card status must update the same Task that appears in Tasks and Today.

## 7.4 Project Detail

Improve project detail views to show:

- Tasks
- Notes
- Related resources
- Progress
- Current status
- Relevant relations

Avoid building a separate disconnected project database.

## 7.5 Tests

Cover:

- Board reorder
- Status transitions
- Offline board movement
- App restart
- Concurrent changes
- Project deletion
- Task reassignment
- Mobile input
- Keyboard accessibility

---

# SECTION 8 — LIBRARY 2.0 / ATTACHMENTS

## 8.1 Local Attachments

Implement file attachment support using platform-native file selection.

Initial supported file categories:

- PDF
- PNG
- JPEG
- WebP
- Plain text

Expand formats only after validation and security review.

## 8.2 Storage Architecture

Store files within app-private storage.

Separate file metadata from file bytes.

Use generated internal IDs and safe filenames.

Preserve original filenames as display metadata.

Store:

- Attachment ID
- Owner ID
- Parent resource ID
- Original filename
- MIME type
- File size
- Content checksum
- Created timestamp
- Local availability state
- Cloud availability state

## 8.3 File Security

Prevent:

- Path traversal
- Unauthorized filesystem access
- Executable file abuse
- Oversized file processing
- Decompression bombs
- Untrusted remote filename execution
- Cross-account attachment access

Do not grant broad JavaScript filesystem access merely to implement attachments.

Use narrowly scoped native commands.

## 8.4 Cloud Attachment Strategy

Investigate Supabase Storage integration.

Prefer private owner-scoped storage paths and authenticated access.

File metadata and file bytes must have distinct transfer states.

Do not transmit binary files through the existing small-record JSON synchronization RPC.

Implement upload/download retries and integrity checks where supported.

If Cloud file synchronization is blocked by external setup, complete the local attachment functionality and preserve explicit pending states.

Do not claim cross-device file support without a successful end-to-end test.

## 8.5 File Lifecycle

Handle:

- Source file removal
- App restart
- Upload interruption
- Download interruption
- Attachment deletion
- Parent object deletion
- Backup and restore
- Storage quota
- Duplicate content
- Orphan cleanup

## 8.6 Tests

Cover:

- Import
- Preview
- Read
- Delete
- Corrupt file
- Oversized file
- Invalid MIME
- Interrupted upload
- Interrupted download
- Checksum mismatch
- Offline persistence
- Cross-account isolation
- Backup/restore

---

# SECTION 9 — DAILY ROUTINES

## 9.1 Routine Management

Implement a dedicated Routine system.

Required fields:

- Name
- Description
- Enabled state
- Repeat schedule
- Preferred reminder time
- Timezone
- Optional category
- Created timestamp
- Updated timestamp

## 9.2 Daily Completion

Store completion separately for each local calendar date.

Users can:

- Complete today's routine
- Undo completion
- View daily history
- View current progress
- Edit routine schedule
- Pause a routine

Historical completion records must not disappear when a recurring rule changes.

## 9.3 Today Integration

Display today's routines within the Today screen.

Show:

- Total scheduled routines
- Completed routines
- Remaining routines
- Progress percentage

The UI must not shame users for incomplete routines.

Avoid unnecessary achievement pressure or repeated intrusive reminders.

## 9.4 Task Engine Reuse

Share recurrence calculation utilities with recurring Tasks where technically appropriate.

Do not force Routine entries into ordinary Task records if their data lifecycle differs.

## 9.5 Tests

Cover:

- Daily completion
- Undo
- Date transition
- Offline completion
- Schedule changes
- Timezone changes
- Concurrent completion
- Sync convergence
- Historical preservation

---

# SECTION 10 — SMART NOTIFICATIONS

## 10.1 Notification Requirements

Implement user-controlled reminders for:

- Routine schedules
- Task start times
- Task due dates
- Optional event reminders

## 10.2 User Controls

Users must be able to:

- Enable/disable notifications
- Set reminder timing
- Change notification schedules
- Disable individual reminders
- See permission status
- Open the relevant item from a notification

Notifications must be opt-in where required by the operating system.

## 10.3 Platform Support

Investigate official Tauri notification capabilities and native platform requirements.

Android:

- Notification permissions
- Scheduled notifications
- App restart
- Device reboot where supported
- Battery management limitations
- Appropriate PendingIntent/deep-link behavior

Windows:

- OS notification APIs
- App identity
- Installer dependencies
- Scheduled notification support
- Startup behavior

Do not promise delivery while an app is terminated unless the actual platform scheduling mechanism supports it.

## 10.4 Scheduling Architecture

Separate:

1. User reminder definitions
2. Persisted scheduling intent
3. Device-local scheduled notification state
4. Delivery or interaction history where observable

Do not Cloud-sync transient OS scheduler identifiers as authoritative universal IDs.

Use deterministic reminder identities to prevent duplicate schedules.

## 10.5 Failure Handling

Handle:

- Permission denied
- Device reboot
- App update
- Timezone changes
- Disabled routine
- Deleted Task
- Changed reminder
- OS scheduling restrictions

## 10.6 Tests

Automated tests must validate scheduling logic.

Device-specific timing behavior requires actual platform verification.

---

# SECTION 11 — TODAY'S WORDS

## 11.1 Product Behavior

Show one daily quote during the first app launch of each local day.

The quote must remain stable for that day.

Repeatedly opening Timora on the same day must not automatically rotate it.

Users must be able to disable the first-launch display.

## 11.2 Quote Sources

Use two sources:

1. Bundled Timora quotes
2. User-created quotes

Users can:

- Add
- Edit
- Delete
- Favorite
- Browse
- Select a display mode

## 11.3 Mixed Mode

Default mode:

**Bundled quotes + User quotes**

Provide configurable source preference.

Prevent immediate repeats where sufficient alternatives exist.

Use a deterministic daily selection strategy or persist the selected result.

## 11.4 Copyright

Do not populate bundled quotes with unlicensed long passages or song lyrics.

Use original, appropriately licensed, or public-domain text with correct attribution where necessary.

## 11.5 Data Model

Separate:

- Bundled quote catalog
- User-owned quotes
- User settings
- Daily quote selection history

Bundled content must not require unnecessary Cloud write operations.

## 11.6 UI

Implement:

- First-launch quote dialog/card
- Today quote section
- Quote management
- Favorite action
- Enable/disable setting

The first-launch experience must never prevent access to the main app.

## 11.7 Tests

Cover:

- First launch of day
- Second launch of same day
- Date transition
- Offline use
- User quote deletion
- Empty quote collection
- Mixed mode
- Timezone changes
- App restart

---

# SECTION 12 — GITHUB INTEGRATION

## 12.1 Scope

Implement user-authorized GitHub integration.

Initial capabilities:

- Connect GitHub account
- View authorized repositories
- View Issues
- Link repository or Issue to Timora Project
- Link Issue to Task
- Open GitHub objects in external browser
- Refresh connected metadata
- Disconnect account

Avoid requiring GitHub integration for ordinary Timora usage.

## 12.2 Authentication

Evaluate GitHub App or OAuth integration based on actual required permissions.

Use least privilege.

Never embed GitHub client secrets in distributable applications.

Never store access tokens in unencrypted SQLite or localStorage.

Use the existing native secure credential architecture where applicable.

## 12.3 Authorization and Privacy

Do not automatically:

- Modify repositories
- Close Issues
- Push commits
- Merge PRs
- Delete remote objects

without explicit user actions and sufficient permissions.

Repository/Issue read integration should operate with minimal permissions.

## 12.4 Data Model

Store references such as:

- Provider
- Remote repository ID
- Remote Issue ID
- Remote URL
- Display name
- Cached metadata timestamp

Avoid unnecessarily duplicating entire remote repositories into Timora's database.

## 12.5 Offline Behavior

Cached GitHub references should remain visible offline.

Clearly mark stale data.

GitHub network failures must not block Tasks or Notes.

## 12.6 Tests

Cover:

- Successful connection
- Expired token
- Revoked access
- Repository access removed
- Rate limiting
- Offline access
- Disconnect
- Account isolation
- URL validation
- Task/Issue linking

---

# SECTION 13 — OBJECT RELATIONS

## 13.1 Relation System

Extend the existing `ObjectRelation` concept.

Support relationships among:

- Tasks
- Notes
- Projects
- Events
- Library items

Link additional new entities only when the UX and ownership rules are explicit.

## 13.2 Relation Types

Support:

- References
- Belongs to
- Depends on

Maintain a consistent direction and meaning.

## 13.3 Backlinks

When an object references another object, allow the destination object to display an incoming reference.

Example:

```text
Note A → Task B

Task B:
Referenced by Note A
```

## 13.4 Integrity

Prevent:

- Cross-account references
- Invalid object kinds
- Missing object IDs
- Unauthorized relationship creation
- Duplicate relations

Define deletion behavior explicitly.

## 13.5 Dependency Safety

For `depends_on`, detect cycles if dependencies imply an acyclic workflow.

Do not assume that all kinds of references must be acyclic.

## 13.6 Relation UI

Provide:

- Add relation
- Remove relation
- Search target
- Incoming links
- Outgoing links
- Related object navigation

A full graph visualization is optional unless it is feasible without compromising the core relation system.

## 13.7 Tests

Cover:

- Cross-entity linking
- Backlinks
- Duplicate prevention
- Missing target
- Deleted target
- Offline creation
- Two-device synchronization
- Authorization

---

# SECTION 14 — BACKUP, RESTORE, AND SECURITY

## 14.1 Backup

Inspect the current backup foundation before extending it.

Implement a user-facing workflow for:

- Creating a backup
- Inspecting backup metadata
- Validating backup integrity
- Restoring backup content
- Recovering after failed restore

Preserve SQLite and locally owned media.

Use SQLite-consistent snapshots.

Do not simply copy a live WAL database file without a correct consistency strategy.

## 14.2 Restore

Restore must be staged and validated.

Use an atomic transition or safely reversible process.

Do not overwrite the active workspace before integrity checks pass.

Avoid automatically pushing stale restored records into Cloud.

## 14.3 Security Audit

Review:

- Tauri capabilities
- Filesystem access
- SQLite commands
- Markdown rendering
- External URL handling
- OAuth
- RLS
- Private Storage
- Update signature verification
- Secrets in CI
- Logging
- Native IPC authorization

## 14.4 Long-Term Sync Retention

Define policy for:

- Tombstones
- Sync receipts
- Long-offline devices
- Cursor expiration
- Recovery snapshots
- Duplicate replay protection

Do not implement destructive garbage collection without a proven recovery protocol.

---

# SECTION 15 — PERFORMANCE AND ACCESSIBILITY

## 15.1 Performance

Review performance on realistically large datasets.

Test at multiple scales, for example:

- 100 objects
- 1,000 objects
- 10,000 objects

Use synthetic test records.

Measure:

- App launch
- Initial workspace load
- Search
- Calendar rendering
- Task grouping
- Kanban scrolling
- Sync processing
- Memory growth

Investigate pagination, virtualization, and SQLite indexes or FTS when justified by measurements.

Do not introduce broad architectural changes without benchmarks.

## 15.2 Accessibility

Improve:

- Keyboard navigation
- Focus behavior
- Dialog semantics
- Screen reader labels
- Touch target sizes
- Text scaling
- Color contrast
- Reduced-motion behavior
- Error messaging

## 15.3 Mobile UX

Test:

- Narrow phone displays
- Tablet portrait
- Tablet landscape
- Android back navigation
- Korean IME
- On-screen keyboard
- Bottom navigation
- Modal stacking
- Drag interactions
- Screen rotation

Ensure a touch cannot accidentally trigger multiple overlapping controls.

## 15.4 Windows UX

Test:

- Resizable windows
- Keyboard shortcuts
- Native file dialogs
- Korean input
- Focus transitions
- Window restore
- Installer launch
- Offline startup

Do not sacrifice native responsiveness merely to preserve a desktop-style layout on mobile.

---

# SECTION 16 — DISTRIBUTION AND UPDATE SYSTEM

## 16.1 Windows

Produce a verified Windows installer.

Required target:

```text
Timora-v0.4.0-Windows-x64.zip
|
+-- Timora-setup.exe
+-- README.txt
+-- checksums.txt
```

Reuse the existing NSIS configuration where possible.

Validate:

- Installation
- App launch
- Reinstallation
- Upgrade
- User data preservation
- Uninstallation behavior
- WebView2 handling

## 16.2 Android

Produce a properly signed ARM64 APK when release signing credentials are available.

Do not publish a debug-signed package as a final production release.

Preserve existing package identity or provide a safe documented migration pathway.

Never ask the user to delete the existing app before checking data migration options.

## 16.3 Update Center

Implement or complete:

- Latest GitHub Release detection
- Version comparison
- Release notes
- Download progress
- User approval
- Artifact verification
- Platform-appropriate installation

For Windows, evaluate the official Tauri updater.

For Android, use the platform-supported installer flow and retain user confirmation.

## 16.4 Signing

Use stable signing identities.

Signing secrets belong in protected configuration, not source control.

Fail safely when release signing is unavailable.

## 16.5 CI/CD

Implement or improve:

- Web checks
- Type checking
- Unit tests
- SQLite integration tests
- PostgreSQL/RLS tests
- Android build
- Android emulator tests
- Windows build
- Installer verification
- Release manifest generation
- Artifact checksum generation
- Signing verification

Do not auto-publish production releases.

Prepare an auditable Release Candidate.

---

# SECTION 17 — VALIDATION STRATEGY

## 17.1 Test Levels

Separate:

1. Unit tests
2. Database tests
3. Integration tests
4. Browser/UI tests
5. Platform build tests
6. Emulator tests
7. Real device tests
8. Release verification

A passing unit test does not count as a real-device acceptance test.

## 17.2 Required Integration Scenarios

At minimum test:

- Subtask completed offline, synchronized online
- Recurrent Task completed on two devices
- Calendar event moved on one device, received on another
- Note autosave followed by forced restart
- Kanban movement followed by Sync conflict
- Library attachment upload interrupted and retried
- Routine completion during offline mode
- Notification rescheduled after routine edit
- Daily quote persistence after restart
- GitHub token revoked while offline work continues
- Object relation deleted on a different device
- Backup restored from an earlier schema
- Existing v0.3.1 local database upgraded to v0.4
- Existing Android package upgraded with preserved data
- Windows installer upgraded without deleting local records

## 17.3 Failure Injection

Test:

- Network disconnection
- Delayed server response
- Lost acknowledgment
- Duplicate operation
- Process termination
- Invalid database input
- Corrupt attachment
- Invalid backup
- Expired credentials
- Schema mismatch
- Concurrent edits

## 17.4 Release Gate

v0.4 is not ready for stable release until:

- Required features are implemented
- Automated tests pass
- Data migration is verified
- No unresolved critical data-loss bug exists
- Cloud owner isolation is verified
- Windows installer is tested
- Android update/data preservation is tested
- Documentation matches the final build
- Relevant manual acceptance checks are completed

Use `BLOCKED` or `PENDING` for unverified acceptance items.

---

# SECTION 18 — PHASED IMPLEMENTATION ORDER

Execute the project in the following order.

### Phase 0 — Repository Audit and Baseline

- Verify current code
- Review open Issues and PRs
- Identify implemented versus missing features
- Establish requirement matrix
- Update proposed roadmap
- Define architecture and migration plan

Deliverable: verified implementation baseline.

### Phase 1 — Data Foundation

- New domain models
- SQLite migrations
- Cloud migration scripts
- RLS
- Sync protocol evolution
- Backup compatibility tests

Deliverable: stable and tested persistence foundation.

### Phase 2 — Tasks and Routines

- Subtasks
- Recurrence engine
- Occurrence history
- Daily Routine system
- Today integration

Deliverable: working task/routine workflows.

### Phase 3 — Calendar and Notes

- Calendar 2.0
- Time blocks
- Notes autosave
- Tags
- Templates
- Search improvements

Deliverable: integrated planning and note-taking system.

### Phase 4 — Projects and Library

- Kanban
- Project progress
- Local attachment storage
- File metadata
- Cloud attachment transport

Deliverable: project and resource workflows.

### Phase 5 — Relations and GitHub

- Object relation model
- Backlinks
- GitHub authentication
- Repository/Issue linking
- Offline cached metadata

Deliverable: connected workspace system.

### Phase 6 — Quotes and Notifications

- Daily quote selection
- User quote management
- Mixed quote catalog
- Notification definitions
- Android/Windows scheduler integration

Deliverable: daily engagement tools.

### Phase 7 — Security and Optimization

- Backup/Restore completion
- Security audit
- Large-data performance
- Android/Tablet UX
- Windows UX
- Accessibility
- Cross-version Sync compatibility

Deliverable: production-quality candidate.

### Phase 8 — Release Engineering

- Windows setup.exe
- Windows ZIP
- Android signed APK
- Update Center
- Installer tests
- Migration tests
- Documentation
- Final integration PR

Deliverable: v0.4.0 Release Candidate.

---

# SECTION 19 — WORK EXECUTION RULES

For every Phase:

1. Inspect relevant existing code.
2. Identify exact files to change.
3. Implement required logic.
4. Add database migrations if necessary.
5. Update synchronization contracts.
6. Implement or update UI.
7. Add unit and integration tests.
8. Run tests.
9. Fix observed failures.
10. Record evidence.
11. Commit changes.
12. Update requirement matrix.
13. Continue to the next phase.

Do not stop after producing a design document.

Do not omit implementation because the task is large.

If execution context or tool availability prevents continuing, commit verified work and provide a precise resume checkpoint.

Do not pretend to continue running in the background.

Do not sacrifice data safety merely to mark more items complete.

Avoid unnecessary rewrites or framework migrations.

---

# SECTION 20 — FINAL REPORT FORMAT

At the end of the execution, report:

### 1. Repository baseline
- Starting commit
- Existing architecture
- Existing completed functionality

### 2. Requirements matrix
- Completed
- Partially completed
- Blocked
- Not started

### 3. Implemented functionality
- Feature descriptions
- Key files
- Data model changes

### 4. Database
- SQLite migrations
- PostgreSQL migrations
- RLS
- Backward compatibility

### 5. Synchronization
- New entities
- Retry behavior
- Conflict handling
- Cross-device results

### 6. Security
- Authentication
- Permissions
- Token handling
- File safety

### 7. Tests
- Commands run
- Passed tests
- Failed tests
- Tests not run
- Real device status

### 8. Artifacts
- Windows installer
- ZIP
- Android APK
- Checksums
- Signing status

### 9. GitHub
- Working branch
- Commits
- Pull requests
- CI results

### 10. Release readiness
- PASS
- PENDING
- BLOCKED

### 11. Remaining work
- Exact missing steps
- External prerequisites
- Manual verification requirements

Do not claim v0.4.0 is fully complete if any mandatory release gate remains unverified.

---

# SECTION 21 — FINAL ENGINEERING DIRECTIVE

Develop Timora v0.4.0 as one integrated product milestone.

Include all required functionality described in this specification.

Preserve existing user data, Local-first storage, and core synchronization guarantees.

Use real repository evidence, tests, and build artifacts to establish progress.

Complete as much safe implementation as the connected environment permits.

For any blocked operation, provide a precise explanation and continue independent work.

Keep all code changes reviewable, all database migrations auditable, and all release artifacts verifiable.

Do not merge into `main`, alter production data, or publish the official release without explicit approval.

**Begin with Phase 0 immediately, then execute the remaining phases in dependency order.**