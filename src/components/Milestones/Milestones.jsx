import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { resolveMediaUrl } from "../../lib/storage";
import { enableMilestonePushNotifications } from "../../lib/pushNotifications";
import { useToasts } from "../../lib/useToasts";
import trackEvent from "../../lib/telemetry";
import "./Milestones.css";

const STATUS = [
  { id: "all", label: "All dreams" },
  { id: "idea", label: "Ideas" },
  { id: "in_progress", label: "In progress" },
  { id: "achieved", label: "Achieved" },
];

export default function Milestones({
  milestones = [],
  milestonePeople = [],
  media = [],
  comments = [],
  contributions = [],
  steps = [],
  reminders = [],
  members = [],
  people = [],
  currentUserId,
  onRefresh,
}) {
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
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    target_date: "",
    personIds: [],
    status: "idea",
    budget_goal: "",
    budget_currency: "EUR",
  });
  const [inspiration, setInspiration] = useState([]); // array of File
  const [inspirationPreviews, setInspirationPreviews] = useState([]); // [{file, preview}]
  const [removingIds, setRemovingIds] = useState([]);
  const [comment, setComment] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [contributionNote, setContributionNote] = useState("");
  const [contributionType, setContributionType] = useState("task");
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionCurrency, setContributionCurrency] = useState("EUR");
  const [stepTitle, setStepTitle] = useState("");
  const [stepSaving, setStepSaving] = useState(false);
  const [budgetGoal, setBudgetGoal] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("EUR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { add: addToast } = useToasts();
  const [pendingUploadRetry, setPendingUploadRetry] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(null);
  const countdownRef = useRef(null);
  const [reminderType, setReminderType] = useState("goal");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [reminderUserId, setReminderUserId] = useState(currentUserId || "");
  const [reminderStepId, setReminderStepId] = useState("");
  const [reminderContributionId, setReminderContributionId] = useState("");
  const [reminderSaving, setReminderSaving] = useState(false);

  const previewsRef = useRef([]);

  useEffect(() => {
    return () => {
      // cleanup any lingering object URLs on unmount
      previewsRef.current.forEach(
        (it) => it.preview && URL.revokeObjectURL(it.preview),
      );
      previewsRef.current = [];
    };
  }, []);

  function removePreview(id) {
    if (!id) return;
    // mark for animation
    setRemovingIds((r) => [...r, id]);
    // schedule actual removal after animation
    setTimeout(() => {
      const idx = previewsRef.current.findIndex((p) => p.id === id);
      const item = idx !== -1 ? previewsRef.current[idx] : null;
      if (item && item.preview) URL.revokeObjectURL(item.preview);
      previewsRef.current = previewsRef.current.filter((p) => p.id !== id);
      setInspirationPreviews(previewsRef.current.slice());
      setInspiration(previewsRef.current.map((p) => p.file));
      setRemovingIds((r) => r.filter((x) => x !== id));
    }, 180);
  }

  useEffect(() => {
    if (
      !reminders.length ||
      typeof window === "undefined" ||
      typeof Notification === "undefined"
    )
      return;
    const due = reminders.filter(
      (r) =>
        !r.completed_at &&
        r.remind_user_id === currentUserId &&
        new Date(r.remind_at) <= new Date(),
    );
    if (!due.length || Notification.permission !== "granted") return;
    due.forEach((r) => {
      const key = `family-archive-reminder-${r.id}-${r.remind_at}`;
      if (window.localStorage.getItem(key)) return;
      new Notification(r.title, {
        body: r.note || "A family milestone reminder is due.",
      });
      window.localStorage.setItem(key, "1");
    });
  }, [reminders, currentUserId]);

  const visible = useMemo(
    () =>
      milestones
        .filter((m) => filter === "all" || m.status === filter)
        .filter((m) =>
          `${m.title} ${m.description || ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          if (filter === "achieved")
            return (
              new Date(b.updated_at || b.created_at) -
              new Date(a.updated_at || a.created_at)
            );
          if (a.status === "in_progress" && b.status !== "in_progress")
            return -1;
          if (b.status === "in_progress" && a.status !== "in_progress")
            return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        }),
    [milestones, filter, query],
  );

  const getPeople = (id) =>
    milestonePeople
      .filter((x) => x.milestone_id === id)
      .map((x) => people.find((p) => p.id === x.person_id))
      .filter(Boolean);
  const getMedia = (id) =>
    media.filter((x) => x.milestone_id === id && x.media_url);
  const getComments = (id) => comments.filter((x) => x.milestone_id === id);
  const getHelps = (id) => contributions.filter((x) => x.milestone_id === id);

  function togglePerson(id) {
    setForm((f) => ({
      ...f,
      personIds: f.personIds.includes(id)
        ? f.personIds.filter((x) => x !== id)
        : [...f.personIds, id],
    }));
  }

  async function createMilestone(e) {
    e.preventDefault();
    if (!form.title.trim()) return setError("Give the plan a name.");
    setSaving(true);
    setError("");
    try {
      const { data, error: insertError } = await supabase
        .from("family_milestones")
        .insert({
          title: form.title.trim(),
          description: form.description.trim() || null,
          target_date: form.target_date || null,
          status: form.status,
          created_by: currentUserId,
          budget_goal: form.budget_goal ? Number(form.budget_goal) : null,
          budget_currency: form.budget_goal ? form.budget_currency : null,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;
      if (form.personIds.length) {
        const { error: peopleError } = await supabase
          .from("milestone_people")
          .insert(
            form.personIds.map((person_id) => ({
              milestone_id: data.id,
              person_id,
              created_by: currentUserId,
            })),
          );
        if (peopleError) throw peopleError;
      }
      for (let i = 0; i < inspiration.length; i++) {
        const file = inspiration[i];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `milestones/${data.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("family-media")
          .upload(path, file);
        if (uploadError) {
          const friendly = mapStorageError(uploadError);
          // If it's a permission/RLS-style error, offer sign-in and retry
          if (
            /storage permissions|permissions|row-level security|forbidden|unauthorized|401|403/i.test(
              friendly,
            )
          ) {
            setPendingUploadRetry({
              milestoneId: data.id,
              files: inspiration.slice(i),
            });
            setError(
              friendly +
                " Click 'Sign in to retry' to authenticate and resume upload.",
            );
            break;
          }
          // other storage errors should surface normally
          throw new Error(friendly);
        }
        const { error: mediaError } = await supabase
          .from("milestone_media")
          .insert({
            milestone_id: data.id,
            media_path: path,
            media_type: file.type.startsWith("video/") ? "video" : "image",
            created_by: currentUserId,
          });
        if (mediaError) throw mediaError;
      }
      setForm({
        title: "",
        description: "",
        target_date: "",
        personIds: [],
        status: "idea",
        budget_goal: "",
        budget_currency: "EUR",
      });
      // cleanup previews
      previewsRef.current.forEach(
        (it) => it.preview && URL.revokeObjectURL(it.preview),
      );
      previewsRef.current = [];
      setInspiration([]);
      setInspirationPreviews([]);
      setShowAdd(false);
      await onRefresh?.();
    } catch (e) {
      const msg = e.message || "Couldn't save the plan.";
      setError(msg);
      try {
        addToast({
          title: "Could not save milestone",
          message: msg,
          type: "error",
        });
      } catch {
        // Toasts are optional UI feedback.
      }
    } finally {
      setSaving(false);
    }
  }

  async function signInAndRetry() {
    // sign in and start a short countdown before retrying uploads
    if (!pendingUploadRetry) return;
    setAuthMessage("");
    setRetrying(true);
    try {
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (signError) {
        setAuthMessage(signError.message || "Could not sign in.");
        trackEvent("milestone.retry.signin_fail", { error: signError.message });
        setRetrying(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAuthMessage("Signed in but user not available yet.");
        setRetrying(false);
        return;
      }
      // start a countdown (5s) to give users a chance to cancel
      setAuthMessage("Signed in. Retrying upload shortly...");
      trackEvent("milestone.retry.scheduled", {
        milestoneId: pendingUploadRetry?.milestoneId,
      });
      setRetryCountdown(5);
      countdownRef.current = setInterval(() => {
        setRetryCountdown((c) => {
          if (c === 1) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
            performRetryUploads();
            return null;
          }
          return c - 1;
        });
      }, 1000);
    } catch (e) {
      setAuthMessage(e.message || "Retry failed.");
      trackEvent("milestone.retry.error", { error: e.message });
      setRetrying(false);
    }
  }

  async function performRetryUploads() {
    if (!pendingUploadRetry) return;
    setRetrying(true);
    setAuthMessage("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authenticated user not found.");
      trackEvent("milestone.retry.start", {
        milestoneId: pendingUploadRetry?.milestoneId,
      });
      const { milestoneId, files } = pendingUploadRetry;
      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `milestones/${milestoneId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("family-media")
          .upload(path, file);
        if (uploadError) throw new Error(mapStorageError(uploadError));
        const { error: mediaError } = await supabase
          .from("milestone_media")
          .insert({
            milestone_id: milestoneId,
            media_path: path,
            media_type: file.type.startsWith("video/") ? "video" : "image",
            created_by: user.id,
          });
        if (mediaError) throw mediaError;
      }
      setPendingUploadRetry(null);
      setAuthMessage("Upload completed successfully.");
      try {
        addToast({
          title: "Upload complete",
          message: "Your inspiration files uploaded.",
          type: "success",
        });
      } catch { /* Toasts are optional UI feedback. */ }
      trackEvent("milestone.retry.success", { milestoneId });
      setAuthEmail("");
      setAuthPassword("");
      await onRefresh?.();
    } catch (e) {
      const msg = e.message || "Retry failed.";
      setAuthMessage(msg);
      try {
        addToast({ title: "Retry failed", message: msg, type: "error" });
      } catch { /* Toasts are optional UI feedback. */ }
      trackEvent("milestone.retry.failure", { error: msg });
    } finally {
      setRetrying(false);
      setRetryCountdown(null);
    }
  }

  useEffect(() => {
    // prefill email if we already have an authenticated user
    let mounted = true;
    async function prefill() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!mounted) return;
        if (user?.email) setAuthEmail(user.email);
      } catch {
        // Optional authentication prefill failed.
      }
    }
    prefill();
    return () => {
      mounted = false;
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, []);

  async function setStatus(milestone, status) {
    const { error: updateError } = await supabase
      .from("family_milestones")
      .update({ status })
      .eq("id", milestone.id);
    if (updateError) setError(updateError.message);
    else {
      await onRefresh?.();
      setSelected((current) =>
        current?.id === milestone.id ? { ...current, status } : current,
      );
    }
  }

  async function addComment(id) {
    if (!comment.trim()) return;
    const { error: commentError } = await supabase
      .from("milestone_comments")
      .insert({
        milestone_id: id,
        body: comment.trim(),
        parent_id: replyTo || null,
        created_by: currentUserId,
      });
    if (commentError) setError(commentError.message);
    else {
      setComment("");
      setReplyTo(null);
      onRefresh?.();
    }
  }

  async function contribute(id) {
    const note =
      contributionNote.trim() ||
      (contributionType === "money"
        ? "I can contribute financially."
        : contributionType === "resource"
          ? "I can contribute a resource."
          : "I can help make this happen.");
    const amount =
      contributionType === "money" && contributionAmount
        ? Number(contributionAmount)
        : null;
    const { error: contributionError } = await supabase
      .from("milestone_contributions")
      .insert({
        milestone_id: id,
        note,
        contribution_type: contributionType,
        amount: amount && Number.isFinite(amount) ? amount : null,
        currency: amount ? contributionCurrency : null,
        created_by: currentUserId,
      });
    if (contributionError) setError(contributionError.message);
    else {
      setContributionNote("");
      setContributionAmount("");
      setContributionType("task");
      onRefresh?.();
    }
  }

  async function addStep(id) {
    if (!stepTitle.trim()) return;
    setStepSaving(true);
    const { error: stepError } = await supabase.from("milestone_steps").insert({
      milestone_id: id,
      title: stepTitle.trim(),
      created_by: currentUserId,
    });
    setStepSaving(false);
    if (stepError) setError(stepError.message);
    else {
      setStepTitle("");
      onRefresh?.();
    }
  }

  async function toggleStep(step) {
    const next = step.status === "done" ? "todo" : "done";
    const { error: stepError } = await supabase
      .from("milestone_steps")
      .update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      })
      .eq("id", step.id);
    if (stepError) setError(stepError.message);
    else onRefresh?.();
  }

  async function updateBudget(id, goal, currency) {
    const { error: budgetError } = await supabase
      .from("family_milestones")
      .update({
        budget_goal: goal ? Number(goal) : null,
        budget_currency: goal ? currency : null,
      })
      .eq("id", id);
    if (budgetError) setError(budgetError.message);
    else {
      onRefresh?.();
      setSelected((current) =>
        current?.id === id
          ? {
              ...current,
              budget_goal: goal ? Number(goal) : null,
              budget_currency: goal ? currency : null,
            }
          : current,
      );
    }
  }

  async function addReminder(id) {
    if (!reminderTitle.trim() || !reminderAt || !reminderUserId) {
      setError("Choose who should be reminded, what about, and when.");
      return;
    }
    setReminderSaving(true);
    setError("");
    const { error: reminderError } = await supabase
      .from("milestone_reminders")
      .insert({
        milestone_id: id,
        step_id:
          reminderType === "step" && reminderStepId ? reminderStepId : null,
        contribution_id:
          reminderType === "contribution" && reminderContributionId
            ? reminderContributionId
            : null,
        reminder_type: reminderType,
        title: reminderTitle.trim(),
        note: reminderNote.trim() || null,
        remind_at: new Date(reminderAt).toISOString(),
        remind_user_id: reminderUserId,
        created_by: currentUserId,
      });
    setReminderSaving(false);
    if (reminderError) setError(reminderError.message);
    else {
      setReminderTitle("");
      setReminderNote("");
      setReminderAt("");
      setReminderType("goal");
      setReminderStepId("");
      setReminderContributionId("");
      await onRefresh?.();
    }
  }

  async function completeReminder(reminder) {
    const { error: reminderError } = await supabase
      .from("milestone_reminders")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", reminder.id);
    if (reminderError) setError(reminderError.message);
    else onRefresh?.();
  }

  async function deleteReminder(reminder) {
    const { error: reminderError } = await supabase
      .from("milestone_reminders")
      .delete()
      .eq("id", reminder.id);
    if (reminderError) setError(reminderError.message);
    else onRefresh?.();
  }

  async function requestNotifications() {
    try {
      await enableMilestonePushNotifications(currentUserId);
      setError("");
      onRefresh?.();
    } catch (notificationError) {
      setError(
        notificationError?.message || "Could not enable push reminders.",
      );
    }
  }

  const selectedPeople = selected ? getPeople(selected.id) : [];
  const selectedMedia = selected ? getMedia(selected.id) : [];

  const [mediaUrls, setMediaUrls] = useState({});

  useEffect(() => {
    let mounted = true;
    async function hydrateSelectedMedia() {
      if (!selected) return;
      const items = getMedia(selected.id) || [];
      const updates = {};
      await Promise.all(
        items.map(async (it) => {
          try {
            // prefer existing absolute urls, otherwise resolve storage path
            const candidate = it.media_url || it.media_path || it.media_path;
            if (!candidate) return;
            // avoid re-resolving if we already have it
            if (mediaUrls[it.id]) return;
            const url = await resolveMediaUrl(candidate);
            if (mounted && url) updates[it.id] = url;
          } catch {
            // Ignore one failed media item and keep the rest visible.
          }
        }),
      );
      if (mounted && Object.keys(updates).length) {
        setMediaUrls((cur) => ({ ...cur, ...updates }));
      }
    }
    hydrateSelectedMedia();
    return () => {
      mounted = false;
    };
  // getMedia/mediaUrls are intentionally read from the current render snapshot for selected media hydration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, media]);
  const selectedComments = selected ? getComments(selected.id) : [];
  const selectedHelps = selected ? getHelps(selected.id) : [];
  const selectedSteps = selected
    ? steps
        .filter((x) => x.milestone_id === selected.id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    : [];
  const moneyRaised = selectedHelps
    .filter(
      (x) =>
        x.contribution_type === "money" &&
        Number(x.amount) > 0 &&
        (x.currency || "EUR") === (selected?.budget_currency || "EUR"),
    )
    .reduce((sum, x) => sum + Number(x.amount), 0);
  const budgetGoalValue = Number(selected?.budget_goal || 0);
  const budgetPercent = budgetGoalValue
    ? Math.min(100, Math.round((moneyRaised / budgetGoalValue) * 100))
    : 0;
  const completedSteps = selectedSteps.filter(
    (x) => x.status === "done",
  ).length;
  const stepsPercent = selectedSteps.length
    ? Math.round((completedSteps / selectedSteps.length) * 100)
    : 0;
  const selectedReminders = selected
    ? reminders
        .filter((x) => x.milestone_id === selected.id)
        .sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at))
    : [];
  const dueReminders = reminders
    .filter(
      (r) =>
        !r.completed_at &&
        r.remind_user_id === currentUserId &&
        new Date(r.remind_at) <= new Date(),
    )
    .sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at));
  const upcomingReminders = reminders
    .filter(
      (r) =>
        !r.completed_at &&
        r.remind_user_id === currentUserId &&
        new Date(r.remind_at) > new Date(),
    )
    .sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at))
    .slice(0, 3);

  // Touch variables and functions that are intentionally used in UI sections
  // (some UI blocks were kept compact during edits). These no-op touches
  // prevent ESLint `no-unused-vars` errors while retaining the real usage
  // in the rendered JSX above and below.
  void members;
  void setContributionCurrency;
  void stepSaving;
  void budgetGoal;
  void setBudgetGoal;
  void budgetCurrency;
  void setBudgetCurrency;
  void setReminderUserId;
  void reminderSaving;
  void setStatus;
  void addComment;
  void contribute;
  void addStep;
  void toggleStep;
  void updateBudget;
  void addReminder;
  void completeReminder;
  void deleteReminder;
  void requestNotifications;
  void selectedComments;
  void budgetPercent;
  void stepsPercent;
  void selectedReminders;
  void formatDateTime;
  void formatReminderDate;

  return (
    <div className="page milestones-page">
      <header className="milestones-hero">
        <div>
          <span className="eyebrow">THE BIG MOMENTS</span>
          <h1>Milestones</h1>
          <p>The things we’re dreaming of, planning, and working toward.</p>
        </div>
        <button
          className="milestone-add-button"
          onClick={() => {
            setError("");
            setShowAdd(true);
          }}
        >
          ＋ Add milestone
        </button>
      </header>

      <div className="milestones-toolbar">
        <div
          className="milestone-filters"
          role="tablist"
          aria-label="Milestone status"
        >
          {STATUS.map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? "active" : ""}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span>
                {item.id === "all"
                  ? milestones.length
                  : milestones.filter((m) => m.status === item.id).length}
              </span>
            </button>
          ))}
        </div>
        <label className="milestone-search">
          <span>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dreams..."
          />
        </label>
      </div>

      {(dueReminders.length > 0 || upcomingReminders.length > 0) && (
        <section className="reminder-center">
          <div className="reminder-center-copy">
            <span className="eyebrow">YOUR REMINDERS</span>
            <h3>
              {dueReminders.length
                ? `${dueReminders.length} reminder${dueReminders.length === 1 ? "" : "s"} due`
                : "Keep the plans moving"}
            </h3>
            <p>
              {dueReminders.length
                ? "A family plan needs your attention."
                : "Your next milestone reminders are lined up."}
            </p>
          </div>
          <div className="reminder-center-list">
            {dueReminders.slice(0, 2).map((r) => (
              <div className="reminder-chip due" key={r.id}>
                <span>⏰</span>
                <div>
                  <strong>{r.title}</strong>
                  <small>{formatReminderDate(r.remind_at)}</small>
                </div>
                <button onClick={() => completeReminder(r)}>Done</button>
              </div>
            ))}
            {!dueReminders.length &&
              upcomingReminders.map((r) => (
                <div className="reminder-chip" key={r.id}>
                  <span>◷</span>
                  <div>
                    <strong>{r.title}</strong>
                    <small>{formatReminderDate(r.remind_at)}</small>
                  </div>
                </div>
              ))}
          </div>
          <button
            className="notification-button"
            onClick={requestNotifications}
          >
            Enable browser reminders
          </button>
        </section>
      )}

      {visible.length ? (
        <div className="milestone-masonry">
          {visible.map((m, index) => {
            const tagged = getPeople(m.id);
            const pics = getMedia(m.id);
            const cmts = getComments(m.id);
            const helps = getHelps(m.id);
            return (
              <article
                className={`future-card status-${m.status} card-${index % 5}`}
                key={m.id}
                onClick={() => setSelected(m)}
              >
                {pics.length ? (
                  <div className="future-media">
                    {pics[0].media_type === "video" ? (
                      <video src={pics[0].media_url} muted playsInline />
                    ) : (
                      <img src={pics[0].media_url} alt="" />
                    )}
                    {pics.length > 1 && (
                      <span className="media-count">＋{pics.length - 1}</span>
                    )}
                  </div>
                ) : (
                  <div className="future-media future-paper">
                    <span>✦</span>
                    <small>IMAGINE IT</small>
                  </div>
                )}
                <div className="future-content">
                  <div className="future-meta">
                    <span className={`future-status ${m.status}`}>
                      {statusLabel(m.status)}
                    </span>
                    {m.target_date && (
                      <span>by {formatDate(m.target_date)}</span>
                    )}
                  </div>
                  <h2>{m.title}</h2>
                  {m.description && <p>{m.description}</p>}
                  {tagged.length > 0 && (
                    <div className="future-people">
                      {tagged.slice(0, 3).map((p) => (
                        <span key={p.id}>
                          ● {p.preferred_name || p.full_name}
                        </span>
                      ))}
                      {tagged.length > 3 && <span>+{tagged.length - 3}</span>}
                    </div>
                  )}
                  <div className="future-footer">
                    <span>💬 {cmts.length}</span>
                    <span>🤝 {helps.length}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(m);
                      }}
                    >
                      Open dream →
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="future-empty">
          <div className="future-empty-art">✦</div>
          <span className="eyebrow">A BLANK BOARD</span>
          <h2>No milestones yet</h2>
          <p>
            Create your first milestone and start building dreams for yourself
            and your loved ones.
          </p>
          <button
            className="milestone-add-button"
            onClick={() => setShowAdd(true)}
          >
            ＋ Create your first milestone
          </button>
        </div>
      )}

      {error && <div className="milestone-error">{error}</div>}

      {pendingUploadRetry && (
        <div className="milestone-auth-retry">
          <p>
            To finish uploading your inspiration files we need you to sign in.
          </p>
          <div className="auth-retry-fields">
            <input
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />
            <input
              placeholder="Password"
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />
            {!retryCountdown ? (
              <button onClick={signInAndRetry} disabled={retrying}>
                {retrying ? "Signing in…" : "Sign in & resume upload"}
              </button>
            ) : (
              <button disabled>Retrying in {retryCountdown}s…</button>
            )}
            <button
              className="quiet-action"
              onClick={() => {
                if (countdownRef.current) {
                  clearInterval(countdownRef.current);
                  countdownRef.current = null;
                }
                setPendingUploadRetry(null);
                setRetryCountdown(null);
                setAuthMessage("");
              }}
            >
              Cancel
            </button>
          </div>
          {authMessage && <div className="auth-message">{authMessage}</div>}
        </div>
      )}

      {selected && (
        <div
          className="future-detail-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <aside className="future-detail" aria-label="Milestone details">
            <button
              className="milestone-close"
              onClick={() => setSelected(null)}
            >
              ×
            </button>
            <div className="future-detail-head">
              <span className={`future-status ${selected.status}`}>
                {statusLabel(selected.status)}
              </span>
              {selected.target_date && (
                <span>Target {formatDate(selected.target_date)}</span>
              )}
            </div>
            <h2>{selected.title}</h2>
            {selected.description && (
              <p className="future-detail-description">
                {selected.description}
              </p>
            )}
            {selectedPeople.length > 0 && (
              <div className="future-detail-people">
                {selectedPeople.map((p) => (
                  <span key={p.id}>👤 {p.preferred_name || p.full_name}</span>
                ))}
              </div>
            )}
            {selectedMedia.length > 0 && (
              <div className="future-detail-gallery">
                {selectedMedia.map((item) =>
                  item.media_type === "video" ? (
                    <video
                      key={item.id}
                      src={item.media_url}
                      controls
                      playsInline
                    />
                  ) : (
                    <img key={item.id} src={item.media_url} alt="Inspiration" />
                  ),
                )}
              </div>
            )}
            <section className="future-detail-progress">
              <div className="progress-heading">
                <div>
                  <span>Progress</span>
                  <strong>
                    {selectedSteps.length
                      ? `${stepsPercent}% complete`
                      : statusLabel(selected.status)}
                  </strong>
                </div>
                <button
                  className="quiet-action"
                  onClick={() =>
                    setStatus(
                      selected,
                      selected.status === "idea" ? "in_progress" : "achieved",
                    )
                  }
                >
                  {selected.status === "achieved"
                    ? "Reopen"
                    : selected.status === "idea"
                      ? "Start progress"
                      : "Mark achieved"}
                </button>
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: `${selectedSteps.length ? stepsPercent : selected.status === "achieved" ? 100 : selected.status === "in_progress" ? 55 : 12}%`,
                  }}
                />
              </div>
              <div className="steps-panel">
                <div className="discussion-heading">
                  <div>
                    <span className="eyebrow">TURN THE DREAM INTO STEPS</span>
                    <h3>Plan together</h3>
                  </div>
                  <span>
                    {completedSteps}/{selectedSteps.length}
                  </span>
                </div>
                {selectedSteps.length > 0 && (
                  <div className="step-list">
                    {selectedSteps.map((step) => (
                      <label
                        className={`step-row ${step.status === "done" ? "done" : ""}`}
                        key={step.id}
                      >
                        <input
                          type="checkbox"
                          checked={step.status === "done"}
                          onChange={() => toggleStep(step)}
                        />
                        <span>{step.title}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="step-add">
                  <input
                    value={stepTitle}
                    onChange={(e) => setStepTitle(e.target.value)}
                    placeholder="Add the next step..."
                    onKeyDown={(e) => e.key === "Enter" && addStep(selected.id)}
                  />
                  <button
                    onClick={() => addStep(selected.id)}
                    disabled={stepSaving}
                  >
                    {stepSaving ? "Adding..." : "Add step"}
                  </button>
                </div>
              </div>
            </section>

            <section className="future-budget">
              <div className="discussion-heading">
                <div>
                  <span className="eyebrow">SHARED BUDGET</span>
                  <h3>Help fund the dream</h3>
                </div>
                <span>
                  {selected.budget_goal ? `${budgetPercent}%` : "Optional"}
                </span>
              </div>
              {selected.budget_goal ? (
                <>
                  <div className="budget-amounts">
                    <strong>
                      {selected.budget_currency || "EUR"}{" "}
                      {moneyRaised.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                    <span>
                      of {selected.budget_currency || "EUR"}{" "}
                      {Number(selected.budget_goal).toLocaleString()}
                    </span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: `${budgetPercent}%` }} />
                  </div>
                  <p className="budget-note">
                    {budgetPercent >= 100
                      ? "The family goal has been reached."
                      : `${selected.budget_currency || "EUR"}${Math.max(0, Number(selected.budget_goal) - moneyRaised).toLocaleString()} still to go.`}
                  </p>
                </>
              ) : (
                <p className="budget-note">
                  Set a target amount if this dream needs a shared family
                  budget. Money contributions will count automatically.
                </p>
              )}
              <div className="budget-editor">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={budgetGoal}
                  onChange={(e) => setBudgetGoal(e.target.value)}
                  placeholder={
                    selected.budget_goal
                      ? String(selected.budget_goal)
                      : "Budget target"
                  }
                />
                <select
                  value={budgetCurrency}
                  onChange={(e) => setBudgetCurrency(e.target.value)}
                >
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>USD</option>
                </select>
                <button
                  onClick={() =>
                    updateBudget(selected.id, budgetGoal, budgetCurrency)
                  }
                >
                  Save target
                </button>
              </div>
            </section>

            <div className="future-progress-actions">
              <button onClick={() => contribute(selected.id)}>
                🤝 I can help
              </button>
            </div>

            <section className="future-reminders">
              <div className="discussion-heading">
                <div>
                  <span className="eyebrow">KEEP IT MOVING</span>
                  <h3>Deadlines & reminders</h3>
                </div>
                <span>
                  {selectedReminders.filter((r) => !r.completed_at).length}
                </span>
              </div>
              <p className="contribution-intro">
                Remind yourself or another family member about a goal, a plan
                step, or a contribution.
              </p>
              {selected.target_date && (
                <button
                  className="deadline-reminder"
                  onClick={() => {
                    setReminderType("goal");
                    setReminderTitle(`Goal deadline: ${selected.title}`);
                    setReminderNote(
                      `The target date for this family plan is ${formatDate(selected.target_date)}.`,
                    );
                    setReminderAt(`${selected.target_date}T09:00`);
                    setReminderUserId(currentUserId);
                  }}
                >
                  ＋ Remind me about the goal deadline
                </button>
              )}
              {selectedReminders.length > 0 && (
                <div className="reminder-list">
                  {selectedReminders.map((r) => (
                    <div
                      className={`reminder-row ${r.completed_at ? "complete" : new Date(r.remind_at) <= new Date() ? "due" : ""}`}
                      key={r.id}
                    >
                      <span className="reminder-icon">
                        {r.completed_at
                          ? "✓"
                          : r.reminder_type === "contribution"
                            ? "🤝"
                            : r.reminder_type === "step"
                              ? "☑"
                              : "⏰"}
                      </span>
                      <div>
                        <strong>{r.title}</strong>
                        <p>{r.note || "Milestone reminder"}</p>
                        <small>
                          {r.completed_at
                            ? "Completed"
                            : formatReminderDate(r.remind_at)}
                        </small>
                      </div>
                      {!r.completed_at &&
                        (r.remind_user_id === currentUserId ||
                          r.created_by === currentUserId) && (
                          <button onClick={() => completeReminder(r)}>
                            Done
                          </button>
                        )}
                      {(r.remind_user_id === currentUserId ||
                        r.created_by === currentUserId) && (
                        <button
                          className="quiet-action"
                          onClick={() => deleteReminder(r)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="reminder-form">
                <div className="form-grid">
                  <label>
                    Remind{" "}
                    <select
                      value={reminderUserId}
                      onChange={(e) => setReminderUserId(e.target.value)}
                    >
                      <option value="">Choose a family member</option>
                      {members
                        .filter((m) => m.status === "approved")
                        .map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.full_name || m.email || "Family member"}
                            {m.user_id === currentUserId ? " (me)" : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    About{" "}
                    <select
                      value={reminderType}
                      onChange={(e) => setReminderType(e.target.value)}
                    >
                      <option value="goal">Goal / deadline</option>
                      <option value="step">Plan step</option>
                      <option value="contribution">Contribution</option>
                      <option value="custom">Something else</option>
                    </select>
                  </label>
                </div>
                {reminderType === "step" && (
                  <label>
                    Plan step
                    <select
                      value={reminderStepId}
                      onChange={(e) => setReminderStepId(e.target.value)}
                    >
                      <option value="">Choose a step</option>
                      {selectedSteps.map((step) => (
                        <option key={step.id} value={step.id}>
                          {step.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {reminderType === "contribution" && (
                  <label>
                    Contribution
                    <select
                      value={reminderContributionId}
                      onChange={(e) =>
                        setReminderContributionId(e.target.value)
                      }
                    >
                      <option value="">Choose a contribution</option>
                      {selectedHelps.map((help) => (
                        <option key={help.id} value={help.id}>
                          {help.note || "Family contribution"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="form-grid">
                  <label>
                    Reminder title
                    <input
                      value={reminderTitle}
                      onChange={(e) => setReminderTitle(e.target.value)}
                      placeholder="Book the accommodation"
                    />
                  </label>
                  <label>
                    When
                    <input
                      type="datetime-local"
                      value={reminderAt}
                      onChange={(e) => setReminderAt(e.target.value)}
                    />
                  </label>
                </div>
                <input
                  value={reminderNote}
                  onChange={(e) => setReminderNote(e.target.value)}
                  placeholder="Optional note for the person being reminded"
                />
                <div className="reminder-actions">
                  <button
                    onClick={() => addReminder(selected.id)}
                    disabled={reminderSaving}
                  >
                    {reminderSaving ? "Saving..." : "Set reminder"}
                  </button>
                  <button
                    className="quiet-action"
                    onClick={requestNotifications}
                  >
                    Enable browser notifications
                  </button>
                </div>
              </div>
            </section>

            <section className="future-discussion">
              <div className="discussion-heading">
                <div>
                  <span className="eyebrow">FAMILY VOICES</span>
                  <h3>Ideas & replies</h3>
                </div>
                <span>{selectedComments.length}</span>
              </div>
              {selectedComments
                .filter((c) => !c.parent_id)
                .map((c) => {
                  const replies = selectedComments.filter(
                    (reply) => reply.parent_id === c.id,
                  );
                  return (
                    <div className="future-thread" key={c.id}>
                      <div className="future-comment">
                        <div className="comment-avatar">♡</div>
                        <div className="comment-body">
                          <strong>Family member</strong>
                          <p>{c.body}</p>
                          <small>{formatDateTime(c.created_at)}</small>
                          <button
                            className="reply-link"
                            onClick={() => {
                              setReplyTo(c.id);
                              setComment("");
                            }}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                      {replies.map((reply) => (
                        <div
                          className="future-comment future-reply"
                          key={reply.id}
                        >
                          <div className="comment-avatar">↳</div>
                          <div className="comment-body">
                            <strong>Family member</strong>
                            <p>{reply.body}</p>
                            <small>{formatDateTime(reply.created_at)}</small>
                          </div>
                        </div>
                      ))}{" "}
                    </div>
                  );
                })}
              {selectedComments.length === 0 && (
                <div className="discussion-empty">
                  <span>♡</span>
                  <p>
                    Be the first family voice. Add encouragement, an idea, or a
                    helpful suggestion.
                  </p>
                </div>
              )}
              {replyTo && (
                <div className="replying-to">
                  <span>Replying to a family member</span>
                  <button onClick={() => setReplyTo(null)}>Cancel</button>
                </div>
              )}
              <div className="future-comment-form">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    replyTo
                      ? "Write a reply..."
                      : "Add an idea, encouragement or reply..."
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" && addComment(selected.id)
                  }
                />
                <button onClick={() => addComment(selected.id)}>
                  {replyTo ? "Reply" : "Send"}
                </button>
              </div>
            </section>

            <section className="future-contributions">
              <div className="discussion-heading">
                <div>
                  <span className="eyebrow">MAKE IT REAL</span>
                  <h3>Family contributions</h3>
                </div>
                <span>{selectedHelps.length}</span>
              </div>
              <p className="contribution-intro">
                Small offers of help can turn a family dream into something
                real.
              </p>
              {selectedHelps.length > 0 && (
                <div className="contribution-list">
                  {selectedHelps.map((help) => (
                    <div className="contribution-item" key={help.id}>
                      <span className="contribution-avatar">
                        {help.contribution_type === "money"
                          ? "€"
                          : help.contribution_type === "resource"
                            ? "📦"
                            : "🤝"}
                      </span>
                      <div>
                        <div className="contribution-topline">
                          <strong>Family member</strong>
                          <span>
                            {help.contribution_type === "money"
                              ? "Money"
                              : help.contribution_type === "resource"
                                ? "Resource"
                                : "Task / time"}
                          </span>
                        </div>
                        <p>{help.note || "I can help make this happen."}</p>
                        {help.amount && (
                          <strong className="contribution-amount">
                            {help.currency || "EUR"}{" "}
                            {Number(help.amount).toLocaleString()}
                          </strong>
                        )}
                        <small>{formatDateTime(help.created_at)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="contribution-form">
                <div className="contribution-types">
                  {["task", "money", "resource"].map((type) => (
                    <button
                      type="button"
                      key={type}
                      className={contributionType === type ? "active" : ""}
                      onClick={() => setContributionType(type)}
                    >
                      {type === "task"
                        ? "🕒 Time / task"
                        : type === "money"
                          ? "€ Money"
                          : "📦 Resource"}
                    </button>
                  ))}
                </div>
                {contributionType === "money" && (
                  <div className="money-row">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={contributionAmount}
                      onChange={(e) => setContributionAmount(e.target.value)}
                      placeholder="Amount"
                    />
                    <select
                      value={contributionCurrency}
                      onChange={(e) => setContributionCurrency(e.target.value)}
                    >
                      <option>EUR</option>
                      <option>GBP</option>
                      <option>USD</option>
                    </select>
                  </div>
                )}
                <input
                  value={contributionNote}
                  onChange={(e) => setContributionNote(e.target.value)}
                  placeholder={
                    contributionType === "money"
                      ? "What will you cover?"
                      : contributionType === "resource"
                        ? "What can you provide?"
                        : "What can you do? (e.g. organize, drive, book)"
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" && contribute(selected.id)
                  }
                />
                <button onClick={() => contribute(selected.id)}>
                  Add contribution
                </button>
              </div>
            </section>
          </aside>
        </div>
      )}

      {showAdd && (
        <div
          className="milestone-modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setShowAdd(false)}
        >
          <form className="milestone-modal" onSubmit={createMilestone}>
            <button
              type="button"
              className="milestone-close"
              onClick={() => setShowAdd(false)}
            >
              ×
            </button>
            <span className="eyebrow">PIN A FUTURE</span>
            <h2>What should we build next?</h2>
            <label>
              Plan or dream
              <input
                autoFocus
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Family trip to Italy"
              />
            </label>
            <label>
              Tell the family more
              <textarea
                rows="5"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Why does this matter? What would make it happen?"
              />
            </label>
            <div className="form-grid">
              <label>
                Target date
                <input
                  type="date"
                  value={form.target_date}
                  onChange={(e) =>
                    setForm({ ...form, target_date: e.target.value })
                  }
                />
              </label>
              <label>
                Starting point
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="idea">Just an idea</option>
                  <option value="in_progress">Already in progress</option>
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label>
                Optional family budget
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget_goal}
                  onChange={(e) =>
                    setForm({ ...form, budget_goal: e.target.value })
                  }
                  placeholder="e.g. 2500"
                />
              </label>
              <label>
                Currency
                <select
                  value={form.budget_currency}
                  onChange={(e) =>
                    setForm({ ...form, budget_currency: e.target.value })
                  }
                >
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>USD</option>
                </select>
              </label>
            </div>

            <label>
              Inspiration photos or videos
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  // revoke previous previews
                  previewsRef.current.forEach(
                    (it) => it.preview && URL.revokeObjectURL(it.preview),
                  );
                  const items = files.map((file) => ({
                    id: crypto.randomUUID(),
                    file,
                    preview: URL.createObjectURL(file),
                  }));
                  previewsRef.current = items;
                  setInspiration(files);
                  setInspirationPreviews(items);
                }}
              />
            </label>

            {inspirationPreviews.length > 0 && (
              <div className="upload-chips">
                {inspirationPreviews.map((it) => (
                  <div
                    key={it.id}
                    className={`upload-chip ${removingIds.includes(it.id) ? "removing" : ""}`}
                  >
                    {it.file.type.startsWith("video/") ? (
                      <video src={it.preview} muted playsInline width={80} />
                    ) : (
                      <img src={it.preview} alt={it.file.name} width={80} />
                    )}
                    <small>{it.file.name}</small>
                    <button type="button" onClick={() => removePreview(it.id)}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <strong>Attach this dream to</strong>
              <div className="person-picker">
                {people.map((p) => (
                  <button
                    type="button"
                    className={form.personIds.includes(p.id) ? "picked" : ""}
                    key={p.id}
                    onClick={() => togglePerson(p.id)}
                  >
                    {p.preferred_name || p.full_name}
                  </button>
                ))}
              </div>
            </div>

            <p className="milestone-modal-note">
              Text-only plans are welcome. Inspiration is optional, and the
              family can keep adding to the dream later.
            </p>
            {error && <div className="milestone-error">{error}</div>}
            <div className="milestone-modal-actions">
              <button type="button" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button className="milestone-save" disabled={saving}>
                {saving ? "Saving..." : "Pin to our future"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function statusLabel(status) {
  return status === "in_progress"
    ? "In progress"
    : status === "achieved"
      ? "Achieved"
      : "An idea";
}
function formatDate(v) {
  return new Date(`${v}T12:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function formatDateTime(v) {
  return new Date(v).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function formatReminderDate(v) {
  return new Date(v).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
