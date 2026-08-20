"use client";

import { useState, type FormEvent } from "react";
import { ADMIN_EMAIL, checkSubscriptionStatus, supabase, usernameToEmail } from "@/lib/supabase/client";

interface AuthModalProps {
  onClose: () => void;
  onSignedIn: () => void;
}

type Tab = "signIn" | "requestAccess";

export default function AuthModal({ onClose, onSignedIn }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>("signIn");

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="auth-modal-tabs">
          <button
            className={tab === "signIn" ? "auth-tab active" : "auth-tab"}
            onClick={() => setTab("signIn")}
          >
            Sign In
          </button>
          <button
            className={tab === "requestAccess" ? "auth-tab active" : "auth-tab"}
            onClick={() => setTab("requestAccess")}
          >
            Sign Up
          </button>
        </div>
        {tab === "signIn" ? (
          <SignInForm onSignedIn={onSignedIn} />
        ) : (
          <RequestAccessForm onSubmitted={() => setTab("signIn")} />
        )}
      </div>
    </div>
  );
}

function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (signInError) {
      setSubmitting(false);
      setError("Incorrect username or password.");
      return;
    }

    if (signInData.user?.email !== ADMIN_EMAIL) {
      const status = await checkSubscriptionStatus(signInData.user!.id);
      if (status === "expired") {
        await supabase.auth.signOut();
        setSubmitting(false);
        setError("Your subscription has expired. Please contact us to renew.");
        return;
      }
      if (status === "pending") {
        await supabase.auth.signOut();
        setSubmitting(false);
        setError("Your account is pending approval. We'll notify you once access is granted.");
        return;
      }
    }

    setSubmitting(false);
    onSignedIn();
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Username
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <div className="auth-form-error">{error}</div>}
      <button type="submit" className="auth-submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign In"}
      </button>
      <p className="auth-form-hint">
        Don&rsquo;t have an account? Switch to &ldquo;Sign Up&rdquo; above.
      </p>
    </form>
  );
}

// Creates the account immediately (with the username/password the
// visitor picks) but it's locked out until an admin renews it — see
// checkSubscriptionStatus's "pending" state and the self-signup Edge
// Function's approved=false insert.
function RequestAccessForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // The company name doubles as the username — shared per-company
  // accounts are always named after the company (byrne, clarkco,
  // fortytwo, …), so there's no separate field for it.
  const username = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || password.length < 4 || !contactName.trim() || !email.trim()) {
      setError("Company name, a password (4+ chars), your name, and email are all required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke("self-signup", {
      body: {
        username,
        password,
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      },
    });
    setSubmitting(false);
    if (fnError || data?.error) {
      setError(data?.error || fnError?.message || "Something went wrong. Please try again.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="auth-form">
        <p className="auth-form-success">
          Your account has been created and is pending approval. We&rsquo;ll notify you once access is
          granted — then sign in with the username and password you just set.
        </p>
        <button type="button" className="auth-submit" onClick={onSubmitted}>
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Company Name
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          autoFocus
        />
      </label>
      <p className="auth-form-hint" style={{ margin: "-8px 0 4px", textAlign: "left" }}>
        This will be your username when logging in{username ? ` (as “${username}”)` : ""}.
      </p>
      <label>
        Password
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label>
        Your Name
        <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} />
      </label>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Phone <span className="auth-form-optional">(optional)</span>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        Message <span className="auth-form-optional">(optional)</span>
        <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {error && <div className="auth-form-error">{error}</div>}
      <button type="submit" className="auth-submit" disabled={submitting}>
        {submitting ? "Creating account…" : "Create Account"}
      </button>
      <p className="auth-form-hint">Your account is created right away, but locked until we grant access.</p>
    </form>
  );
}
