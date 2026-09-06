import "./Timeline.css";
export default function Timeline({ memories = [] }) {
  const items = [...memories].sort(
    (a, b) => new Date(b?.date || 0) - new Date(a?.date || 0),
  );
  return (
    <div className="page timeline-page">
      <div className="page-heading">
        <span className="eyebrow">OUR JOURNEY</span>
        <h1>Our journey</h1>
        <p className="subtitle">
          The big moments, the small moments, and everything between.
        </p>
      </div>
      {!items.length ? (
        <div className="empty-state">
          <div className="empty-icon">◷</div>
          <h3>No timeline entries yet</h3>
          <p>Add your first memory to see your journey unfold.</p>
        </div>
      ) : (
        <div className="timeline">
          {items.map((m, i) => (
            <article
              className={`timeline-item ${i === 0 ? "highlight" : ""}`}
              key={m.id || i}
            >
              <div className="timeline-marker">{i + 1}</div>
              <div className="timeline-date">{formatDate(m.date)}</div>
              <div className="timeline-content">
                <span>
                  {m.category || "memory"}
                  {m.author ? ` · ${m.author}` : ""}
                </span>
                <h2>{m.title || "Untitled memory"}</h2>
                <p>{m.description || "No description yet."}</p>
                {Array.isArray(m.tags) && m.tags.length > 0 && (
                  <div className="tags">
                    {m.tags.map((t, j) => (
                      <span className="tag" key={j}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
function formatDate(v) {
  return v
    ? new Date(v).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown date";
}
