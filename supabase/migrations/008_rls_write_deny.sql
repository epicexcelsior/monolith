-- Defense-in-depth: block all writes from anon/authenticated roles.
-- Server uses service_role (bypasses RLS) — these policies only protect
-- against leaked anon keys or direct client access.

-- blocks
CREATE POLICY blocks_deny_insert ON blocks FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY blocks_deny_update ON blocks FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY blocks_deny_delete ON blocks FOR DELETE TO anon, authenticated USING (false);

-- players
CREATE POLICY players_deny_insert ON players FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY players_deny_update ON players FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY players_deny_delete ON players FOR DELETE TO anon, authenticated USING (false);

-- events
CREATE POLICY events_deny_insert ON events FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY events_deny_update ON events FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY events_deny_delete ON events FOR DELETE TO anon, authenticated USING (false);
