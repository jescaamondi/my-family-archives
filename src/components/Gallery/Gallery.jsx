import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import "./Gallery.css";
import { resolveMediaUrl } from "../../lib/storage";
import { useToasts } from "../../lib/useToasts";

export default function Gallery({ memories = [], people = [], onRefresh }) {
  function mapStorageError(err) {
    const msg = (err && (err.message || err.msg)) || String(err || "");
    if (/row-level security|violates row-level security/i.test(msg))
      return "Upload blocked by storage permissions. Sign in or contact the family administrator to enable uploads.";
    if (
      /permission|permission denied|forbidden|unauthorized|401|403/i.test(msg)
    )
      return "Upload blocked by permissions. Please sign in and try again, or ask the family administrator for access.";
    return msg;
  }
  const [selected, setSelected] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState("all");
  const [manualAlbums, setManualAlbums] = useState([]);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [albumCoverFile, setAlbumCoverFile] = useState(null);
  const [albumCoverPreview, setAlbumCoverPreview] = useState("");
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [manualAlbumError, setManualAlbumError] = useState("");
  const [albumIdForUpload, setAlbumIdForUpload] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("familyArchiveFavorites") || "[]");
    } catch {
      return [];
    }
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [personIds, setPersonIds] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const { add: addToast } = useToasts();

  const mediaMemories = memories.filter((memory) => memory?.media_url);

  function acceptFiles(fileList) {
    const incoming = Array.from(fileList || []).filter(
      (file) =>
        file.type.startsWith("image/") || file.type.startsWith("video/"),
    );
    if (!incoming.length) {
      setError("Please add photos or videos.");
      return;
    }
    setFiles((current) => [...current, ...incoming]);
    setError("");
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    acceptFiles(e.dataTransfer.files);
  }

  async function loadManualAlbums() {
    const { data, error } = await supabase
      .from("gallery_albums")
      .select(
        "id,name,description,cover_path,created_at,gallery_album_memories(memory_id)",
      )
      .order("created_at", { ascending: false });

    if (!error) {
      setManualAlbums(data || []);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await loadManualAlbums();
    })();
    return () => {
      active = false;
    };
  }, [memories]);

  const manualAlbum = selectedAlbum.startsWith("manual:")
    ? manualAlbums.find((album) => album.id === selectedAlbum.slice(7))
    : null;

  const manualMemoryIds = new Set(
    manualAlbum?.gallery_album_memories?.map((item) => item.memory_id) || [],
  );

  const albumMap = mediaMemories.reduce((groups, memory) => {
    const year = memory.date
      ? new Date(memory.date).getFullYear().toString()
      : "Undated";
    if (!groups[year]) groups[year] = [];
    groups[year].push(memory);
    return groups;
  }, {});

  const albums = Object.entries(albumMap)
    .sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }))
    .map(([name, items]) => ({ name, items }));

  const baseVisibleMemories =
    selectedAlbum === "all"
      ? mediaMemories
      : manualAlbum
        ? mediaMemories.filter((memory) => manualMemoryIds.has(memory.id))
        : albumMap[selectedAlbum] || [];
  const visibleMemories = showFavorites
    ? baseVisibleMemories.filter((memory) => favorites.includes(memory.id))
    : baseVisibleMemories;

  async function handleCreateAlbum(e) {
    e.preventDefault();
    const name = albumName.trim();
    if (!name) {
      setManualAlbumError("Give the album a name.");
      return;
    }
    setCreatingAlbum(true);
    setManualAlbumError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in to create an album.");
      let coverPath = null;
      if (albumCoverFile) {
        const ext = albumCoverFile.name.split(".").pop() || "jpg";
        coverPath = `${user.id}/album-covers/${crypto.randomUUID()}.${ext}`;
        const { error: coverError } = await supabase.storage
          .from("family-media")
          .upload(coverPath, albumCoverFile);
        if (coverError) throw new Error(mapStorageError(coverError));
      }
      const { data, error } = await supabase
        .from("gallery_albums")
        .insert({
          name,
          description: albumDescription.trim() || null,
          cover_path: coverPath,
          created_by: user.id,
        })
        .select("id,name,description,cover_path,created_at")
        .single();
      if (error) throw error;
      setManualAlbums((current) => [
        { ...data, gallery_album_memories: [] },
        ...current,
      ]);
      setSelectedAlbum(`manual:${data.id}`);
      setAlbumName("");
      setAlbumDescription("");
      setAlbumCoverFile(null);
      setAlbumCoverPreview("");
      setShowCreateAlbum(false);
    } catch (err) {
      setManualAlbumError(err.message || "Could not create the album.");
    } finally {
      setCreatingAlbum(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();

    if (files.length === 0) {
      setError("Please choose at least one photo or video.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to upload media.");
      }

      for (const file of files) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("family-media")
          .upload(filePath, file);

        if (uploadError) {
          throw new Error(mapStorageError(uploadError));
        }

        const mediaType = file.type.startsWith("video/") ? "video" : "image";

        const { error: databaseError } = await supabase
          .from("memories")
          .insert({
            title: title || file.name,
            description,
            date,
            media_url: filePath,
            media_type: mediaType,
            category: "Family",
            posted_by: user.id,
          });

        if (databaseError) {
          await supabase.storage.from("family-media").remove([filePath]);
          throw databaseError;
        }

        const { data: createdMemory } = await supabase
          .from("memories")
          .select("id")
          .eq("media_url", filePath)
          .maybeSingle();
        if (createdMemory?.id && personIds.length) {
          const { error: tagError } = await supabase
            .from("memory_people")
            .insert(
              personIds.map((person_id) => ({
                memory_id: createdMemory.id,
                person_id,
                created_by: user.id,
              })),
            );
          if (tagError) throw tagError;
        }
        if (createdMemory?.id && albumIdForUpload) {
          const { error: albumError } = await supabase
            .from("gallery_album_memories")
            .insert({
              album_id: albumIdForUpload,
              memory_id: createdMemory.id,
              added_by: user.id,
            });
          if (albumError) throw albumError;
        }
      }

      setTitle("");
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      setFiles([]);
      setPersonIds([]);
      setAlbumIdForUpload("");
      setShowUpload(false);

      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
      const msg = err.message || "Something went wrong while uploading.";
      setError(msg);
      try {
        addToast({ title: "Upload failed", message: msg, type: "error" });
      } catch { /* Toasts are optional UI feedback. */ }
    } finally {
      setUploading(false);
    }
  }

  async function openMemory(memory) {
    if (!memory?.media_url) return;
    try {
      const url = await resolveMediaUrl(memory.media_url);
      setSelected({ ...memory, signedUrl: url });
    } catch (e) {
      console.error("Could not resolve memory media url", e);
    }
  }

  function closeUpload() {
    if (uploading) return;

    setShowUpload(false);
    setError("");
    setFiles([]);
    setPersonIds([]);
    setAlbumIdForUpload("");
  }

  function manualMemoryIdsFor(album) {
    return new Set(
      album?.gallery_album_memories?.map((item) => item.memory_id) || [],
    );
  }

  return (
    <div className="page gallery-page">
      <div className="gallery-header">
        <div>
          <span className="eyebrow">FAMILY PHOTOGRAPHS</span>

          <h1>Our gallery</h1>

          <p className="subtitle">
            The faces, places and little moments we never want to forget.
          </p>
        </div>

        <div className="gallery-header-actions">
          <button
            type="button"
            className={`gallery-favorites-button ${showFavorites ? "active" : ""}`}
            onClick={() => setShowFavorites((v) => !v)}
          >
            {showFavorites ? "★ Favorites" : "☆ Favorites"}
          </button>
          <button
            className="gallery-upload-button"
            onClick={() => setShowUpload(true)}
          >
            <span>＋</span>
            Add photos
          </button>
        </div>
      </div>

      {mediaMemories.length === 0 ? (
        <div className="gallery-empty">
          <div className="gallery-empty-icon">⌁</div>

          <h3>Your family gallery is waiting</h3>

          <p>
            Add your first photograph or video and start filling the archive.
          </p>

          <button
            className="gallery-empty-button"
            onClick={() => setShowUpload(true)}
          >
            Add your first photo
          </button>
        </div>
      ) : (
        <>
          <section className="gallery-albums" aria-label="Family photo albums">
            <div className="gallery-section-heading">
              <div>
                <span className="eyebrow">BROWSE BY ALBUM</span>
                <h2>Family albums</h2>
              </div>
              <span className="gallery-album-count">
                {albums.length} {albums.length === 1 ? "album" : "albums"}
              </span>
            </div>

            <div className="gallery-album-row">
              <button
                type="button"
                className={`gallery-album-card gallery-album-all ${selectedAlbum === "all" ? "active" : ""}`}
                onClick={() => setSelectedAlbum("all")}
              >
                <div className="gallery-album-cover gallery-album-cover-all">
                  {mediaMemories.slice(0, 4).map((memory, index) => (
                    <GalleryThumbnail
                      key={memory.id || index}
                      memory={memory}
                      compact
                    />
                  ))}
                </div>
                <div className="gallery-album-meta">
                  <strong>All memories</strong>
                  <span>{mediaMemories.length} moments</span>
                </div>
              </button>

              {albums.map((album) => {
                const cover = album.items[0];
                return (
                  <button
                    type="button"
                    className={`gallery-album-card ${selectedAlbum === album.name ? "active" : ""}`}
                    key={album.name}
                    onClick={() => setSelectedAlbum(album.name)}
                  >
                    <div className="gallery-album-cover">
                      <GalleryThumbnail memory={cover} compact />
                      <span className="gallery-album-badge">
                        {album.items.length}
                      </span>
                    </div>
                    <div className="gallery-album-meta">
                      <strong>
                        {album.name === "Undated"
                          ? "Undated memories"
                          : `${album.name} collection`}
                      </strong>
                      <span>
                        {album.items.length}{" "}
                        {album.items.length === 1 ? "moment" : "moments"}
                      </span>
                    </div>
                  </button>
                );
              })}

              {manualAlbums.map((album) => {
                const cover = mediaMemories.find((memory) =>
                  manualMemoryIdsFor(album).has(memory.id),
                );
                const count = album.gallery_album_memories?.length || 0;
                return (
                  <button
                    type="button"
                    className={`gallery-album-card gallery-manual-album ${selectedAlbum === `manual:${album.id}` ? "active" : ""}`}
                    key={`manual-${album.id}`}
                    onClick={() => setSelectedAlbum(`manual:${album.id}`)}
                  >
                    <div className="gallery-album-cover">
                      {album.cover_path ? (
                        <AlbumCover path={album.cover_path} fallback={cover} />
                      ) : cover ? (
                        <GalleryThumbnail memory={cover} compact />
                      ) : (
                        <div className="gallery-empty-album-cover">
                          <span>✦</span>
                        </div>
                      )}
                      <span className="gallery-album-badge">{count}</span>
                    </div>
                    <div className="gallery-album-meta">
                      <strong>{album.name}</strong>
                      <span>
                        {count} {count === 1 ? "moment" : "moments"} · Family
                        album
                      </span>
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                className="gallery-create-album-card"
                onClick={() => setShowCreateAlbum(true)}
              >
                <span className="gallery-create-album-icon">＋</span>
                <strong>Create an album</strong>
                <span>Keep special memories together</span>
              </button>
            </div>
          </section>

          <section className="gallery-masonry-section">
            <div className="gallery-section-heading">
              <div>
                <span className="eyebrow">THE ARCHIVE</span>
                <h2>
                  {manualAlbum
                    ? manualAlbum.name
                    : selectedAlbum === "all"
                      ? "Every memory"
                      : selectedAlbum === "Undated"
                        ? "Undated memories"
                        : `${selectedAlbum} memories`}
                </h2>
              </div>
              <span className="gallery-album-count">
                {visibleMemories.length}{" "}
                {visibleMemories.length === 1 ? "memory" : "memories"}
              </span>
            </div>

            <div className="gallery-grid">
              {visibleMemories.map((memory, index) => (
                <button
                  key={memory.id || index}
                  className={`gallery-card gallery-card-${index % 5}`}
                  onClick={() => openMemory(memory)}
                >
                  <GalleryThumbnail memory={memory} />

                  <span
                    className={`gallery-favorite-toggle ${favorites.includes(memory.id) ? "active" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      setFavorites((current) => {
                        const next = current.includes(memory.id)
                          ? current.filter((id) => id !== memory.id)
                          : [...current, memory.id];
                        localStorage.setItem(
                          "familyArchiveFavorites",
                          JSON.stringify(next),
                        );
                        return next;
                      });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        setFavorites((current) => {
                          const next = current.includes(memory.id)
                            ? current.filter((id) => id !== memory.id)
                            : [...current, memory.id];
                          localStorage.setItem(
                            "familyArchiveFavorites",
                            JSON.stringify(next),
                          );
                          return next;
                        });
                      }
                    }}
                    aria-label={
                      favorites.includes(memory.id)
                        ? "Remove favorite"
                        : "Add favorite"
                    }
                  >
                    {favorites.includes(memory.id) ? "★" : "☆"}
                  </span>

                  <div className="gallery-card-info">
                    <strong>{memory.title || "Untitled memory"}</strong>

                    {memory.date && (
                      <span>
                        {new Date(memory.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {showUpload && (
        <div className="gallery-modal-backdrop" onClick={closeUpload}>
          <div
            className="gallery-upload-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="gallery-modal-close"
              onClick={closeUpload}
              aria-label="Close"
            >
              ×
            </button>

            <span className="eyebrow">ADD TO THE ARCHIVE</span>

            <h2>Add photographs</h2>

            <p className="gallery-modal-intro">
              Share a photo or video with everyone in the family.
            </p>

            <form onSubmit={handleUpload}>
              <label>
                Photos or videos
                <div
                  className={`gallery-dropzone ${isDragging ? "dragging" : ""}`}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    if (e.currentTarget === e.target) setIsDragging(false);
                  }}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => acceptFiles(e.target.files)}
                  />

                  <div className="dropzone-icon">＋</div>

                  <strong>Choose photos or videos</strong>

                  <span>You can select more than one</span>
                </div>
              </label>

              {files.length > 0 && (
                <div className="selected-files">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`}>
                      <span>
                        {file.type.startsWith("video/") ? "🎥" : "📷"}
                      </span>
                      <span>{file.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setFiles((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label>
                Title
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Christmas at Grandma's"
                />
              </label>

              <label>
                Caption
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell the family what was happening..."
                  rows="4"
                />
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>

              {manualAlbums.length > 0 && (
                <label>
                  Add to a family album{" "}
                  <span className="gallery-optional">optional</span>
                  <select
                    value={albumIdForUpload}
                    onChange={(e) => setAlbumIdForUpload(e.target.value)}
                  >
                    <option value="">Just add to Gallery</option>
                    {manualAlbums.map((album) => (
                      <option key={album.id} value={album.id}>
                        {album.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    Leave this empty to keep the photos directly in the main
                    Gallery.
                  </small>
                </label>
              )}

              {people.length > 0 && (
                <div className="gallery-people-picker">
                  <strong>Who is in these photos?</strong>
                  <div className="gallery-person-options">
                    {people.map((person) => {
                      const picked = personIds.includes(person.id);
                      return (
                        <button
                          type="button"
                          className={picked ? "picked" : ""}
                          key={person.id}
                          onClick={() =>
                            setPersonIds((current) =>
                              picked
                                ? current.filter((id) => id !== person.id)
                                : [...current, person.id],
                            )
                          }
                        >
                          {person.preferred_name || person.full_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && <div className="gallery-upload-error">{error}</div>}

              <div className="gallery-modal-actions">
                <button
                  type="button"
                  className="gallery-cancel"
                  onClick={closeUpload}
                  disabled={uploading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="gallery-save"
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Add to gallery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateAlbum && (
        <div
          className="gallery-modal-backdrop"
          onClick={() => !creatingAlbum && setShowCreateAlbum(false)}
        >
          <div
            className="gallery-upload-modal gallery-create-album-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="gallery-modal-close"
              onClick={() => setShowCreateAlbum(false)}
              aria-label="Close"
            >
              ×
            </button>
            <span className="eyebrow">MAKE A COLLECTION</span>
            <h2>Create a family album</h2>
            <p className="gallery-modal-intro">
              Create a shared album for holidays, reunions, trips, or any
              chapter worth keeping together.
            </p>
            <form onSubmit={handleCreateAlbum}>
              <label>
                Album name
                <input
                  autoFocus
                  value={albumName}
                  onChange={(e) => setAlbumName(e.target.value)}
                  placeholder="e.g. Summer in Italy"
                />
              </label>
              <label>
                Album cover <span className="gallery-optional">optional</span>
                <div className="gallery-cover-picker">
                  {albumCoverPreview ? (
                    <img src={albumCoverPreview} alt="Album cover preview" />
                  ) : (
                    <div className="gallery-cover-placeholder">
                      Choose a family photo as the album cover
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAlbumCoverFile(file);
                      setAlbumCoverPreview(URL.createObjectURL(file));
                    }}
                  />
                </div>
              </label>
              <label>
                Description <span className="gallery-optional">optional</span>
                <textarea
                  value={albumDescription}
                  onChange={(e) => setAlbumDescription(e.target.value)}
                  placeholder="What belongs in this collection?"
                  rows="3"
                />
              </label>
              {manualAlbumError && (
                <div className="gallery-upload-error">{manualAlbumError}</div>
              )}
              <div className="gallery-modal-actions">
                <button
                  type="button"
                  className="gallery-cancel"
                  onClick={() => setShowCreateAlbum(false)}
                  disabled={creatingAlbum}
                >
                  Cancel
                </button>
                <button className="gallery-save" disabled={creatingAlbum}>
                  {creatingAlbum ? "Creating..." : "Create album"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="gallery-lightbox" onClick={() => setSelected(null)}>
          <button
            className="gallery-lightbox-close"
            onClick={() => setSelected(null)}
          >
            ×
          </button>

          <div
            className="gallery-lightbox-content"
            onClick={(e) => e.stopPropagation()}
          >
            {selected.media_type === "video" ? (
              <video src={selected.signedUrl} controls autoPlay />
            ) : (
              <img
                src={selected.signedUrl}
                alt={selected.title || "Family memory"}
              />
            )}

            <div className="gallery-lightbox-caption">
              <h2>{selected.title || "Untitled memory"}</h2>

              {selected.description && <p>{selected.description}</p>}

              {selected.date && (
                <span>
                  {new Date(selected.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlbumCover({ path, fallback }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let active = true;
    supabase.storage
      .from("family-media")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl || null);
      });
    return () => {
      active = false;
    };
  }, [path]);
  if (url) return <img src={url} alt="Album cover" />;
  return fallback ? (
    <GalleryThumbnail memory={fallback} compact />
  ) : (
    <div className="gallery-empty-album-cover">
      <span>✦</span>
    </div>
  );
}

function GalleryThumbnail({ memory, compact = false }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadImage() {
      if (!memory?.media_url) return;
      try {
        const u = await resolveMediaUrl(memory.media_url);
        if (active) setUrl(u);
      } catch (e) {
        console.error("Could not resolve thumbnail url", e);
      }
    }

    loadImage();

    return () => {
      active = false;
    };
  }, [memory.media_url]);

  if (!url) {
    return (
      <div className={`gallery-thumbnail-loading ${compact ? "compact" : ""}`}>
        <span>Loading...</span>
      </div>
    );
  }

  if (memory.media_type === "video") {
    return (
      <div className={`gallery-video-thumbnail ${compact ? "compact" : ""}`}>
        <video src={url} muted />
        <span className="gallery-play">▶</span>
      </div>
    );
  }

  return <img src={url} alt={memory.title || "Family memory"} />;
}
