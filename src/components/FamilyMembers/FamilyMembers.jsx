import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { resolveMediaUrl } from "../../lib/storage";
import "./FamilyMembers.css";
import { useToasts } from "../../lib/useToasts";
import mapStorageError from "../../lib/storageHelpers";

export default function FamilyMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [saving, setSaving] = useState(false);
  const { add: addToast } = useToasts();

  const fetchMembers = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      addToast({ title: "Could not load family members", message: error.message, type: "error" });
    } else {
      const hydrated = await Promise.all(
        (data || []).map(async (member) => {
          const next = { ...member };
          if (next.photo_path) next.photo_url = await resolveMediaUrl(next.photo_path);
          if (next.avatar_path) next.avatar_url = await resolveMediaUrl(next.avatar_path);
          return next;
        }),
      );
      setMembers(hydrated);
    }

    setLoading(false);
  }, [addToast]);

  useEffect(() => {
    // Initial data load intentionally runs after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMembers();
  }, [fetchMembers]);

  async function updateStatus(id, status) {
    setBusy(id + status);

    const { error } = await supabase
      .from("family_members")
      .update({ status })
      .eq("user_id", id);

    if (error) {
      addToast({ title: "Could not update status", message: error.message, type: "error" });
    } else {
      await fetchMembers();
    }

    setBusy(null);
  }

  async function updateRole(id, role) {
    setBusy(id + role);

    const { error } = await supabase
      .from("family_members")
      .update({ role })
      .eq("user_id", id);

    if (error) {
      addToast({ title: "Could not update role", message: error.message, type: "error" });
    } else {
      await fetchMembers();
    }

    setBusy(null);
  }

  function startEditing(member) {
    setEditingMember({
      ...member,
      birth_date: member.birth_date || "",
      death_date: member.death_date || "",
      generation: member.generation || 1,
    });
  }

  function cancelEditing() {
    setEditingMember(null);
  }

  function handleEditChange(event) {
    const { name, value } = event.target;

    setEditingMember((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handlePhotoUpload(event) {
    const file = event.target.files?.[0];

    if (!file || !editingMember) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      alert("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      alert("Please choose an image smaller than 10MB.");
      return;
    }

    setSaving(true);

    try {
      const fileExt = file.name.split(".").pop().toLowerCase();
      const fileName = `${editingMember.user_id}-${Date.now()}.${fileExt}`;
      const filePath = `family-members/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("family-media")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw new Error(mapStorageError(uploadError));
      }

      // For private storage we store the storage path and show a signed URL preview
      const signedUrl = await resolveMediaUrl(filePath);

      setEditingMember((current) => ({
        ...current,
        photo_path: filePath,
        avatar_path: filePath,
        // preview-only signed URL
        photo_url: signedUrl || current.photo_url,
        avatar_url: signedUrl || current.avatar_url,
      }));
    } catch (error) {
      const msg = error.message || "Photo upload failed.";
      try {
        addToast({ title: "Photo upload failed", message: msg, type: "error" });
      } catch (toastError) {
      console.error("Could not show upload error toast", toastError);
    }
    } finally {
      setSaving(false);
      event.target.value = "";
    }
  }

  async function saveMember() {
    if (!editingMember) return;

    setSaving(true);

    const candidateUpdates = {
      full_name: editingMember.full_name || null,
      email: editingMember.email || null,
      relationship: editingMember.relationship || null,
      bio: editingMember.bio || null,
      birth_date: editingMember.birth_date || null,
      death_date: editingMember.death_date || null,
      generation: editingMember.generation ? Number(editingMember.generation) : 1,
      parent_id: editingMember.parent_id || null,
      spouse_id: editingMember.spouse_id || null,
      location: editingMember.location || null,
      photo_path: editingMember.photo_path || null,
      avatar_path: editingMember.avatar_path || null,
    };
    const updates = Object.fromEntries(
      Object.entries(candidateUpdates).filter(([key]) =>
        Object.prototype.hasOwnProperty.call(editingMember, key),
      ),
    );

    const { error } = await supabase
      .from("family_members")
      .update(updates)
      .eq(
        editingMember.user_id ? "user_id" : "id",
        editingMember.user_id ? editingMember.user_id : editingMember.id,
      );

    if (error) {
      const msg = error.message || "Could not save member.";
      try {
        addToast({
          title: "Could not save member",
          message: msg,
          type: "error",
        });
      } catch (toastError) {
      console.error("Could not show upload error toast", toastError);
    }
    } else {
      setEditingMember(null);
      await fetchMembers();
    }

    setSaving(false);
  }

  const filtered = members.filter(
    (member) => filter === "all" || member.status === filter,
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
          {filtered.map((member) => (
            <article className="member-card" key={member.id}>
              <div className="member-card-main">
                {member.photo_url || member.avatar_url ? (
                  <img
                    className="member-avatar"
                    src={member.photo_url || member.avatar_url}
                    alt={member.full_name || "Family member"}
                  />
                ) : (
                  <div className="member-avatar member-avatar-placeholder">
                    {(member.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                )}

                <div>
                  <strong>{member.full_name || "Unnamed"}</strong>

                  <p>{member.email}</p>

                  {member.relationship && <p>{member.relationship}</p>}

                  <div className="member-badges">
                    <span
                      className={`member-badge ${member.status || "pending"}`}
                    >
                      {member.status || "pending"}
                    </span>

                    <span className="member-badge role">
                      {member.role || "member"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="member-actions">
                <button
                  className="edit"
                  disabled={!!busy}
                  onClick={() => startEditing(member)}
                >
                  Edit
                </button>

                {member.status !== "approved" && (
                  <button
                    className="approve"
                    disabled={!!busy}
                    onClick={() => updateStatus(member.user_id, "approved")}
                  >
                    Approve
                  </button>
                )}

                {member.status !== "rejected" && (
                  <button
                    className="reject"
                    disabled={!!busy}
                    onClick={() => updateStatus(member.user_id, "rejected")}
                  >
                    Reject
                  </button>
                )}

                {member.status === "approved" && member.role !== "admin" && (
                  <button
                    className="admin"
                    disabled={!!busy}
                    onClick={() => updateRole(member.user_id, "admin")}
                  >
                    Make Admin
                  </button>
                )}

                {member.role === "admin" && (
                  <button
                    className="demote"
                    disabled={!!busy}
                    onClick={() => updateRole(member.user_id, "member")}
                  >
                    Demote
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editingMember && (
        <div className="member-modal-backdrop">
          <div className="member-modal">
            <div className="member-modal-header">
              <div>
                <span className="eyebrow">EDIT MEMBER</span>
                <h2>{editingMember.full_name || "Family Member"}</h2>
              </div>

              <button
                className="modal-close"
                onClick={cancelEditing}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="member-photo-editor">
              {editingMember.photo_url || editingMember.avatar_url ? (
                <img
                  src={editingMember.photo_url || editingMember.avatar_url}
                  alt={editingMember.full_name || "Family member"}
                />
              ) : (
                <div className="member-photo-placeholder">
                  {(editingMember.full_name || "?").charAt(0).toUpperCase()}
                </div>
              )}

              <label className="photo-upload-button">
                {saving ? "Uploading…" : "Upload Photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                  disabled={saving}
                  hidden
                />
              </label>
            </div>

            <div className="member-form-grid">
              <label>
                Full name
                <input
                  name="full_name"
                  value={editingMember.full_name || ""}
                  onChange={handleEditChange}
                />
              </label>

              <label>
                Email
                <input
                  name="email"
                  type="email"
                  value={editingMember.email || ""}
                  onChange={handleEditChange}
                />
              </label>

              <label>
                Relationship
                <input
                  name="relationship"
                  value={editingMember.relationship || ""}
                  onChange={handleEditChange}
                  placeholder="Mother, Father, Sister..."
                />
              </label>

              <label>
                Location
                <input
                  name="location"
                  value={editingMember.location || ""}
                  onChange={handleEditChange}
                />
              </label>

              <label>
                Birth date
                <input
                  name="birth_date"
                  type="date"
                  value={editingMember.birth_date || ""}
                  onChange={handleEditChange}
                />
              </label>

              <label>
                Death date
                <input
                  name="death_date"
                  type="date"
                  value={editingMember.death_date || ""}
                  onChange={handleEditChange}
                />
              </label>

              <label>
                Generation
                <input
                  name="generation"
                  type="number"
                  min="1"
                  value={editingMember.generation || 1}
                  onChange={handleEditChange}
                />
              </label>

              <label>
                Parent ID
                <input
                  name="parent_id"
                  value={editingMember.parent_id || ""}
                  onChange={handleEditChange}
                />
              </label>

              <label>
                Spouse ID
                <input
                  name="spouse_id"
                  value={editingMember.spouse_id || ""}
                  onChange={handleEditChange}
                />
              </label>

              <label className="member-form-full">
                Short biography
                <textarea
                  name="bio"
                  value={editingMember.bio || ""}
                  onChange={handleEditChange}
                  rows="4"
                  placeholder="Tell us a little about this family member..."
                />
              </label>
            </div>

            <div className="member-modal-actions">
              <button
                className="cancel"
                onClick={cancelEditing}
                disabled={saving}
              >
                Cancel
              </button>

              <button className="save" onClick={saveMember} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
