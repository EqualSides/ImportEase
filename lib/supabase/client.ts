import { createClient } from "@supabase/supabase-js";

// This is the publishable/anon key — it's designed to be embedded in
// client bundles (same as any other client-side app talking to
// Supabase); access control is enforced by Row Level Security policies
// in the database, not by keeping this value secret.
const SUPABASE_URL = "https://kuriwvudktwrkexhrkwr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Mi3Eaf_TBKuC8KGeRbdFAw_Ca9d_fER";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Accounts are shared per customer company (one username/password per
// subscriber, provisioned by us — no self-service signup), so the UI
// asks for a "Username" rather than an email. Supabase Auth's password
// grant still requires an email-shaped identifier under the hood, so
// usernames are mapped into a synthetic address in a reserved domain we
// don't otherwise use for mail.
const USERNAME_EMAIL_DOMAIN = "accounts.theperpetualhive.com";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
