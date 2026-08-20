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
export interface SubscriptionDetails {
  status: SubscriptionStatus;
  expiresAt: string | null;
}

// Same query checkSubscriptionStatus needs, but also hands back the raw
// expiry date so the UI can show a signed-in customer their own "expires
// on <date>" without them having to email Daniel to ask.
export async function getSubscriptionDetails(userId: string): Promise<SubscriptionDetails> {
  const { data } = await supabase
    .from("subscriptions")
    .select("expires_at, approved")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { status: "unlimited", expiresAt: null };
  if (!data.approved) return { status: "pending", expiresAt: data.expires_at };
  const status: SubscriptionStatus = new Date(data.expires_at).getTime() > Date.now() ? "active" : "expired";
  return { status, expiresAt: data.expires_at };
}

export async function checkSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  return (await getSubscriptionDetails(userId)).status;
}

// The admin Edge Functions (admin-create-account, admin-list-accounts)
// reject an expired access token with 403 "Forbidden". A stale *access*
// token is recoverable (refresh and retry). If the retry still fails,
// the local refresh token itself is dead (auth logs showed 400 "Refresh
// Token Not Found") — root-caused to every signOut() call in this app
// defaulting to Supabase's global scope, which revokes *every* session
// for the account, not just the current tab. On a shared credential
// signed in from multiple browsers at once (see the scope: "local" on
// every signOut() call below and in AuthModal.tsx/page.tsx), that meant
// one person logging out — or even one blocked sign-in attempt — killed
// everyone else's session too. Now that every signOut() is scoped
// locally, this retry-then-recover path should mostly see genuine
// access-token staleness; it still degrades gracefully (sign out
// locally, ask the user to sign back in) for whatever isn't caught by
// that fix.
export async function invokeAdminFunction<T = any>(
  name: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string } | null }> {
  const first = await supabase.functions.invoke<T>(name, { body });
  const firstFailed = !!first.error || (first.data as any)?.error === "Forbidden";
  if (!firstFailed) return first;

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    await supabase.auth.signOut({ scope: "local" });
    return { data: null, error: { message: "Your session has expired. Please sign in again." } };
  }

  const second = await supabase.functions.invoke<T>(name, { body });
  const secondFailed = !!second.error || (second.data as any)?.error === "Forbidden";
  if (secondFailed) {
    await supabase.auth.signOut({ scope: "local" });
    return { data: null, error: { message: "Your session has expired. Please sign in again." } };
  }
  return second;
}
