import { useEffect } from "react";
import "./Lightbox.css";
export default function Lightbox({ memory, onClose }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", h);
      document.body.style.overflow = old;
    };
  }, [onClose]);
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>
        ×
      </button>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-media">
          {memory.media_type === "video" ? (
            <video src={memory.media_url} controls autoPlay />
          ) : (
            <img src={memory.media_url} alt={memory.title || "Family memory"} />
          )}
        </div>
        <div className="lightbox-info">
          <span>
            {formatDate(memory.date)}
            {memory.author ? ` · ${memory.author}` : ""}
          </span>
          <h2>{memory.title}</h2>
          {memory.description && <p>{memory.description}</p>}
        </div>
      </div>
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
    : "Undated";
}
