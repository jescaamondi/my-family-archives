import { useMemo, useState } from "react";
import "./FamilyActivity.css";

const FILTERS = [
  ["all", "All"],
  ["for_you", "For you"],
  ["milestone", "Milestones"],
  ["memory", "Memories"],
  ["story", "Stories"],
  ["reminder", "Reminders"],
];

export default function FamilyActivity({
  memories = [],
  milestones = [],
  stories = [],
  comments = [],
  contributions = [],
  reminders = [],
  members = [],
  currentUserId,
  onNavigate,
}) {
  const [filter, setFilter] = useState("all");

  const names = useMemo(() => {
    const map = new Map();
    members.forEach((member) =>
      map.set(
        member.user_id,
        member.full_name || member.email || "Family member",
      ),
    );
    return map;
  }, [members]);

  const activity = useMemo(() => {
    const events = [];
    const actor = (id) =>
      id === currentUserId ? "You" : names.get(id) || "A family member";
    const push = (item) => events.push(item);

    memories.forEach((memory) =>
      push({
        id: `memory-${memory.id}`,
        type: "memory",
        date: memory.created_at || memory.date,
        actor: actor(memory.created_by),
        title: memory.title || "A family memory",
        body: memory.description || "A new memory was added to the archive.",
        action: "View memories",
        target: "gallery",
        count: 1,
        media: memory.media_url || memory.cover_url || null,
      }),
    );

    milestones.forEach((milestone) =>
      push({
        id: `milestone-${milestone.id}`,
        type: "milestone",
        date: milestone.created_at,
        actor: actor(milestone.created_by),
        title: milestone.title,
        body:
          milestone.description ||
          "A new family plan was pinned to the future board.",
        action: "View milestone",
        target: "milestones",
        milestoneId: milestone.id,
        progress:
          milestone.status === "achieved"
            ? 100
            : milestone.status === "in_progress"
              ? 55
              : 12,
        target_date: milestone.target_date,
      }),
    );

    stories.forEach((story) =>
      push({
        id: `story-${story.id}`,
        type: "story",
        date: story.created_at,
        actor: actor(story.created_by),
        title: story.title || "A new family story",
        body: story.body || "A new story was added to the archive.",
        action: "Read story",
        target: "stories",
      }),
    );

    comments.forEach((comment) =>
      push({
        id: `comment-${comment.id}`,
        type: "milestone",
        date: comment.created_at,
        actor: actor(comment.created_by),
        title: "replied to a milestone",
        body: comment.body,
        action: "Open discussion",
        target: "milestones",
        milestoneId: comment.milestone_id,
      }),
    );

    contributions.forEach((contribution) =>
      push({
        id: `contribution-${contribution.id}`,
        type: "milestone",
        date: contribution.created_at,
        actor: actor(contribution.created_by),
        title: "offered to help with a milestone",
        body: contribution.note || "A family member offered a contribution.",
        action: "View milestone",
      }),
    );

    reminders.forEach((reminder) =>
      push({
        id: `reminder-${reminder.id}`,
        type: "reminder",
        date: reminder.remind_at,
        actor: actor(reminder.created_by),
        title: reminder.title || "Milestone reminder",
        body: reminder.note || "A family plan has a reminder coming up.",
        action: "View reminder",
        target: "milestones",
        milestoneId: reminder.milestone_id,
        due:
          !reminder.completed_at && new Date(reminder.remind_at) <= new Date(),
      }),
    );

    return events
      .filter((event) => event.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [
    memories,
    milestones,
    stories,
    comments,
    contributions,
    reminders,
    names,
    currentUserId,
  ]);

  const visible = activity.filter((item) => {
    if (filter === "all") return true;
    if (filter === "for_you")
      return item.actor === "You" || item.type === "reminder";
    return item.type === filter;
  });

  const formatTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="page activity-page">
      <header className="activity-header">
        <div>
          <span className="eyebrow">TOGETHER, OVER TIME</span>
          <h1>Family Activity</h1>
          <p>
            A living stream of the memories, dreams, stories and little acts of
            care happening across your archive.
          </p>
        </div>
      </header>

      <div className="activity-tabs" role="tablist">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            className={filter === id ? "active" : ""}
            onClick={() => setFilter(id)}
          >
            {label}
            {id === "all" && <span>{activity.length}</span>}
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="activity-feed">
          {visible.map((item) => (
            <article
              className={`activity-card activity-${item.type}`}
              key={item.id}
            >
              <div className="activity-card-head">
                <div className="activity-avatar">
                  {item.type === "memory"
                    ? "▧"
                    : item.type === "milestone"
                      ? "✦"
                      : item.type === "story"
                        ? "▤"
                        : "◷"}
                </div>
                <div className="activity-head-copy">
                  <strong>
                    {item.actor}{" "}
                    {item.type === "memory" ? "added a memory" : item.title}
                  </strong>
                  <small>{formatTime(item.date)}</small>
                </div>
                <span className="activity-dot">•</span>
              </div>
              <div className="activity-body">
                <h2>
                  {item.type === "memory" || item.type === "story"
                    ? item.title
                    : item.title}
                </h2>
                <p>{item.body}</p>
                {item.media && (
                  <img
                    src={item.media}
                    alt="Family archive"
                    className="activity-media"
                  />
                )}
                {item.type === "milestone" && item.progress !== undefined && (
                  <div className="activity-progress">
                    <div>
                      <span>{item.progress}% complete</span>
                      <span>
                        {item.target_date
                          ? `Target: ${formatTime(item.target_date)}`
                          : "Family plan"}
                      </span>
                    </div>
                    <span className="activity-progress-track">
                      <i style={{ width: `${item.progress}%` }} />
                    </span>
                  </div>
                )}
              </div>
              <footer className="activity-card-footer">
                <div className="activity-reactions">
                  <span>♡</span>
                  <span>◌</span>
                  <span>✦</span>
                </div>
                <button
                  onClick={() =>
                    onNavigate?.(item.target || "activity", item.milestoneId)
                  }
                >
                  {item.action}
                </button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="activity-empty">
          <span>✦</span>
          <h2>Your family activity will appear here</h2>
          <p>
            When someone adds a memory, story, milestone, contribution or
            reminder, it will show up in this shared stream.
          </p>
        </div>
      )}
    </div>
  );
}
