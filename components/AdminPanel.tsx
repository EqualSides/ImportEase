"use client";

import { useEffect, useState } from "react";
import { supabase, invokeAdminFunction, type AccessRequestRow } from "@/lib/supabase/client";

interface AdminPanelProps {
  onClose: () => void;
}

type Tab = "requests" | "accounts";

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<AccessRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("access_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!showAll) query = query.eq("status", "new");
    const { data } = await query;
    setRequests((data as AccessRequestRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (tab === "requests") load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll, tab]);

  const reject = async (id: string) => {
    await supabase.from("access_requests").update({ status: "rejected" }).eq("id", id);
    load();
  };

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal admin-panel" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="auth-modal-tabs">
          <button
            className={tab === "requests" ? "auth-tab active" : "auth-tab"}
            onClick={() => setTab("requests")}
          >
            Access Requests
          </button>
          <button
            className={tab === "accounts" ? "auth-tab active" : "auth-tab"}
            onClick={() => setTab("accounts")}
          >
            Accounts
          </button>
        </div>
        {tab === "requests" ? (
          <>
            <div className="admin-panel-header">
              <label className="admin-panel-toggle">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                Show all (incl. handled)
              </label>
            </div>
            {loading ? (
              <p className="auth-form-hint">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="auth-form-hint">{showAll ? "No requests yet." : "No pending requests."}</p>
            ) : (
              <div className="admin-request-list">
                {requests.map((r) => (
                  <RequestRow key={r.id} request={r} onHandled={load} onReject={() => reject(r.id)} />
                ))}
              </div>
            )}
          </>
        ) : (
          <AccountsTab />
        )}
      </div>
    </div>
  );
}

interface AccountRow {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  expires_at: string | null;
  approved: boolean;
}

function expiryLabel(expiresAt: string | null): { text: string; className: string } {
  if (!expiresAt) return { text: "No expiration (test account)", className: "" };
  const date = new Date(expiresAt);
  const daysLeft = (date.getTime() - Date.now()) / 86_400_000;
  const text = `${daysLeft < 0 ? "Expired" : "Expires"} ${date.toLocaleDateString()}`;
  if (daysLeft < 0) return { text, className: "expiry-expired" };
  if (daysLeft < 30) return { text, className: "expiry-soon" };
  return { text, className: "" };
}

function AccountsTab() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [bulkExpiring, setBulkExpiring] = useState(false);

  const load = async () => {
    setLoading(true);
    setListError(null);
    const { data, error } = await invokeAdminFunction("admin-list-accounts", {});
    setLoading(false);
    if (error || data?.error) {
      setListError(data?.error || error?.message || "Failed to load accounts.");
      return;
    }
    setAccounts(data.accounts ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  // Test accounts have no subscriptions row at all, so they read as "no
  // expiration" rather than "expired" or "active" (see
  // checkSubscriptionStatus in lib/supabase/client.ts). Going live means
  // every one of those needs an actual expiration date — this is the
  // one-click way to force that instead of clicking "Force Expire" on
  // each account individually and risking missing one.
  const testAccounts = accounts.filter((a) => !a.expires_at);

  const forceExpireAll = async () => {
    if (
      !confirm(
        `Force-expire all ${testAccounts.length} test account(s) (${testAccounts
          .map((a) => a.email.split("@")[0])
          .join(", ")})? This immediately blocks their sign-in.`
      )
    ) {
      return;
    }
    setBulkExpiring(true);
    for (const a of testAccounts) {
      await invokeAdminFunction("admin-create-account", {
        username: a.email.split("@")[0],
        action: "forceExpire",
      });
    }
    setBulkExpiring(false);
    load();
  };

  if (loading) return <p className="auth-form-hint">Loading…</p>;
  if (listError) return <div className="auth-form-error">{listError}</div>;

  return (
    <div className="admin-request-list">
      {testAccounts.length > 0 && (
        <div className="admin-panel-header">
          <button className="btn btn-danger" disabled={bulkExpiring} onClick={forceExpireAll}>
            {bulkExpiring
              ? "Expiring…"
              : `Force Expire All Test Accounts (${testAccounts.length})`}
          </button>
        </div>
      )}
      {accounts.map((a) => (
        <AccountRowItem key={a.id} account={a} onChanged={load} />
      ))}
    </div>
  );
}

function AccountRowItem({ account, onChanged }: { account: AccountRow; onChanged: () => void }) {
  const username = account.email.split("@")[0];
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const expiry = expiryLabel(account.expires_at);

  const resetPassword = async () => {
    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }
    setSubmitting("reset");
    setError(null);
    const { data, error: fnError } = await invokeAdminFunction("admin-create-account", {
      username,
      password: newPassword,
      action: "reset",
    });
    setSubmitting(null);
    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || "Something went wrong.");
      return;
    }
    setDone(true);
    setNewPassword("");
  };

  const renew = async (period: "half" | "year") => {
    setSubmitting(period);
    setError(null);
    const { data, error: fnError } = await invokeAdminFunction("admin-create-account", {
      username,
      action: "renew",
      period,
    });
    setSubmitting(null);
    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || "Something went wrong.");
      return;
    }
    onChanged();
  };

  const forceExpire = async () => {
    if (!confirm(`Force-expire "${username}" immediately?`)) return;
    setSubmitting("forceExpire");
    setError(null);
    const { data, error: fnError } = await invokeAdminFunction("admin-create-account", {
      username,
      action: "forceExpire",
    });
    setSubmitting(null);
    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || "Something went wrong.");
      return;
    }
    onChanged();
  };

  return (
    <div className="admin-request-row">
      <div className="admin-request-info">
        <div className="admin-request-company">{username}</div>
        <div className="admin-request-meta">
          Created {new Date(account.created_at).toLocaleDateString()} &middot; Last sign-in{" "}
          {account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleString() : "never"}
        </div>
        <div className={`admin-request-meta ${expiry.className}`}>{expiry.text}</div>
        {!account.approved && <div className="admin-request-meta expiry-soon">Pending approval</div>}
      </div>
      <div className="admin-request-actions">
        <button className="btn" disabled={!!submitting} onClick={() => renew("half")}>
          {submitting === "half" ? "…" : "Renew +6mo"}
        </button>
        <button className="btn" disabled={!!submitting} onClick={() => renew("year")}>
          {submitting === "year" ? "…" : "Renew +1yr"}
        </button>
        <button className="btn btn-danger" disabled={!!submitting} onClick={forceExpire}>
          {submitting === "forceExpire" ? "…" : "Force Expire"}
        </button>
      </div>
      <div className="admin-request-actions">
        <input
          type="text"
          placeholder="new password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value);
            setDone(false);
          }}
        />
        <button className="auth-submit" disabled={!!submitting} onClick={resetPassword}>
          {submitting === "reset" ? "Resetting…" : "Reset Password"}
        </button>
        {done && <span className="auth-form-success">Password updated.</span>}
      </div>
      {error && <div className="auth-form-error">{error}</div>}
    </div>
  );
}

function RequestRow({
  request,
  onHandled,
  onReject,
}: {
  request: AccessRequestRow;
  onHandled: () => void;
  onReject: () => void;
}) {
  const isNew = request.status === "new";
  // Self-signup rows already have a real (locked) account — user_id is
  // set by the self-signup Edge Function. Older rows from before
  // self-signup existed have no account yet and still need one created
  // manually.
  const isSelfSignup = !!request.user_id;

  return (
    <div className="admin-request-row">
      <div className="admin-request-info">
        <div className="admin-request-company">{request.company_name}</div>
        <div className="admin-request-meta">
          {request.contact_name} &middot; {request.email}
          {request.phone ? ` · ${request.phone}` : ""}
        </div>
        {request.message && <div className="admin-request-message">&ldquo;{request.message}&rdquo;</div>}
        <div className="admin-request-meta">
          Status: <strong>{request.status}</strong> &middot;{" "}
          {new Date(request.created_at).toLocaleString()}
        </div>
      </div>
      {isNew &&
        (isSelfSignup ? (
          <ApproveDenyActions request={request} onHandled={onHandled} onReject={onReject} />
        ) : (
          <LegacyCreateAccountActions request={request} onHandled={onHandled} onReject={onReject} />
        ))}
    </div>
  );
}

function ApproveDenyActions({
  request,
  onHandled,
  onReject,
}: {
  request: AccessRequestRow;
  onHandled: () => void;
  onReject: () => void;
}) {
  const [period, setPeriod] = useState<"half" | "year">("half");
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setSubmitting("approve");
    setError(null);
    const { data, error: fnError } = await invokeAdminFunction("admin-create-account", {
      userId: request.user_id,
      action: "renew",
      period,
      requestId: request.id,
    });
    setSubmitting(null);
    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || "Something went wrong.");
      return;
    }
    onHandled();
  };

  const deny = async () => {
    setSubmitting("deny");
    await onReject();
    setSubmitting(null);
  };

  return (
    <div className="admin-request-actions">
      <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
        <option value="half">Paid: this half</option>
        <option value="year">Paid: full year</option>
      </select>
      <button className="auth-submit" disabled={!!submitting} onClick={approve}>
        {submitting === "approve" ? "Approving…" : "Approve"}
      </button>
      <button className="btn btn-danger" disabled={!!submitting} onClick={deny}>
        {submitting === "deny" ? "Denying…" : "Deny"}
      </button>
      {error && <div className="auth-form-error">{error}</div>}
    </div>
  );
}

function LegacyCreateAccountActions({
  request,
  onHandled,
  onReject,
}: {
  request: AccessRequestRow;
  onHandled: () => void;
  onReject: () => void;
}) {
  const [username, setUsername] = useState(
    request.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24)
  );
  const [password, setPassword] = useState("");
  const [expiryOption, setExpiryOption] = useState<"none" | "half" | "year">("half");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAccount = async () => {
    if (!username.trim() || password.length < 4) {
      setError("Username and a password of at least 4 characters are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error: fnError } = await invokeAdminFunction("admin-create-account", {
      username,
      password,
      requestId: request.id,
      expiryOption,
    });
    setSubmitting(false);
    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || "Something went wrong.");
      return;
    }
    onHandled();
  };

  return (
    <div className="admin-request-actions">
      <input
        type="text"
        placeholder="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="text"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <select value={expiryOption} onChange={(e) => setExpiryOption(e.target.value as typeof expiryOption)}>
        <option value="half">Paid: this half</option>
        <option value="year">Paid: full year</option>
        <option value="none">No expiration (test)</option>
      </select>
      <button className="auth-submit" disabled={submitting} onClick={createAccount}>
        {submitting ? "Creating…" : "Create Account"}
      </button>
      <button className="btn btn-danger" onClick={onReject} disabled={submitting}>
        Reject
      </button>
      {error && <div className="auth-form-error">{error}</div>}
    </div>
  );
}
