import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import "./Stories.css";

export default function Stories({ stories = [], storyPeople = [], comments = [], people = [], currentUserId, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [open, setOpen] = useState(null);
  const [featured, setFeatured] = useState(stories[0]?.id || null);
  const [form, setForm] = useState({ title: "", body: "", story_date: "", location: "", personIds: [] });
  const [cover, setCover] = useState(null);
  const [audio, setAudio] = useState(null);
  const [audioMode, setAudioMode] = useState("upload");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState("");
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const [comment, setComment] = useState("");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [reading, setReading] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const featuredStory = stories.find((story) => story.id === featured) || stories[0];
  const years = useMemo(() => [...new Set(stories.map((s) => (s.story_date || s.created_at) ? new Date(s.story_date || s.created_at).getFullYear() : null).filter(Boolean))].sort((a,b) => b-a), [stories]);
  const visibleStories = useMemo(() => stories.filter((story) => {
    const haystack = `${story.title || ""} ${story.body || ""} ${story.location || ""}`.toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    const storyYear = (story.story_date || story.created_at) ? new Date(story.story_date || story.created_at).getFullYear() : null;
    return matchesQuery && (year === "all" || String(storyYear) === year);
  }), [stories, query, year]);

  useEffect(() => () => stopRecording(true), []);

  function stopRecording(silent = false) {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setIsRecording(false);
    if (!silent) setRecordingSeconds(0);
  }

  async function startRecording() {
    setRecordingError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("This browser does not support in-browser audio recording. You can upload a recording instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const ext = (recorder.mimeType || "audio/webm").includes("mp4") ? "m4a" : (recorder.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
        setAudio(new File([blob], `story-voice-memory.${ext}`, { type: blob.type }));
        recordingChunksRef.current = [];
        setRecordingSeconds(0);
      };
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    } catch (e) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setRecordingError(e.name === "NotAllowedError" ? "Microphone access was blocked. Allow microphone access or upload an existing recording." : "We couldn't start the recording. You can upload an existing recording instead.");
    }
  }

  function resetAudio() {
    stopRecording();
    setAudio(null);
    setRecordingError("");
  }

  function togglePerson(id) {
    setForm((f) => ({ ...f, personIds: f.personIds.includes(id) ? f.personIds.filter((x) => x !== id) : [...f.personIds, id] }));
  }

  async function saveStory(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return setError("Add a title and the story itself.");
    setSaving(true); setError("");
    try {
      let coverPath = null;
      if (isRecording) stopRecording();
      if (cover) {
        const ext = cover.name.split(".").pop() || "jpg";
        coverPath = `stories/${currentUserId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("family-media").upload(coverPath, cover);
        if (error) throw error;
      }
      let audioPath = null;
      if (audio) {
        const ext = audio.name.split(".").pop() || "webm";
        audioPath = `stories/${currentUserId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("family-media").upload(audioPath, audio);
        if (error) throw error;
      }
      const { data: story, error: storyError } = await supabase.from("family_stories").insert({
        title: form.title.trim(), body: form.body.trim(), story_date: form.story_date || null, location: form.location.trim() || null, cover_path: coverPath, audio_path: audioPath, created_by: currentUserId,
      }).select("*").single();
      if (storyError) throw storyError;
      if (form.personIds.length) {
        const { error } = await supabase.from("story_people").insert(form.personIds.map((person_id) => ({ story_id: story.id, person_id, created_by: currentUserId })));
        if (error) throw error;
      }
      setForm({ title: "", body: "", story_date: "", location: "", personIds: [] }); setCover(null); resetAudio(); setAudioMode("upload"); setShowAdd(false); await onRefresh?.();
    } catch (e) { setError(e.message || "Couldn't save the story."); } finally { setSaving(false); }
  }

  async function addComment(storyId) {
    if (!comment.trim()) return;
    const { error } = await supabase.from("story_comments").insert({ story_id: storyId, body: comment.trim(), created_by: currentUserId });
    if (error) return setError(error.message);
    setComment(""); await onRefresh?.();
  }

  function details(story) {
    const tagged = storyPeople.filter((x) => x.story_id === story.id).map((x) => people.find((p) => p.id === x.person_id)).filter(Boolean);
    const storyComments = comments.filter((x) => x.story_id === story.id);
    return { tagged, storyComments };
  }

  useEffect(() => {
    if (!reading) return;
    const onKey = (e) => { if (e.key === "Escape") setReading(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reading]);

  return <div className="page stories-page">
    <div className="stories-heading stories-heading-row">
      <div><span className="eyebrow">WORDS & MEMORIES</span><h1>Family Stories</h1><p className="subtitle">A living family journal — written by the people who were there, and kept for the people who come after.</p></div>
      <button className="story-add-button" onClick={() => setShowAdd(true)}>＋ Add a story</button>
    </div>

    {!stories.length ? <div className="empty-state story-empty"><div className="empty-icon">✎</div><h3>Tell the family a story</h3><p>Write it down, add a photo, and connect the people who were part of it.</p><button className="story-add-button" onClick={() => setShowAdd(true)}>Write the first story</button></div> : <>
      {featuredStory && (() => {
        const { tagged, storyComments } = details(featuredStory);
        return <section className="journal-feature" aria-label="Featured family story">
          <div className="journal-feature-copy">
            <span className="journal-label">FROM THE FAMILY JOURNAL</span>
            <div className="story-meta">{formatDate(featuredStory.story_date || featuredStory.created_at)}{featuredStory.location ? ` · ${featuredStory.location}` : ""}</div>
            <h2>{featuredStory.title}</h2>
            <p className="journal-excerpt">{featuredStory.body}</p>
            {tagged.length > 0 && <div className="story-people">{tagged.map((p) => <span key={p.id}>👤 {p.preferred_name || p.full_name}</span>)}</div>}
            {featuredStory.audio_url && <div className="story-audio-player"><span>🎙️ Listen to this memory</span><audio controls preload="metadata" src={featuredStory.audio_url} /></div>}
            <div className="journal-actions">
              <button className="story-read" onClick={() => setOpen(open === featuredStory.id ? null : featuredStory.id)}>{open === featuredStory.id ? "Close story" : "Read & discuss"} · {storyComments.length}</button>
              <span className="journal-count">Story 01 / {String(stories.length).padStart(2, "0")}</span>
            </div>
            {open === featuredStory.id && <Comments story={featuredStory} storyComments={storyComments} comment={comment} setComment={setComment} addComment={addComment} />}
          </div>
          <div className="journal-feature-image">
            {featuredStory.cover_url ? <img src={featuredStory.cover_url} alt="" /> : <div className="journal-paper-art"><span>✦</span><strong>A story worth remembering</strong><small>Written into the family archive</small></div>}
            <button className="journal-next" onClick={() => setFeatured(stories[(Math.max(0, stories.findIndex((s) => s.id === featuredStory.id)) + 1) % stories.length]?.id)}>Next story →</button>
          </div>
        </section>;
      })()}

      <div className="stories-section-heading"><div><span className="eyebrow">THE STORY WALL</span><h3>More family memories</h3></div><div className="story-filters"><input aria-label="Search stories" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search stories…" /> <select aria-label="Filter stories by year" value={year} onChange={(e) => setYear(e.target.value)}><option value="all">All years</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select><p>{visibleStories.length} of {stories.length}</p></div></div>
      {visibleStories.length === 0 ? <div className="story-filter-empty"><strong>No stories match that search.</strong><span>Try another word or choose a different year.</span></div> : <div className="stories-grid">
        {visibleStories.map((story, i) => {
          const { tagged, storyComments } = details(story);
          const active = featuredStory?.id === story.id;
          return <article className={`story-tile ${active ? "is-featured" : ""}`} key={story.id}>
            {story.cover_url ? <div className="story-tile-image"><img src={story.cover_url} alt="" /><span className="story-tile-index">{String(i + 1).padStart(2, "0")}</span></div> : <div className="story-tile-paper"><span>{String(i + 1).padStart(2, "0")}</span><b>Family memory</b></div>}
            <div className="story-tile-copy">
              <div className="story-meta">{formatDate(story.story_date || story.created_at)}{story.location ? ` · ${story.location}` : ""}</div>
              <h4>{story.title}</h4>
              <p>{story.body.length > 155 ? `${story.body.slice(0, 155)}…` : story.body}</p>
              {tagged.length > 0 && <div className="story-people">{tagged.slice(0, 3).map((p) => <span key={p.id}>👤 {p.preferred_name || p.full_name}</span>)}{tagged.length > 3 && <span>+{tagged.length - 3}</span>}</div>}
              <div className="story-tile-actions"><button onClick={() => { setFeatured(story.id); setOpen(open === story.id ? null : story.id); }}>{open === story.id ? "Close" : "Read story"}</button><button className="story-expand" onClick={() => setReading(story)}>Open journal</button><span>💬 {storyComments.length}</span></div>
              {open === story.id && <Comments story={story} storyComments={storyComments} comment={comment} setComment={setComment} addComment={addComment} />}
            </div>
          </article>;
        })}
      </div>}
    </>}

    {reading && <div className="story-reading-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setReading(null)}><article className="story-reading"><button className="story-reading-close" onClick={() => setReading(null)}>×</button><div className="story-reading-media">{reading.cover_url ? <img src={reading.cover_url} alt="" /> : <div className="journal-paper-art"><span>✦</span><strong>A story worth remembering</strong><small>Written into the family archive</small></div>}</div><div className="story-reading-copy"><span className="eyebrow">FAMILY JOURNAL</span><div className="story-meta">{formatDate(reading.story_date || reading.created_at)}{reading.location ? ` · ${reading.location}` : ""}</div><h2>{reading.title}</h2><div className="reading-rule" />{reading.audio_url && <div className="story-audio-player reading-audio"><span>🎙️ Listen to this memory</span><audio controls preload="metadata" src={reading.audio_url} /></div>}<p>{reading.body}</p><div className="reading-footer"><span>Estimated reading time · {readingTime(reading.body)}</span><span>Keep this story close to the family archive</span></div></div></article></div>}

    {showAdd && <div className="story-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowAdd(false)}><form className="story-modal" onSubmit={saveStory}><button type="button" className="story-close" onClick={() => setShowAdd(false)}>×</button><span className="eyebrow">ADD TO THE ARCHIVE</span><h2>Write a family story</h2><label>Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="The summer we all went to..." /></label><label>Your story<textarea rows="9" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Tell it in your own words..." /></label><div className="story-form-grid"><label>Date<input type="date" value={form.story_date} onChange={(e) => setForm({ ...form, story_date: e.target.value })} /></label><label>Place<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Optional" /></label></div><label>Cover photo<input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} /></label><div className="audio-memory-field"><strong>Audio memory</strong><span className="field-hint">Optional — record a voice memory here or upload an existing recording.</span><div className="audio-mode-switch" role="tablist" aria-label="Audio memory method"><button type="button" className={audioMode === "record" ? "active" : ""} onClick={() => { setAudioMode("record"); setRecordingError(""); }}>🎙️ Record</button><button type="button" className={audioMode === "upload" ? "active" : ""} onClick={() => { if (isRecording) stopRecording(); setAudioMode("upload"); setRecordingError(""); }}>↥ Upload</button></div>{audioMode === "record" ? <div className="audio-recorder"><div className={`recording-orb ${isRecording ? "is-recording" : ""}`} aria-hidden="true"><span>●</span></div><div className="recording-copy"><strong>{isRecording ? `Recording · ${formatSeconds(recordingSeconds)}` : audio ? "Voice memory ready" : "Record in your browser"}</strong><span>{isRecording ? "Speak naturally. Stop when you've finished your memory." : audio ? audio.name : "Your browser will ask for microphone permission."}</span></div><div className="recording-actions">{isRecording ? <button type="button" className="record-stop" onClick={() => stopRecording()}>Stop recording</button> : <button type="button" className="record-start" onClick={startRecording}>{audio ? "Record again" : "Start recording"}</button>}{audio && !isRecording && <button type="button" className="record-clear" onClick={resetAudio}>Remove</button>}</div>{audio && !isRecording && <audio className="recorded-preview" controls preload="metadata" src={URL.createObjectURL(audio)} />}</div> : <div className="audio-upload"><input id="story-audio-upload" type="file" accept="audio/*" onChange={(e) => { setAudio(e.target.files?.[0] || null); setRecordingError(""); }} /><label htmlFor="story-audio-upload" className="audio-upload-drop"><span>↥</span><strong>{audio ? audio.name : "Choose an audio recording"}</strong><small>MP3, M4A, WAV, OGG or WebM</small></label>{audio && <button type="button" className="record-clear" onClick={resetAudio}>Remove recording</button>}</div>}{recordingError && <div className="audio-error">{recordingError}</div>}</div><div><strong>Who is in this story?</strong><div className="person-picker">{people.map((p) => <button type="button" className={form.personIds.includes(p.id) ? "picked" : ""} key={p.id} onClick={() => togglePerson(p.id)}>{p.preferred_name || p.full_name}</button>)}</div></div>{error && <div className="story-error">{error}</div>}<div className="story-modal-actions"><button type="button" onClick={() => setShowAdd(false)}>Cancel</button><button className="story-save" disabled={saving}>{saving ? "Saving..." : "Publish story"}</button></div></form></div>}
  </div>;
}

function Comments({ story, storyComments, comment, setComment, addComment }) {
  return <div className="story-comments"><div className="comment-list">{storyComments.length ? storyComments.map((c) => <div className="comment" key={c.id}><strong>Family member</strong><p>{c.body}</p></div>) : <p className="no-comments">No replies yet. Be the first family member to add a thought.</p>}</div><div className="comment-form"><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a reply..." onKeyDown={(e) => e.key === "Enter" && addComment(story.id)} /><button onClick={() => addComment(story.id)}>Reply</button></div></div>;
}
function formatDate(v) { return v ? new Date(v).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Undated"; }
function formatSeconds(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function readingTime(text = "") { const mins = Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 180)); return `${mins} min`; }
