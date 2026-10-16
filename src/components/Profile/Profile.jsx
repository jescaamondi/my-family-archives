import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { resolveMediaUrl, isPublicUrl } from "../../lib/storage";
import "./Profile.css";

export default function Profile({
  session,
  admin,
  member,
  onSignOut,
  initialSection = "profile",
}) {
  const initialName = useMemo(
    () =>
      session?.user?.user_metadata?.full_name ||
      session?.user?.user_metadata?.name ||
      session?.user?.email?.split("@")[0] ||
      "Family",
    [session],
  );

  const [name, setName] = useState(initialName);
  const [summary, setSummary] = useState(
    session?.user?.user_metadata?.bio || "",
  );
  const [photoPath, setPhotoPath] = useState(
    session?.user?.user_metadata?.avatar_url || "",
  );
  const [photoPreview, setPhotoPreview] = useState("");
  const [section, setSection] = useState(initialSection);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadError, setUploadError] = useState("");

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    let active = true;

    async function loadPhoto() {
      if (!photoPath) {
        setPhotoPreview("");
        return;
      }

      if (isPublicUrl(photoPath)) {
        setPhotoPreview(photoPath);
        return;
      }

      const url = await resolveMediaUrl(photoPath);
      if (active) setPhotoPreview(url || "");
    }

    loadPhoto().catch((error) => {
      console.error("Profile photo resolve failed", error);
      if (active) setPhotoPreview("");
    });

    return () => {
      active = false;
    };
  }, [photoPath]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: name.trim(),
        bio: summary.trim().slice(0, 500),
        avatar_url: photoPath || null,
      },
    });

    setSaving(false);
    setMessage(error ? error.message : "Profile updated successfully.");
  }

  async function handleFileSelect(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Please choose an image smaller than 10MB.");
      return;
    }

    if (!session?.user) return;

    setUploading(true);
    setUploadError("");
    setMessage("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `profiles/${session.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadErrorResult } = await supabase.storage
        .from("family-media")
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (uploadErrorResult) throw uploadErrorResult;

      const { error: profileError } = await supabase.auth.updateUser({
        data: { avatar_url: path },
      });

      if (profileError) {
        await supabase.storage.from("family-media").remove([path]);
        throw profileError;
      }

      setPhotoPath(path);
      setMessage("Profile photo uploaded successfully.");
    } catch (error) {
      console.error("Profile photo upload failed", error);
      setUploadError(error?.message || "Profile photo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    if (!session?.user || !photoPath) return;
    setSaving(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: null },
    });

    if (error) {
      setMessage(error.message);
    } else {
      setPhotoPath("");
      setPhotoPreview("");
      setMessage("Profile photo removed.");
    }
    setSaving(false);
  }

  return (
    <div className="page profile-page">
      <header className="profile-header">
        <span className="eyebrow">YOUR PLACE IN THE ARCHIVE</span>
        <h1>Profile</h1>
        <p>Keep your family archive identity and a few words about yourself.</p>
      </header>

      <div className="profile-layout">
        <aside className="profile-card profile-summary">
          <div className="profile-avatar">
            {photoPreview ? (
              <img src={photoPreview} alt={name} />
            ) : (
              initials
            )}
          </div>
          <h2>{name}</h2>
          <p>{admin ? "Administrator" : member?.role || "Family member"}</p>
          <span>{session?.user?.email}</span>
          <div className="profile-menu">
            <button
              className={section === "profile" ? "active" : ""}
              onClick={() => setSection("profile")}
            >
              Profile
            </button>
            <button
              className={section === "account" ? "active" : ""}
              onClick={() => setSection("account")}
            >
              Account settings
            </button>
            <button
              className={section === "help" ? "active" : ""}
              onClick={() => setSection("help")}
            >
              Help & support
            </button>
          </div>
          <button className="profile-signout" onClick={onSignOut}>
            Sign out
          </button>
        </aside>

        <section className="profile-card profile-content">
          {section === "profile" && (
            <form onSubmit={saveProfile}>
              <span className="eyebrow">PROFILE</span>
              <h2>Your family identity</h2>
              <p className="profile-muted">
                Your profile information is stored with your signed-in account.
              </p>

              <label htmlFor="profile-name">
                Display name
                <input
                  id="profile-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={120}
                  required
                />
              </label>

              <div className="profile-upload-block">
                <span className="profile-field-label">Profile photo</span>
                <div className="profile-preview">
                  <div className="profile-avatar small">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Profile preview" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div>
                    <strong>Use a family photo</strong>
                    <small>JPG, PNG or WebP up to 10MB.</small>
                  </div>
                </div>
                <div className="profile-upload-actions">
                  <label className="upload-btn">
                    {uploading ? "Uploading…" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileSelect}
                      disabled={uploading}
                      hidden
                    />
                  </label>
                  {photoPath && (
                    <button
                      type="button"
                      className="remove-photo-btn"
                      onClick={removePhoto}
                      disabled={saving || uploading}
                    >
                      Remove photo
                    </button>
                  )}
                </div>
                {uploadError && <small className="error">{uploadError}</small>}
              </div>

              <label htmlFor="profile-summary">
                Short summary
                <textarea
                  id="profile-summary"
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  maxLength={500}
                  rows={5}
                  placeholder="Write a few words about yourself and your place in the family."
                />
                <small className="character-count">{summary.length}/500</small>
              </label>

              <button className="profile-save" disabled={saving || uploading}>
                {saving ? "Saving…" : "Save profile"}
              </button>
              {message && <p className="profile-message">{message}</p>}
            </form>
          )}

          {section === "account" && (
            <div>
              <span className="eyebrow">ACCOUNT</span>
              <h2>Account settings</h2>
              <div className="setting-row">
                <div>
                  <strong>Email</strong>
                  <p>{session?.user?.email}</p>
                </div>
                <span>Managed by authentication</span>
              </div>
              <div className="setting-row">
                <div>
                  <strong>Family role</strong>
                  <p>{admin ? "Administrator" : member?.role || "Member"}</p>
                </div>
                <span>{member?.status || "approved"}</span>
              </div>
            </div>
          )}

          {section === "help" && (
            <div>
              <span className="eyebrow">SUPPORT</span>
              <h2>Help & support</h2>
              <div className="help-card">
                <strong>Need a hand?</strong>
                <p>
                  Family Archive keeps the important parts simple: memories,
                  stories, ancestry and the plans you are building together.
                </p>
                <p>
                  For account or family-access problems, contact the family
                  administrator.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
