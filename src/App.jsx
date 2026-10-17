import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { resolveMediaUrl } from "./lib/storage";

import Home from "./components/Home/Home";
import Timeline from "./components/Timeline/Timeline";
import Gallery from "./components/Gallery/Gallery";
import Stories from "./components/Stories/Stories";
import FamilyTree from "./components/FamilyTree/FamilyTree";
import Milestones from "./components/Milestones/Milestones";
import AddMemory from "./components/AddMemory/AddMemory";
import Auth from "./components/Auth";
import FamilyMembers from "./components/FamilyMembers/FamilyMembers";
import NotificationCenter from "./components/NotificationCenter/NotificationCenter";
import FamilyActivity from "./components/FamilyActivity/FamilyActivity";
import Profile from "./components/Profile/Profile";
import { ToastProvider } from "./lib/toast";

import "./App.css";

const MEMORIES_PAGE_SIZE = 24;

async function hydrateMemories(rows) {
  return Promise.all(
    (rows || []).map(async (memory) => {
      if (!memory.media_url) {
        return memory;
      }
      try {
        return {
          ...memory,
          media_url: await resolveMediaUrl(memory.media_url),
        };
      } catch (e) {
        console.error("Could not resolve media url for memory media", e);
        return memory;
      }
    }),
  );
}

function memoriesQuery() {
  return supabase
    .from("memories")
    .select("*")
    .order("date", { ascending: false })
    .order("id", { ascending: false });
}

/* =========================================================
   NAVIGATION
========================================================= */

const NAV = [
  ["home", "Home", "⌂"],
  ["timeline", "Timeline", "◷"],
  ["gallery", "Gallery", "▧"],
  ["stories", "Stories", "▤"],
  ["tree", "Family tree", "♧"],
  ["milestones", "Milestones", "✦"],
  ["activity", "Family Activity", "◉"],
];

export default function App() {
  /* =======================================================
     AUTH / APP STATE
  ======================================================= */

  const [session, setSession] = useState(null);

  const [screen, setScreen] = useState(() => {
    const requestedScreen = new URLSearchParams(window.location.search).get(
      "screen",
    );
    return requestedScreen || "home";
  });

  const [memories, setMemories] = useState([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [loadingMoreMemories, setLoadingMoreMemories] = useState(false);
  const [hasMoreMemories, setHasMoreMemories] = useState(false);
  const memoriesLoadedRef = useRef(MEMORIES_PAGE_SIZE);

  const [members, setMembers] = useState([]);
  const [familyPeople, setFamilyPeople] = useState([]);
  const [familyRelationships, setFamilyRelationships] = useState([]);
  const [storyData, setStoryData] = useState({
    stories: [],
    people: [],
    comments: [],
  });
  const [milestoneData, setMilestoneData] = useState({
    milestones: [],
    people: [],
    media: [],
    comments: [],
    contributions: [],
    steps: [],
  });

  const [status, setStatus] = useState(null);

  const [admin, setAdmin] = useState(false);

  const [loading, setLoading] = useState(true);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileSection, setProfileSection] = useState("profile");

  /* =======================================================
     GET AUTH SESSION
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function getSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted) {
        setSession(session);
      }
    }

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
      }
    });

    return () => {
      mounted = false;

      subscription.unsubscribe();
    };
  }, []);

  /* =======================================================
     CHECK FAMILY MEMBER ACCESS
  ======================================================= */

  useEffect(() => {
    if (!session) {
      // Defer state resets to avoid synchronous setState in effect
      setTimeout(() => {
        setStatus(null);
        setAdmin(false);
        setMembers([]);
        setFamilyPeople([]);
        setFamilyRelationships([]);
        setStoryData({ stories: [], people: [], comments: [] });
        setMilestoneData({
          milestones: [],
          people: [],
          media: [],
          comments: [],
          contributions: [],
        });
        setMemories([]);
        setLoading(false);
      }, 0);

      return;
    }

    let mounted = true;

    async function checkAccess() {
      setLoading(true);

      const { data, error } = await supabase
        .from("family_members")
        .select("status, role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error || !data) {
        console.error("Could not check family access:", error);

        setStatus("pending");
        setAdmin(false);
      } else {
        setStatus(data.status);

        setAdmin(data.role === "admin");
      }

      setLoading(false);
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [session]);

  /* =======================================================
     LOAD MEMORIES + FAMILY TREE
  ======================================================= */

  useEffect(() => {
    if (!session || status !== "approved") {
      return;
    }

    fetchMemories();

    fetchMembers();
    fetchFamilyTree();
    fetchStories();
    fetchMilestones();

    /*
     * REAL-TIME MEMORY UPDATES
     */

    const memoriesChannel = supabase
      .channel("family-archive-memories")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "memories",
        },
        () => {
          fetchMemories();
        },
      )
      .subscribe();

    /*
     * REAL-TIME FAMILY TREE UPDATES
     */

    const familyChannel = supabase
      .channel("family-archive-members")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_members",
        },
        () => {
          fetchMembers();
        },
      )
      .subscribe();

    const contentChannel = supabase
      .channel("family-archive-content")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_stories" },
        fetchStories,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "story_comments" },
        fetchStories,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "story_people" },
        fetchStories,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_milestones" },
        fetchMilestones,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "milestone_comments" },
        fetchMilestones,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "milestone_contributions" },
        fetchMilestones,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "milestone_steps" },
        fetchMilestones,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "milestone_reminders" },
        fetchMilestones,
      )
      .subscribe();

    const treeChannel = supabase
      .channel("family-archive-tree")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_people" },
        () => {
          fetchFamilyTree();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_relationships" },
        () => {
          fetchFamilyTree();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(memoriesChannel);
      supabase.removeChannel(familyChannel);
      supabase.removeChannel(treeChannel);
      supabase.removeChannel(contentChannel);
    };
  }, [session, status]);

  /* =======================================================
     FETCH MEMORIES
  ======================================================= */

  async function fetchMemories() {
    const count = Math.max(memoriesLoadedRef.current, MEMORIES_PAGE_SIZE);
    const { data, error } = await memoriesQuery().range(0, count - 1);

    if (error) {
      console.error("Error fetching memories:", error);
      setMemoriesLoading(false);
      return;
    }

    const hydrated = await hydrateMemories(data);
    memoriesLoadedRef.current = count;
    setHasMoreMemories((data || []).length === count);
    setMemories(hydrated);
    setMemoriesLoading(false);
  }

  async function loadMoreMemories() {
    if (loadingMoreMemories || !hasMoreMemories) {
      return;
    }

    setLoadingMoreMemories(true);
    const from = memories.length;
    const { data, error } = await memoriesQuery().range(
      from,
      from + MEMORIES_PAGE_SIZE - 1,
    );

    if (error) {
      console.error("Error loading more memories:", error);
      setLoadingMoreMemories(false);
      return;
    }

    const hydrated = await hydrateMemories(data);
    setMemories((current) => {
      const seen = new Set(current.map((memory) => memory.id));
      return [...current, ...hydrated.filter((memory) => !seen.has(memory.id))];
    });
    memoriesLoadedRef.current = from + (data || []).length;
    setHasMoreMemories((data || []).length === MEMORIES_PAGE_SIZE);
    setLoadingMoreMemories(false);
  }

  /* =======================================================
     FETCH FAMILY MEMBERS
  ======================================================= */

  async function fetchMembers() {
    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .eq("status", "approved")
      .order("generation", {
        ascending: true,
        nullsFirst: true,
      })
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error("Error fetching family members:", error);

      setMembers([]);

      return;
    }

    // hydrate signed URLs for private member photos if a storage path is present
    const hydrated = await Promise.all(
      (data || []).map(async (m) => {
        try {
          if (m.photo_path) m.photo_url = await resolveMediaUrl(m.photo_path);
          if (m.avatar_path)
            m.avatar_url = await resolveMediaUrl(m.avatar_path);
        } catch (e) {
          console.error("Could not resolve media url for member photo", e);
        }
        return m;
      }),
    );

    setMembers(hydrated || []);
  }

  /* =========================================================
     FETCH FAMILY TREE PEOPLE + RELATIONSHIPS
  ========================================================= */

  async function fetchStories() {
    const [stories, people, comments] = await Promise.all([
      supabase
        .from("family_stories")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("story_people").select("*"),
      supabase
        .from("story_comments")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);
    if (stories.error || people.error || comments.error) {
      console.error(
        "Could not load stories:",
        stories.error || people.error || comments.error,
      );
      return;
    }
    const hydrated = await Promise.all(
      (stories.data || []).map(async (story) => {
        const urls = {};
        if (story.cover_path) {
          urls.cover_url = await resolveMediaUrl(story.cover_path);
        }
        if (story.audio_path) {
          urls.audio_url = await resolveMediaUrl(story.audio_path);
        }
        return { ...story, ...urls };
      }),
    );
    setStoryData({
      stories: hydrated,
      people: people.data || [],
      comments: comments.data || [],
    });
  }

  async function fetchMilestones() {
    const [
      milestones,
      people,
      media,
      comments,
      contributions,
      steps,
      reminders,
    ] = await Promise.all([
      supabase
        .from("family_milestones")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("milestone_people").select("*"),
      supabase.from("milestone_media").select("*"),
      supabase
        .from("milestone_comments")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("milestone_contributions")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("milestone_steps")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("milestone_reminders")
        .select("*")
        .order("remind_at", { ascending: true }),
    ]);
    if (
      milestones.error ||
      people.error ||
      media.error ||
      comments.error ||
      contributions.error ||
      steps.error ||
      reminders.error
    ) {
      console.error(
        "Could not load milestones:",
        milestones.error ||
          people.error ||
          media.error ||
          comments.error ||
          contributions.error ||
          steps.error ||
          reminders.error,
      );
      return;
    }
    const hydratedMedia = await Promise.all(
      (media.data || []).map(async (item) => {
        const url = await resolveMediaUrl(item.media_path);
        return { ...item, media_url: url || "" };
      }),
    );
    setMilestoneData({
      milestones: milestones.data || [],
      people: people.data || [],
      media: hydratedMedia,
      comments: comments.data || [],
      contributions: contributions.data || [],
      steps: steps.data || [],
      reminders: reminders.data || [],
    });
  }

  async function fetchFamilyTree() {
    const [peopleResult, relationshipsResult] = await Promise.all([
      supabase
        .from("family_people")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("family_relationships")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

    if (peopleResult.error || relationshipsResult.error) {
      console.error(
        "Could not load family tree:",
        peopleResult.error || relationshipsResult.error,
      );
      return;
    }

    const hydratedPeople = await Promise.all(
      (peopleResult.data || []).map(async (person) => {
        if (!person.photo_path) return person;
        const url = await resolveMediaUrl(person.photo_path);
        return { ...person, photo_url: url || "" };
      }),
    );

    setFamilyPeople(hydratedPeople);
    setFamilyRelationships(relationshipsResult.data || []);
  }

  /* =======================================================
     ADD MEMBER HANDLER
  ======================================================= */

  /* =======================================================
     SIGN OUT
  ======================================================= */

  async function handleSignOut() {
    await supabase.auth.signOut();

    setSession(null);
    setStatus(null);
    setAdmin(false);
    setMembers([]);
    setFamilyPeople([]);
    setFamilyRelationships([]);
    setStoryData({ stories: [], people: [], comments: [] });
    setMilestoneData({
      milestones: [],
      people: [],
      media: [],
      comments: [],
      contributions: [],
    });
    setMemories([]);
    setMemoriesLoading(true);
    memoriesLoadedRef.current = MEMORIES_PAGE_SIZE;
    setScreen("home");
  }

  /* =======================================================
     AUTH SCREEN
  ======================================================= */

  if (!session) {
    return <Auth />;
  }

  /* =======================================================
     LOADING SCREEN
  ======================================================= */

  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <span className="eyebrow">THE FAMILY ARCHIVE</span>

          <h2>Checking access</h2>

          <p>Just a moment while we open the archive.</p>
        </div>
      </div>
    );
  }

  /* =======================================================
     PENDING / REJECTED
  ======================================================= */

  if (status === "pending" || status === "rejected") {
    const pending = status === "pending";

    return (
      <div className="auth-screen">
        <div className="auth-card access-card">
          <div className="access-icon">{pending ? "◷" : "×"}</div>

          <span className="eyebrow">
            {pending ? "ACCESS REQUESTED" : "ACCESS UNAVAILABLE"}
          </span>

          <h2>{pending ? "Awaiting approval" : "Access denied"}</h2>

          <p>
            {pending
              ? "Your account is waiting for a family admin to approve access to the archive."
              : "Your request was not approved by the family admin."}
          </p>

          <button className="btn btn-primary" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const nav = admin ? [...NAV, ["members", "Family members", "♙"]] : NAV;

  /* =======================================================
     USER NAME
  ======================================================= */

  const name =
    session.user?.user_metadata?.full_name ||
    session.user?.user_metadata?.name ||
    session.user?.email?.split("@")[0] ||
    "Family";

  /* =======================================================
     PAGE COMPONENTS
  ======================================================= */

  const pages = {
    home: (
      <Home
        memories={memories}
        userName={name}
        reminders={milestoneData.reminders}
        milestones={milestoneData.milestones}
      />
    ),

    timeline: (
      <Timeline
        memories={memories}
        loading={memoriesLoading}
        hasMore={hasMoreMemories}
        loadingMore={loadingMoreMemories}
        onLoadMore={loadMoreMemories}
      />
    ),

    gallery: (
      <Gallery
        memories={memories}
        people={familyPeople}
        onRefresh={fetchMemories}
        loading={memoriesLoading}
        hasMore={hasMoreMemories}
        loadingMore={loadingMoreMemories}
        onLoadMore={loadMoreMemories}
      />
    ),

    stories: (
      <Stories
        stories={storyData.stories}
        storyPeople={storyData.people}
        comments={storyData.comments}
        people={familyPeople}
        currentUserId={session.user.id}
        onRefresh={fetchStories}
      />
    ),

    /*
     * =====================================================
     * FAMILY TREE
     * =====================================================
     */

    tree: (
      <FamilyTree
        people={familyPeople}
        relationships={familyRelationships}
        currentUserId={session.user.id}
        onRefresh={fetchFamilyTree}
      />
    ),

    milestones: (
      <Milestones
        milestones={milestoneData.milestones}
        milestonePeople={milestoneData.people}
        media={milestoneData.media}
        comments={milestoneData.comments}
        contributions={milestoneData.contributions}
        steps={milestoneData.steps}
        reminders={milestoneData.reminders}
        members={members}
        people={familyPeople}
        currentUserId={session.user.id}
        onRefresh={fetchMilestones}
      />
    ),

    activity: (
      <FamilyActivity
        memories={memories}
        milestones={milestoneData.milestones}
        stories={storyData.stories}
        comments={milestoneData.comments}
        contributions={milestoneData.contributions}
        reminders={milestoneData.reminders}
        members={members}
        currentUserId={session.user.id}
        onNavigate={(target) => setScreen(target)}
      />
    ),

    profile: (
      <Profile
        session={session}
        admin={admin}
        member={members.find((m) => m.user_id === session.user.id)}
        initialSection={profileSection}
        onSignOut={handleSignOut}
      />
    ),

    /*
     * ADMIN ONLY
     */

    members: admin ? <FamilyMembers /> : null,

    /*
     * ADD MEMORY
     */

    add: (
      <AddMemory
        onMemoryAdded={fetchMemories}
        onClose={() => setScreen("home")}
      />
    ),
  };

  /* =======================================================
     APP
  ======================================================= */

  return (
    <ToastProvider>
      <div className="app-shell">
        {/* =================================================
          SIDE NAVIGATION
      ================================================== */}

        <aside className={`side-nav ${mobileNavOpen ? "mobile-open" : ""}`}>
          {/* MOBILE MENU */}

          <button
            className="mobile-menu-toggle"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileNavOpen ? "×" : "☰"}
          </button>

          {/* BRAND */}

          <div className="brand">
            <strong>The Family Archive</strong>

            <span>Since 1990</span>
          </div>

          {/* NAV */}

          <nav>
            {nav.map(([id, label, icon]) => (
              <button
                key={id}
                className={screen === id ? "active" : ""}
                onClick={() => {
                  setScreen(id);

                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-icon">{icon}</span>

                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-notifications">
            <NotificationCenter
              reminders={milestoneData.reminders}
              comments={milestoneData.comments}
              contributions={milestoneData.contributions}
              onOpenMilestone={() => setScreen("milestones")}
            />
            <span>Notifications</span>
          </div>

          {/* ADD MEMORY */}

          <button
            className="btn btn-primary add-btn"
            onClick={() => {
              setScreen("add");

              setMobileNavOpen(false);
            }}
          >
            + Add memory
          </button>

          {/* USER */}

          <div className={`user ${profileMenuOpen ? "profile-open" : ""}`}>
            <button
              className="user-summary"
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-expanded={profileMenuOpen}
            >
              <span className="user-avatar">
                {(name || "F")
                  .split(" ")
                  .filter(Boolean)
                  .map((x) => x[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="user-copy">
                <strong>{name}</strong>
                <small>{admin ? "Administrator" : "Family member"}</small>
              </span>
              <span className="user-chevron">⌄</span>
            </button>
            {profileMenuOpen && (
              <div className="profile-popover">
                <button
                  onClick={() => {
                    setProfileSection("profile");
                    setScreen("profile");
                    setProfileMenuOpen(false);
                  }}
                >
                  ♙ <span>Profile</span>
                </button>
                <button
                  onClick={() => {
                    setProfileSection("account");
                    setScreen("profile");
                    setProfileMenuOpen(false);
                  }}
                >
                  ⚙ <span>Account settings</span>
                </button>
                <button
                  onClick={() => {
                    setProfileSection("help");
                    setScreen("profile");
                    setProfileMenuOpen(false);
                  }}
                >
                  ? <span>Help & support</span>
                </button>
                <button
                  className="profile-popover-signout"
                  onClick={handleSignOut}
                >
                  ↪ <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* =================================================
          MAIN CONTENT
      ================================================== */}

        <main className="stage">{pages[screen] || pages.home}</main>
      </div>
    </ToastProvider>
  );
}
