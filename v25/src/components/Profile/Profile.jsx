import { useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import "./Profile.css";

export default function Profile({ session, admin, member, onSignOut, initialSection = "profile" }) {
  const initial = useMemo(() => session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || session?.user?.email?.split("@")[0] || "Family", [session]);
  const [name, setName] = useState(initial);
  const [photoUrl, setPhotoUrl] = useState(session?.user?.user_metadata?.avatar_url || "");
  const [section, setSection] = useState(initialSection);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState({ activity: true, reminders: true, comments: true });

  const initials = name.split(" ").filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase();

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true); setMessage("");
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim(), avatar_url: photoUrl.trim() || null } });
    setSaving(false);
    setMessage(error ? error.message : "Profile updated.");
  }

  return <div className="page profile-page">
    <header className="profile-header"><span className="eyebrow">YOUR PLACE IN THE ARCHIVE</span><h1>Profile</h1><p>Keep your family archive identity and preferences close at hand.</p></header>
    <div className="profile-layout">
      <aside className="profile-card profile-summary">
        <div className="profile-avatar">{photoUrl ? <img src={photoUrl} alt={name} /> : initials}</div>
        <h2>{name}</h2><p>{admin ? "Administrator" : member?.role || "Family member"}</p><span>{session?.user?.email}</span>
        <div className="profile-menu">{[["profile","Profile"],["account","Account settings"],["notifications","Notification settings"],["help","Help & support"]].map(([id,label]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label}</button>)}</div>
        <button className="profile-signout" onClick={onSignOut}>Sign out</button>
      </aside>

      <section className="profile-card profile-content">
        {section === "profile" && <form onSubmit={saveProfile}><span className="eyebrow">PROFILE</span><h2>Your family identity</h2><p className="profile-muted">This information is stored with your signed-in account.</p><label>Display name<input value={name} onChange={(e) => setName(e.target.value)} /></label><label>Profile photo URL<input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="Optional image URL" /></label><div className="profile-preview"><div className="profile-avatar small">{photoUrl ? <img src={photoUrl} alt="Preview" /> : initials}</div><span>Simple circular family photo</span></div><button className="profile-save" disabled={saving}>{saving ? "Saving..." : "Save profile"}</button>{message && <p className="profile-message">{message}</p>}</form>}
        {section === "account" && <div><span className="eyebrow">ACCOUNT</span><h2>Account settings</h2><div className="setting-row"><div><strong>Email</strong><p>{session?.user?.email}</p></div><span>Managed by authentication</span></div><div className="setting-row"><div><strong>Family role</strong><p>{admin ? "Administrator" : member?.role || "Member"}</p></div><span>{member?.status || "approved"}</span></div></div>}
        {section === "notifications" && <div><span className="eyebrow">NOTIFICATIONS</span><h2>Notification settings</h2>{[["activity","Family activity"],["reminders","Milestone reminders"],["comments","Comments and replies"]].map(([key,label]) => <label className="toggle-row" key={key}><span><strong>{label}</strong><small>Keep me updated when this changes.</small></span><input type="checkbox" checked={notifications[key]} onChange={(e) => setNotifications({...notifications,[key]:e.target.checked})} /></label>)}</div>}
        {section === "help" && <div><span className="eyebrow">SUPPORT</span><h2>Help & support</h2><div className="help-card"><strong>Need a hand?</strong><p>Family Archive keeps the important parts simple: memories, stories, ancestry and the plans you are building together.</p><p>For account or family-access problems, contact the family administrator.</p></div></div>}
      </section>
    </div>
  </div>;
}
