import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import "./FamilyMembers.css";
export default function FamilyMembers() {
  const [members, setMembers] = useState([]),
    [loading, setLoading] = useState(true),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(null);
  useEffect(() => {
    fetchMembers();
  }, []);
  async function fetchMembers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setMembers(data || []);
    setLoading(false);
  }
  async function updateStatus(id, status) {
    setBusy(id + status);
    const { error } = await supabase
      .from("family_members")
      .update({ status })
      .eq("user_id", id);
    if (error) alert(error.message);
    else await fetchMembers();
    setBusy(null);
  }
  async function updateRole(id, role) {
    setBusy(id + role);
    const { error } = await supabase
      .from("family_members")
      .update({ role })
      .eq("user_id", id);
    if (error) alert(error.message);
    else await fetchMembers();
    setBusy(null);
  }
  const filtered = members.filter(
    (m) => filter === "all" || m.status === filter,
  );
  return (
    <div className="page family-members-page">
      <div className="family-members-heading">
        <span className="eyebrow">ADMINISTRATION</span>
        <h1>Family Members</h1>
        <p className="subtitle">
          Manage the people who have access to your private family archive.
        </p>
      </div>
      <div className="member-filters">
        {["all", "pending", "approved", "rejected"].map((f) => (
          <button
            className={`member-filter ${filter === f ? "active" : ""}`}
            key={f}
            onClick={() => setFilter(f)}
          >
            {f}{" "}
            <span>
              {f === "all"
                ? members.length
                : members.filter((m) => m.status === f).length}
            </span>
          </button>
        ))}
      </div>
      {loading ? (
        <div className="members-message">Loading members…</div>
      ) : !filtered.length ? (
        <div className="members-message">No members found.</div>
      ) : (
        <div className="member-list">
          {filtered.map((m) => (
            <article className="member-card" key={m.user_id}>
              <div>
                <strong>{m.full_name || "Unnamed"}</strong>
                <p>{m.email}</p>
                <div className="member-badges">
                  <span className={`member-badge ${m.status}`}>
                    {m.status || "pending"}
                  </span>
                  <span className="member-badge role">
                    {m.role || "member"}
                  </span>
                </div>
              </div>
              <div className="member-actions">
                {m.status !== "approved" && (
                  <button
                    className="approve"
                    disabled={!!busy}
                    onClick={() => updateStatus(m.user_id, "approved")}
                  >
                    Approve
                  </button>
                )}
                {m.status !== "rejected" && (
                  <button
                    className="reject"
                    disabled={!!busy}
                    onClick={() => updateStatus(m.user_id, "rejected")}
                  >
                    Reject
                  </button>
                )}
                {m.status === "approved" && m.role !== "admin" && (
                  <button
                    className="admin"
                    disabled={!!busy}
                    onClick={() => updateRole(m.user_id, "admin")}
                  >
                    Make Admin
                  </button>
                )}
                {m.role === "admin" && (
                  <button
                    className="demote"
                    disabled={!!busy}
                    onClick={() => updateRole(m.user_id, "member")}
                  >
                    Demote
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
