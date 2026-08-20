"use client";

import { useState, type FormEvent } from "react";
import { supabase, usernameToEmail } from "@/lib/supabase/client";

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
            Request Access
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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError("Incorrect username or password.");
      return;
    }
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
        Don&rsquo;t have an account? Switch to &ldquo;Request Access&rdquo; above.
      </p>
    </form>
  );
}

function RequestAccessForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactName.trim() || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    const { error: insertError } = await supabase.from("access_requests").insert({
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      message: message.trim() || null,
    });
    setSubmitting(false);
    if (insertError) {
      setError("Something went wrong submitting your request. Please try again.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="auth-form">
        <p className="auth-form-success">
          Thanks — your request has been received. We&rsquo;ll reach out to set up your account.
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
        <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus />
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
        {submitting ? "Submitting…" : "Request Access"}
      </button>
    </form>
  );
}
