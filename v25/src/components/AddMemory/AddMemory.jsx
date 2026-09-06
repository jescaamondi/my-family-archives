import { supabase } from "../../supabaseClient";
import { useState, useEffect } from "react";
import "./AddMemory.css";

function AddMemory({ onMemoryAdded, onClose }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    category: "home",
    tags: "",
    author: "",
    is_milestone: false,
    is_featured: false,
  });

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.user_metadata?.full_name) {
        setFormData((prev) => ({
          ...prev,
          author: user.user_metadata.full_name,
        }));
      }
    }

    getUser();
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFile = (selectedFile) => {
    if (!selectedFile) return;

    setError("");

    const validImage = selectedFile.type.startsWith("image/");
    const validVideo = selectedFile.type.startsWith("video/");

    if (!validImage && !validVideo) {
      setError("Please choose an image or video file.");
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];

    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError("Please give this memory a title.");
      return;
    }

    setError("");
    setUploading(true);

    let mediaUrl = null;
    let mediaType = null;

    try {
      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("memories")
          .upload(fileName, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error("There was a problem uploading your file.");
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("memories").getPublicUrl(fileName);

        mediaUrl = publicUrl;
        mediaType = file.type.startsWith("video") ? "video" : "image";
      }

      const { error } = await supabase.from("memories").insert([
        {
          title: formData.title.trim(),
          description: formData.description.trim(),
          date: formData.date,
          category: formData.category,
          tags: formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          author: formData.author,
          is_milestone: formData.is_milestone,
          is_featured: formData.is_featured,
          media_url: mediaUrl,
          media_type: mediaType,
        },
      ]);

      if (error) {
        console.error("Insert error:", error);
        throw new Error("There was a problem saving your memory.");
      }

      onMemoryAdded();
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page add-memory-page">
      {/* HEADER */}

      <header className="add-memory-header">
        <div className="add-memory-title">
          <span className="eyebrow">THE FAMILY ARCHIVE</span>

          <h1>Add a memory</h1>

          <p>Capture a moment before it fades.</p>
        </div>

        <div className="memory-note">
          <div className="memory-note-icon">♡</div>

          <div>
            <strong>Keep the little things.</strong>
            <p>Every memory you add becomes part of your family's story.</p>
          </div>
        </div>
      </header>

      {/* FORM */}

      <div className="memory-form-wrap">
        <form className="memory-form" onSubmit={handleSubmit}>
          {/* STORY */}

          <section className="memory-section">
            <div className="memory-section-heading">
              <span>01</span>

              <div>
                <h2>The moment</h2>
                <p>Start with what happened.</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="title">
                What happened? <b>*</b>
              </label>

              <input
                id="title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. The road trip that broke the GPS"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Tell the full story</label>

              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="All the details, the jokes, the chaos..."
              />

              <span className="field-hint">
                Write as much or as little as you remember.
              </span>
            </div>
          </section>

          {/* DETAILS */}

          <section className="memory-section">
            <div className="memory-section-heading">
              <span>02</span>

              <div>
                <h2>When & where</h2>
                <p>Give the memory a place in time.</p>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="date">
                  When? <b>*</b>
                </label>

                <input
                  id="date"
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category</label>

                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="home">At home</option>

                  <option value="trip">Trip</option>

                  <option value="event">Event</option>

                  <option value="milestone">Milestone</option>

                  <option value="story">Story</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="tags">Tags</label>

              <input
                id="tags"
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                placeholder="summer, food, dad-jokes"
              />

              <span className="field-hint">Separate tags with commas.</span>
            </div>
          </section>

          {/* AUTHOR */}

          <section className="memory-section">
            <div className="memory-section-heading">
              <span>03</span>

              <div>
                <h2>Who remembers?</h2>
                <p>This memory will be saved under your name.</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="author">Who's posting?</label>

              <div className="author-field">
                <div className="author-avatar">
                  {formData.author?.charAt(0)?.toUpperCase() || "?"}
                </div>

                <input
                  id="author"
                  type="text"
                  name="author"
                  value={formData.author}
                  readOnly
                />
              </div>
            </div>
          </section>

          {/* MEDIA */}

          <section className="memory-section">
            <div className="memory-section-heading">
              <span>04</span>

              <div>
                <h2>Add a photograph</h2>
                <p>A picture makes the memory even better.</p>
              </div>
            </div>

            <div className="form-group">
              <label>Photo or video</label>

              {!file ? (
                <label
                  className={`memory-upload ${dragging ? "dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />

                  <div className="upload-icon">+</div>

                  <strong>Drop a photo or video here</strong>

                  <span>or click to browse your files</span>

                  <small>Images and videos are supported</small>
                </label>
              ) : (
                <div className="selected-media">
                  <div className="media-preview">
                    {file.type.startsWith("video") ? (
                      <video src={previewUrl} controls />
                    ) : (
                      <img src={previewUrl} alt="Selected memory" />
                    )}
                  </div>

                  <div className="media-details">
                    <strong>{file.name}</strong>

                    <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>

                    <button type="button" onClick={() => setFile(null)}>
                      Remove file
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* OPTIONS */}

          <section className="memory-section memory-options-section">
            <div className="memory-section-heading">
              <span>05</span>

              <div>
                <h2>Make it special</h2>
                <p>Decide how this memory appears in the archive.</p>
              </div>
            </div>

            <div className="memory-options">
              <label className="option-card">
                <input
                  type="checkbox"
                  name="is_milestone"
                  checked={formData.is_milestone}
                  onChange={handleChange}
                />

                <span className="option-check">✓</span>

                <span>
                  <strong>This is a milestone</strong>

                  <small>Add this moment to the family timeline.</small>
                </span>
              </label>

              <label className="option-card">
                <input
                  type="checkbox"
                  name="is_featured"
                  checked={formData.is_featured}
                  onChange={handleChange}
                />

                <span className="option-check">✓</span>

                <span>
                  <strong>Feature on home page</strong>

                  <small>Give this memory a place in the spotlight.</small>
                </span>
              </label>
            </div>
          </section>

          {/* ERROR */}

          {error && (
            <div className="memory-error">
              <span>!</span>
              {error}
            </div>
          )}

          {/* ACTIONS */}

          <div className="memory-actions">
            <button type="submit" className="btn-primary" disabled={uploading}>
              {uploading ? "Saving memory..." : "Save memory"}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddMemory;
