import { useState } from "react";
import { supabase } from "../supabaseClient";
import "./Auth.css";

function PasswordField({ value, onChange, label = "Password", autoComplete }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="form-group password-field">
      <label htmlFor={`password-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {label}
      </label>
      <div className="password-input-wrap">
        <input
          id={`password-${label.toLowerCase().replace(/\s+/g, "-")}`}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder="At least 6 characters"
          minLength={6}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? "◉" : "◌"}
        </button>
      </div>
    </div>
  );
}

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signup, setSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (signup) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        setMessage(
          `Request received. Check ${email.trim()} for a confirmation link if required.`,
        );
        setType("success");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setMessage("Signing you in…");
        setType("success");
      }
    } catch (error) {
      setMessage(error?.message || "Authentication failed. Please try again.");
      setType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card auth-form-card">
        <div className="auth-brand-mark">♡</div>
        <span className="eyebrow">THE FAMILY ARCHIVE</span>
        <h1>{signup ? "Join the archive." : "Welcome home."}</h1>
        <p className="auth-intro">
          {signup
            ? "Request access to your family’s private collection."
            : "Your family’s photographs, stories and memories, all in one place."}
        </p>
        <form onSubmit={submit}>
          {signup && (
            <div className="form-group">
              <label htmlFor="full-name">Full name</label>
              <input
                id="full-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Jessica"
                autoComplete="name"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <PasswordField
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={signup ? "new-password" : "current-password"}
          />
          {message && <div className={`auth-message ${type}`}>{message}</div>}
          <button className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? "Please wait…" : signup ? "Request access" : "Sign in"}
          </button>
        </form>
        <div className="auth-switch">
          <span>{signup ? "Already have access?" : "New to the archive?"}</span>
          <button
            type="button"
            onClick={() => {
              setSignup((current) => !current);
              setMessage("");
            }}
          >
            {signup ? "Sign in" : "Request access"}
          </button>
        </div>
      </section>
    </main>
  );
}
