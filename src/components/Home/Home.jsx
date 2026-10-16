import { useState, useEffect } from "react";
import { resolveMediaUrl } from "../../lib/storage";
import Lightbox from "../Lightbox/Lightbox";
import "./Home.css";

export default function Home({
  memories = [],
  reminders = [],
  milestones = [],
  userName = "Family",
}) {
  const [lightbox, setLightbox] = useState(null);
  const [mediaUrls, setMediaUrls] = useState({});

  const sortedMemories = [...memories].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;

    return dateB - dateA;
  });

  const featured = sortedMemories.find((memory) => memory?.media_url) || null;

  const recent = featured
    ? sortedMemories.filter((memory) => memory.id !== featured.id).slice(0, 6)
    : sortedMemories.slice(0, 6);

  const stories = memories.filter((memory) => memory.category === "story");

  const ARCHIVE_ESTABLISHED_YEAR = 1990;
  const years = Math.max(0, new Date().getFullYear() - ARCHIVE_ESTABLISHED_YEAR);
  useEffect(() => {
    let cancelled = false;

    async function resolveMedia() {
      const results = {};

      for (const memory of memories) {
        if (!memory?.media_url) continue;

        const value = memory.media_url;

        // If media_url is already a complete URL,
        // use it directly.
        try {
          const url = await resolveMediaUrl(value);
          results[memory.id] = url;
        } catch (e) {
          console.error("Could not resolve media for memory", memory.id, e);
          results[memory.id] = null;
        }
      }

      if (!cancelled) {
        setMediaUrls(results);
      }
    }

    resolveMedia();

    return () => {
      cancelled = true;
    };
  }, [memories]);

  function getMediaUrl(memory) {
    return mediaUrls[memory?.id] || null;
  }

  function openMemory(memory) {
    const mediaUrl = getMediaUrl(memory);

    if (!mediaUrl) return;

    setLightbox({
      ...memory,
      media_url: mediaUrl,
    });
  }

  return (
    <div className="page home-page">
      {/* =========================
          HERO
      ========================= */}
      <section className="home-hero">
        <div>
          <span className="eyebrow">THE FAMILY ARCHIVE</span>

          <h1>
            Our story,
            <br />
            preserved.
          </h1>

          <p>
            The photographs, stories, jokes and little moments that make our
            family what it is.
          </p>
        </div>

        <div className="hero-mark">
          <span>Est.</span>
          <strong>1990</strong>
        </div>
      </section>

      {/* =========================
          STATS
      ========================= */}
      <section className="archive-stats">
        <div>
          <strong>{memories.length}</strong>
          <span>Memories</span>
        </div>

        <div>
          <strong>{years || "—"}</strong>
          <span>Years together</span>
        </div>

        <div>
          <strong>{stories.length}</strong>
          <span>Stories</span>
        </div>

        <div>
          <strong>{milestones.length}</strong>
          <span>Milestones</span>
        </div>
      </section>

      {/* =========================
          FEATURED MEMORY
      ========================= */}
      {featured ? (
        <section className="featured-memory">
          <button
            className="featured-image"
            onClick={() => openMemory(featured)}
          >
            {getMediaUrl(featured) ? (
              featured.media_type === "video" ? (
                <video
                  src={getMediaUrl(featured)}
                  muted
                  playsInline
                  controls={false}
                />
              ) : (
                <img
                  src={getMediaUrl(featured)}
                  alt={featured.title || "Family memory"}
                  onError={(event) => {
                    console.error(
                      "FEATURED IMAGE FAILED:",
                      featured.title,
                      featured.media_url,
                    );

                    event.currentTarget.style.display = "none";
                  }}
                />
              )
            ) : (
              <div className="photo-placeholder">✦</div>
            )}

            <span className="featured-overlay">
              <span>{featured.category || "Memory"}</span>

              <strong>View memory →</strong>
            </span>
          </button>

          <div className="featured-copy">
            <span className="eyebrow">A MEMORY TO KEEP</span>

            <h2>{featured.title || "Untitled memory"}</h2>

            {featured.description && <p>{featured.description}</p>}

            <span className="memory-date">{formatDate(featured.date)}</span>
          </div>
        </section>
      ) : (
        <section className="home-empty">
          <span className="eyebrow">YOUR ARCHIVE STARTS HERE</span>

          <h2>Add your first memory.</h2>

          <p>
            Photographs, stories and little family moments can all live here.
          </p>
        </section>
      )}

      {/* =========================
          RECENTLY REMEMBERED
      ========================= */}
      {recent.length > 0 && (
        <section className="home-section">
          <div className="section-header">
            <div>
              <span className="eyebrow">THE ARCHIVE</span>

              <h2>Recently remembered</h2>
            </div>

            <span className="section-count">{recent.length} moments</span>
          </div>

          <div className="home-photo-grid">
            {recent.map((memory) => {
              const imageUrl = getMediaUrl(memory);

              return (
                <button
                  className="home-photo-card"
                  key={memory.id}
                  onClick={() => openMemory(memory)}
                >
                  {imageUrl ? (
                    memory.media_type === "video" ? (
                      <video src={imageUrl} muted playsInline />
                    ) : (
                      <img
                        src={imageUrl}
                        alt={memory.title || "Family memory"}
                        onError={(event) => {
                          console.error(
                            "RECENT IMAGE FAILED:",
                            memory.title,
                            memory.media_url,
                          );

                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )
                  ) : (
                    <div className="photo-placeholder">✦</div>
                  )}

                  <div className="home-photo-info">
                    <span>{formatDate(memory.date)}</span>

                    <h3>{memory.title || "Untitled memory"}</h3>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================
          STORIES
      ========================= */}
      {stories.length > 0 && (
        <section className="home-section">
          <div className="section-header">
            <div>
              <span className="eyebrow">WORDS & MEMORIES</span>

              <h2>Family stories</h2>
            </div>
          </div>

          <div className="story-preview-grid">
            {stories.slice(0, 3).map((story) => (
              <article className="story-preview" key={story.id}>
                <span className="story-date">{formatDate(story.date)}</span>

                <h3>{story.title}</h3>

                <p>{story.description}</p>

                <span className="story-author">
                  {story.author || "Family archive"}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="home-dashboard-grid">
        <div className="home-dashboard-card">
          <span className="eyebrow">UP NEXT</span>
          <h2>Good to see you, {userName.split(" ")[0]}.</h2>
          <p>
            Your family archive is growing. Here are the things worth keeping
            close today.
          </p>
          {reminders.slice(0, 3).map((reminder) => (
            <div className="home-reminder-row" key={reminder.id}>
              <span>⏰</span>
              <div>
                <strong>{reminder.title || "Family reminder"}</strong>
                <small>
                  {reminder.remind_at
                    ? new Date(reminder.remind_at).toLocaleDateString()
                    : "Upcoming"}
                </small>
              </div>
            </div>
          ))}
          {!reminders.length && (
            <div className="home-soft-note">
              No reminders waiting. Enjoy the archive.
            </div>
          )}
        </div>
        <div className="home-dashboard-card home-on-this-day">
          <span className="eyebrow">ON THIS DAY</span>
          <h2>A moment worth remembering.</h2>
          {(() => {
            const today = new Date();
            const match = memories.find(
              (m) =>
                m.date &&
                new Date(m.date).getMonth() === today.getMonth() &&
                new Date(m.date).getDate() === today.getDate(),
            );
            return match ? (
              <>
                <strong>{match.title || "A family memory"}</strong>
                <p>
                  {match.description ||
                    "A memory from this day in another year."}
                </p>
                <span>{formatDate(match.date)}</span>
              </>
            ) : (
              <p>
                No memory from this date yet. One day, this space will hold one.
              </p>
            );
          })()}
        </div>
        <div className="home-dashboard-card">
          <span className="eyebrow">FAMILY FUTURE</span>
          <h2>Dreams in motion</h2>
          <div className="home-goal-list">
            {milestones
              .filter((m) => m.status !== "achieved")
              .slice(0, 3)
              .map((m) => (
                <div key={m.id}>
                  <span>✦</span>
                  <strong>{m.title}</strong>
                </div>
              ))}
          </div>
          {!milestones.filter((m) => m.status !== "achieved").length && (
            <div className="home-soft-note">
              No active goals yet. The future is waiting.
            </div>
          )}
        </div>
      </section>

      {/* =========================
          FOOTER
      ========================= */}
      <footer className="archive-footer">
        <span>The Family Archive</span>

        <span>Made with love, for the family.</span>
      </footer>

      {/* =========================
          LIGHTBOX
      ========================= */}
      {lightbox && (
        <Lightbox memory={lightbox} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}

/* =========================
   DATE FORMATTER
========================= */

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Undated";
}
