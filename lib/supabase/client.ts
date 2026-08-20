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

// Only this account sees the admin panel and can call the
// admin-create-account Edge Function — enforced again server-side there
// against the caller's own verified session, this is just what the UI
// checks to decide whether to show the panel at all.
export const ADMIN_EMAIL = "daniel@accounts.theperpetualhive.com";

export interface AccessRequestRow {
  id: string;
  created_at: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  user_id: string | null;
}

export type SubscriptionStatus = "active" | "expired" | "pending" | "unlimited";

// Test/trial accounts (the ones provisioned before subscription
// enforcement went live) have no row in `subscriptions` at all — those
// stay "unlimited" (never blocked) until an admin explicitly renews or
// force-expires them from the Accounts tab. Self-signup accounts always
// get a row with approved=false ("pending") until an admin renews them,
// which is also how access gets granted. The admin account itself is
// always exempt regardless of any row, checked by the caller before
// calling this.
export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  const { data } = await supabase
    .from("subscriptions")
    .select("expires_at, approved")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return "unlimited";
  if (!data.approved) return "pending";
  return new Date(data.expires_at).getTime() > Date.now() ? "active" : "expired";
}

// The admin Edge Functions (admin-create-account, admin-list-accounts)
// reject an expired access token with 403 "Forbidden". A stale *access*
// token is recoverable (refresh and retry), but the daniel/admin login
// is a shared credential that gets signed in from multiple browsers/tabs
// at once — and Supabase's refresh-token rotation means the *refresh*
// token itself can go stale too: as soon as one tab uses it, every other
// tab still holding the old value gets a permanent 400 "Refresh Token
// Not Found" on its next refresh, no matter how many times it retries.
// That case isn't self-healable — the local session is just dead — so
// after one retry attempt we sign out locally (clearing the dead
// session so the UI falls back to the sign-in screen) rather than
// looping forever on an error that will never clear itself.
export async function invokeAdminFunction<T = any>(
  name: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string } | null }> {
  const first = await supabase.functions.invoke<T>(name, { body });
  const firstFailed = !!first.error || (first.data as any)?.error === "Forbidden";
  if (!firstFailed) return first;

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    await supabase.auth.signOut();
    return { data: null, error: { message: "Your session has expired. Please sign in again." } };
  }

  const second = await supabase.functions.invoke<T>(name, { body });
  const secondFailed = !!second.error || (second.data as any)?.error === "Forbidden";
  if (secondFailed) {
    await supabase.auth.signOut();
    return { data: null, error: { message: "Your session has expired. Please sign in again." } };
  }
  return second;
}
