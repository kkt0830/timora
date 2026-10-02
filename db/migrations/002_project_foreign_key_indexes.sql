-- Follow-up for databases bootstrapped before the FK index review.
-- Keeps owner-leading indexes for workspace queries; adds FK-order indexes
-- so PostgreSQL can check linked rows efficiently when a project is deleted.
create index tasks_project_owner_idx on public.tasks (project_id, user_id);
create index notes_project_owner_idx on public.notes (project_id, user_id);
create index events_project_owner_idx on public.events (project_id, user_id);
create index library_items_project_owner_idx on public.library_items (project_id, user_id);
