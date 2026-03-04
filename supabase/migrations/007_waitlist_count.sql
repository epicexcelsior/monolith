-- RPC function to get waitlist count (callable by anon for landing page)
CREATE OR REPLACE FUNCTION waitlist_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer FROM waitlist;
$$;

-- Allow anon to call the function
GRANT EXECUTE ON FUNCTION waitlist_count() TO anon;
