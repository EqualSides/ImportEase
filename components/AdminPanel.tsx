"use client";

import { useEffect, useState } from "react";
import { supabase, type AccessRequestRow } from "@/lib/supabase/client";

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

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
        <div className="admin-panel-header">
          <h2>Access Requests</h2>
          <label className="admin-panel-toggle">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Show all (incl. handled)
          </label>
        </div>
        {loading ? (
          <p className="auth-form-hint">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="auth-form-hint">
            {showAll ? "No requests yet." : "No pending requests."}
          </p>
        ) : (
          <div className="admin-request-list">
            {requests.map((r) => (
              <RequestRow key={r.id} request={r} onHandled={load} onReject={() => reject(r.id)} />
            ))}
          </div>
        )}
      </div>
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
  const [username, setUsername] = useState(
    request.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24)
  );
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = request.status === "new";

  const createAccount = async () => {
    if (!username.trim() || password.length < 4) {
      setError("Username and a password of at least 4 characters are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("admin-create-account", {
      body: { username, password, requestId: request.id },
    });
    setSubmitting(false);
    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || "Something went wrong.");
      return;
    }
    onHandled();
  };

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
      {isNew && (
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
          <button className="auth-submit" disabled={submitting} onClick={createAccount}>
            {submitting ? "Creating…" : "Create Account"}
          </button>
          <button className="btn btn-danger" onClick={onReject} disabled={submitting}>
            Reject
          </button>
          {error && <div className="auth-form-error">{error}</div>}
        </div>
      )}
    </div>
  );
}
