import { useState } from "react";
import { supabase } from "../supabaseClient";
import "./Auth.css";
export default function Auth() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [signup, setSignup] = useState(false),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [type, setType] = useState("");
  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    if (signup) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) {
        setMessage(error.message);
        setType("error");
      } else {
        setMessage(
          `Request received. Check ${email} for a confirmation link if required.`,
        );
        setType("success");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(error.message);
        setType("error");
      } else {
        setMessage("Signing you in…");
        setType("success");
      }
    }
    setLoading(false);
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
              <label>Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jessica"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>
          {message && <div className={`auth-message ${type}`}>{message}</div>}
          <button className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? "Please wait…" : signup ? "Request access" : "Sign in"}
          </button>
        </form>
        <div className="auth-switch">
          <span>{signup ? "Already have access?" : "New to the archive?"}</span>
          <button
            onClick={() => {
              setSignup(!signup);
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
