import React, { useState, useMemo, useEffect, useRef } from "react";
import { ClerkProvider, AuthenticateWithRedirectCallback, useUser, useAuth, useSignIn } from "@clerk/clerk-react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Target,
  MessageSquareText,
  TrendingUp,
  X,
  ListTodo,
  HeartPulse,
  Image as ImageIcon,
  Bell,
  MessageCircle,
  Trash2,
  GraduationCap,
  PlayCircle,
  Bookmark,
  Sun,
  Moon,
  Quote,
} from "lucide-react";

const NAG_INTERVAL_MS = 30 * 60 * 1000;
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Web Push wants the VAPID public key as a Uint8Array, but it's handed to
// us (and stored in env) as a base64url string — standard conversion.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

const initialGoals = [];
const initialHabits = [];
const initialTasks = [];
const initialReflections = [];

// Everything the user builds up (goals, tasks, habits, chat history) is kept
// in localStorage so it survives closing the app or the tab, even before —
// or without ever — signing in to sync it to an account.
function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Couldn't save "${key}" locally`, err);
  }
}

const trendWeeks = [
  { week: "Wk 1", g1: 1, g2: 1, g3: 2 },
  { week: "Wk 2", g1: 2, g2: 0, g3: 3 },
  { week: "Wk 3", g1: 1, g2: 2, g3: 2 },
  { week: "Wk 4", g1: 2, g2: 1, g3: 4 },
];

const NAV = [
  { id: "today", label: "Todo", icon: ListTodo },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "goals", label: "Goals", icon: Target },
  { id: "habits", label: "Habits", icon: HeartPulse },
  { id: "learn", label: "Learn", icon: GraduationCap },
  { id: "reflect", label: "Reflect", icon: MessageSquareText },
  { id: "trends", label: "Trends", icon: TrendingUp },
];

// Quotes tagged by topic so the "Wise words & inspiration" card can pick
// one that actually relates to what the user's goals are about, instead
// of always showing something generic.
const INSPIRATION_QUOTES = [
  {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
    tags: ["start", "goal", "general"],
    personal: (name) => `${name}, the secret of getting ahead is getting started — so let's start.`,
  },
  {
    text: "A goal without a plan is just a wish.",
    author: "Antoine de Saint-Exupéry",
    tags: ["goal", "plan", "general"],
    personal: (name) => `${name}, a goal without a plan is just a wish — let's turn yours into a plan.`,
  },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln", tags: ["discipline", "habit"] },
  {
    text: "Small daily improvements are the key to staggering long-term results.",
    author: "James Clear",
    tags: ["habit", "growth", "routine"],
    personal: (name) => `${name}, small daily improvements are the key to staggering long-term results — keep stacking them.`,
  },
  {
    text: "You don't have to be great to start, but you have to start to be great.",
    author: "Zig Ziglar",
    tags: ["start", "goal", "general"],
    personal: (name) => `You don't have to be great to start, ${name} — but you have to start to be great.`,
  },
  {
    text: "The expert in anything was once a beginner.",
    author: "Helen Hayes",
    tags: ["learn", "study", "education", "skill", "course"],
    personal: (name) => `${name}, remember — the expert in anything was once a beginner, same as you right now.`,
  },
  { text: "Reading is to the mind what exercise is to the body.", author: "Joseph Addison", tags: ["read", "book", "learn", "education", "study"] },
  { text: "Practice isn't the thing you do once you're good. It's the thing you do that makes you good.", author: "Malcolm Gladwell", tags: ["practice", "skill", "learn", "study"] },
  { text: "Fitness is not about being better than someone else. It's about being better than you used to be.", author: "Khloe Kardashian", tags: ["fitness", "health", "gym", "exercise", "workout", "run"] },
  {
    text: "Take care of your body. It's the only place you have to live.",
    author: "Jim Rohn",
    tags: ["health", "fitness", "gym", "body", "diet"],
    personal: (name) => `${name}, take care of your body — it's the only place you have to live.`,
  },
  { text: "Code is like humor. When you have to explain it, it's bad.", author: "Cory House", tags: ["code", "coding", "programming", "developer", "software", "app"] },
  { text: "First, solve the problem. Then, write the code.", author: "John Johnson", tags: ["code", "coding", "programming", "software", "project"] },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs", tags: ["career", "work", "job", "business"] },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser", tags: ["career", "business", "job", "money", "finance"] },
  { text: "Save money and money will save you.", author: "Jamaican proverb", tags: ["money", "finance", "save", "budget"] },
  { text: "A budget is telling your money where to go instead of wondering where it went.", author: "John C. Maxwell", tags: ["money", "finance", "budget", "save"] },
  { text: "Sleep is the best meditation.", author: "Dalai Lama", tags: ["sleep", "rest", "health"] },
  { text: "Well done is better than well said.", author: "Benjamin Franklin", tags: ["action", "general", "habit"] },
  {
    text: "Whether you think you can or you think you can't, you're right.",
    author: "Henry Ford",
    tags: ["mindset", "general"],
    personal: (name) => `${name}, whether you think you can or you think you can't — you're right.`,
  },
  { text: "The pain of discipline weighs ounces; the pain of regret weighs tons.", author: "Jim Rohn", tags: ["discipline", "habit", "general"] },
];

// Module-level, not component state, so it survives Today unmounting and
// remounting each time the tab is switched away and back — that's what
// makes the quote actually change on a tab switch rather than resetting.
let lastInspirationIndex = -1;
function pickInspiration(goals) {
  const goalWords = goals
    .flatMap((g) => (g.title || "").toLowerCase().split(/[^a-z]+/))
    .filter(Boolean);
  const scored = INSPIRATION_QUOTES.map((q, i) => ({
    i,
    q,
    score: goalWords.length
      ? q.tags.reduce((s, tag) => s + (goalWords.some((w) => w.length > 2 && (w.includes(tag) || tag.includes(w))) ? 1 : 0), 0)
      : 0,
  }));
  const maxScore = Math.max(0, ...scored.map((s) => s.score));
  const candidates = maxScore > 0 ? scored.filter((s) => s.score === maxScore) : scored;
  const pool = candidates.length > 1 ? candidates.filter((c) => c.i !== lastInspirationIndex) : candidates;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastInspirationIndex = pick.i;
  return pick.q;
}

// New users (no goals/tasks/habits yet) always see this one first —
// "{name}, the secret of getting ahead is getting started — so let's
// start." — rather than a random pick, so that first nudge is consistent.
function firstInspirationForNewUsers() {
  lastInspirationIndex = 0;
  return INSPIRATION_QUOTES[0];
}

// Assistant avatar — the actual logo mark, cropped from the brand lockup.
// The badge itself stays a fixed light chip (reads fine on any surface),
// but the mark image swaps for the dark-theme version via .pga-avatar-*
// so it still pops the way the dark lockup was drawn to.
function AssistantAvatar({ size = 40 }) {
  return (
    <div
      className="pga-avatar"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        className="pga-avatar-light"
        src="/logo-mark-light.png"
        alt=""
        style={{ width: "72%", height: "72%", objectFit: "contain" }}
      />
      <img
        className="pga-avatar-dark"
        src="/logo-mark-dark.png"
        alt=""
        style={{ width: "72%", height: "72%", objectFit: "contain" }}
      />
    </div>
  );
}

// clerk is null when Clerk isn't configured (no publishable key yet), or
// { isSignedIn, email, name, picture, getToken, signOut, signInWithGoogle }
// once ClerkBridge below has mounted it under a real ClerkProvider.
function AppInner({ clerk }) {
  const [view, setView] = useState("today");

  // Swipe left/right anywhere in the main content to move between tabs, in
  // the same order they appear in the nav. Only fires for a swipe that's
  // clearly more horizontal than vertical, so it doesn't fight with
  // scrolling a task/chat/message list.
  const touchStart = useRef(null);
  function handleTouchStart(e) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }
  function handleTouchEnd(e) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const SWIPE_THRESHOLD = 60;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    const index = NAV.findIndex((n) => n.id === view);
    if (index === -1) return;
    if (dx < 0 && index < NAV.length - 1) setView(NAV[index + 1].id);
    else if (dx > 0 && index > 0) setView(NAV[index - 1].id);
  }

  const [goals, setGoals] = useState(() => loadLocal("marvin.goals", initialGoals));
  const [tasks, setTasks] = useState(() => loadLocal("marvin.tasks", initialTasks));
  const [reflections, setReflections] = useState(() => loadLocal("marvin.reflections", initialReflections));

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskGoal, setNewTaskGoal] = useState("");

  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");

  const [reflectDraft, setReflectDraft] = useState({ win: "", friction: "", energy: "Steady" });

  // Proceed asks for this once, on the Today view, before it has a name to
  // call the user by — purely local, not synced to the account backend.
  const [userName, setUserName] = useState(() => loadLocal("marvin.userName", ""));
  const [nameDraft, setNameDraft] = useState("");
  function submitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    setNameDraft("");
  }

  // Theme: a saved manual choice wins, otherwise follow the OS. Stored as
  // a plain string (not JSON) so index.html's pre-paint script — which
  // reads it before React even loads, to avoid a flash of the wrong
  // theme — can compare it directly.
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("marvin.theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // localStorage unavailable — fall through to the OS preference.
    }
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  });
  useEffect(() => {
    try {
      localStorage.setItem("marvin.theme", theme);
    } catch {
      // Best-effort only; the toggle still works for this session.
    }
  }, [theme]);
  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  const [habits, setHabits] = useState(() => loadLocal("marvin.habits", initialHabits));
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitText, setNewHabitText] = useState("");
  const [notifPermission, setNotifPermission] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [pushEnabled, setPushEnabled] = useState(false);
  const [nagHabit, setNagHabit] = useState(null);

  const [chatMessages, setChatMessages] = useState(() => loadLocal("marvin.chatMessages", []));
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);

  const habitsRef = useRef(habits);
  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  const [watchList, setWatchList] = useState(() => loadLocal("marvin.watchList", []));

  // Always-on local persistence — goals, tasks, habits, reflections, chat,
  // and the watch list all survive closing the app/tab even before (or
  // without) signing in.
  useEffect(() => saveLocal("marvin.goals", goals), [goals]);
  useEffect(() => saveLocal("marvin.tasks", tasks), [tasks]);
  useEffect(() => saveLocal("marvin.habits", habits), [habits]);
  useEffect(() => saveLocal("marvin.reflections", reflections), [reflections]);
  useEffect(() => saveLocal("marvin.watchList", watchList), [watchList]);
  useEffect(() => saveLocal("marvin.userName", userName), [userName]);
  useEffect(() => {
    saveLocal("marvin.chatMessages", chatMessages.filter((m) => !m.streaming));
  }, [chatMessages]);

  function saveVideoToWatchList(video, goal) {
    setWatchList((prev) => {
      if (prev.some((v) => v.id === video.id)) return prev;
      return [
        { id: video.id, title: video.title, channelTitle: video.channelTitle, thumbnail: video.thumbnail, goalId: goal?.id ?? null, goalTitle: goal?.title ?? null },
        ...prev,
      ];
    });
  }

  function removeVideoFromWatchList(videoId) {
    setWatchList((prev) => prev.filter((v) => v.id !== videoId));
  }

  const [waPhone, setWaPhone] = useState("");
  const [waCodeInput, setWaCodeInput] = useState("");
  const [waStep, setWaStep] = useState(() => (localStorage.getItem("waLinkedPhone") ? "linked" : "idle")); // idle | sent | linked
  const [waError, setWaError] = useState(null);
  const [waLoading, setWaLoading] = useState(false);
  // Which phone number is linked for WhatsApp messaging — separate from
  // `account`, since linking WhatsApp no longer signs you in on its own; it
  // just attaches to whichever account (Google, via Clerk) is already signed in.
  const [waLinkedPhone, setWaLinkedPhone] = useState(() => localStorage.getItem("waLinkedPhone"));
  const [googleError, setGoogleError] = useState(null);

  // Clerk owns the actual session; this is just a display-friendly view of it.
  const account = clerk?.isSignedIn ? { type: "google", email: clerk.email, name: clerk.name, picture: clerk.picture } : null;
  const hydrated = useRef(false);
  const syncTimer = useRef(null);

  // If the server has nothing yet but this browser already has local data,
  // keep the local data rather than overwriting it with an empty record —
  // the debounced sync effect below will push it up shortly after.
  function applyServerState(data) {
    const serverEmpty =
      (data.goals?.length || 0) === 0 &&
      (data.tasks?.length || 0) === 0 &&
      (data.habits?.length || 0) === 0 &&
      (data.chatHistory?.length || 0) === 0 &&
      (data.watchList?.length || 0) === 0;
    const localHasData =
      goals.length > 0 || tasks.length > 0 || habits.length > 0 || chatMessages.length > 0 || watchList.length > 0;
    if (serverEmpty && localHasData) return;
    setGoals(data.goals || []);
    setTasks(data.tasks || []);
    setHabits(data.habits || []);
    setReflections(data.reflections || []);
    setChatMessages(data.chatHistory || []);
    setWatchList(data.watchList || []);
  }

  // Hydrate this browser from the server record once Clerk reports a signed-in user.
  useEffect(() => {
    if (!clerk?.isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await clerk.getToken();
        const res = await fetch("/api/state", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) applyServerState(data);
      } catch {
        // Offline or the API is unreachable — fall back to local-only mode.
      } finally {
        if (!cancelled) hydrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clerk?.isSignedIn]);

  // Debounced sync to the server once signed in, so every device sees the same data.
  useEffect(() => {
    if (!clerk?.isSignedIn || !hydrated.current) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        const token = await clerk.getToken();
        fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            goals,
            tasks,
            habits,
            reflections,
            chatHistory: chatMessages.filter((m) => !m.streaming),
            watchList,
          }),
        }).catch(() => {});
      } catch {
        // Couldn't get a fresh token — the next change will retry.
      }
    }, 800);
    return () => clearTimeout(syncTimer.current);
  }, [goals, tasks, habits, reflections, chatMessages, watchList, clerk?.isSignedIn]);

  async function handleSignInWithGoogle() {
    setGoogleError(null);
    try {
      await clerk?.signInWithGoogle();
    } catch (err) {
      setGoogleError(err.message || "Couldn't start Google sign-in.");
    }
  }

  async function handleSignOut() {
    localStorage.removeItem("waLinkedPhone");
    setWaLinkedPhone(null);
    setWaStep("idle");
    setWaPhone("");
    hydrated.current = false;
    await clerk?.signOut();
  }

  async function sendWaCode() {
    setWaError(null);
    if (!waPhone.trim()) {
      setWaError("Enter a phone number first.");
      return;
    }
    setWaLoading(true);
    try {
      const res = await fetch("/api/whatsapp/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: waPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send the code.");
      setWaStep("sent");
    } catch (err) {
      setWaError(err.message);
    } finally {
      setWaLoading(false);
    }
  }

  async function verifyWaCode() {
    setWaError(null);
    if (!waCodeInput.trim()) {
      setWaError("Enter the code you received.");
      return;
    }
    if (!clerk?.isSignedIn) {
      setWaError("Sign in first, then link a WhatsApp number.");
      return;
    }
    setWaLoading(true);
    try {
      const token = await clerk.getToken();
      const res = await fetch("/api/whatsapp/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: waPhone.trim(), code: waCodeInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't verify that code.");

      applyServerState(data.state);
      localStorage.setItem("waLinkedPhone", data.phone);
      setWaLinkedPhone(data.phone);
      setWaStep("linked");
      setWaCodeInput("");
    } catch (err) {
      setWaError(err.message);
    } finally {
      setWaLoading(false);
    }
  }

  useEffect(() => {
    const id = setInterval(() => {
      const pending = habitsRef.current.filter((h) => !h.done);
      if (pending.length === 0) return;
      const target = pending[Math.floor(Math.random() * pending.length)];
      setNagHabit(target);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification("Still on today's list", { body: `"${target.title}" isn't done yet.` });
      }
    }, NAG_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const goalById = (id) => goals.find((g) => g.id === id);

  const doneCountForGoal = (goalId) =>
    tasks.filter((t) => t.goalId === goalId && t.done).length;

  const neglectedGoal = useMemo(
    () => goals.find((g) => doneCountForGoal(g.id) === 0),
    [goals, tasks]
  );

  const isFreshStart = goals.length === 0 && tasks.length === 0 && habits.length === 0;

  function startOnboardingWithAI() {
    setView("chat");
  }

  function toggleTask(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function removeTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function removeGoal(id) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setTasks((prev) => prev.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)));
  }

  function setGoalMedia(goalId, file) {
    if (!file) return;
    const type = file.type.startsWith("video/") ? "video" : "image";
    const reader = new FileReader();
    reader.onload = () => {
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, media: { type, url: reader.result, name: file.name } } : g))
      );
    };
    reader.readAsDataURL(file);
  }

  function removeGoalMedia(goalId) {
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, media: null } : g)));
  }

  function toggleHabit(id) {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, done: !h.done } : h)));
  }

  function addHabit() {
    if (!newHabitText.trim()) return;
    setHabits((prev) => [...prev, { id: `h${Date.now()}`, title: newHabitText.trim(), done: false }]);
    setNewHabitText("");
    setShowAddHabit(false);
  }

  function removeHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  // Background alerts (reaching the phone even with the app closed) need a
  // real Web Push subscription registered against a signed-in account, not
  // just the OS-level Notification permission grant — that alone only
  // covers notifications triggered while this tab is open and running.
  async function subscribeToPush() {
    if (!clerk?.isSignedIn || !VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const token = await clerk.getToken();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subscription }),
      });
      setPushEnabled(res.ok);
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  }

  // Auto re-subscribe if the user already granted permission previously and
  // then signs in later (or on a new device) — no need to click Enable again.
  useEffect(() => {
    if (clerk?.isSignedIn && notifPermission === "granted") subscribeToPush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerk?.isSignedIn, notifPermission]);

  async function requestNotifPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === "granted") await subscribeToPush();
  }

  function buildAppContext() {
    return JSON.stringify({
      goals: goals.map((g) => ({ id: g.id, title: g.title, target: g.target, doneThisWeek: doneCountForGoal(g.id) })),
      tasks: tasks.map((t) => ({ id: t.id, text: t.text, goalId: t.goalId, done: t.done })),
      habits: habits.map((h) => ({ id: h.id, title: h.title, done: h.done })),
    });
  }

  function addTaskDirect(text, goalId) {
    if (!text || !text.trim()) return "No task text given.";
    const id = `t${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setTasks((prev) => [{ id, text: text.trim(), goalId: goalId || null, done: false }, ...prev]);
    return `Added task "${text.trim()}".`;
  }

  function removeTaskDirect(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return `No task with id "${id}" found.`;
    removeTask(id);
    return `Removed task "${task.text}".`;
  }

  function setTaskDoneDirect(id, done) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return `No task with id "${id}" found.`;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !!done } : t)));
    return `Marked task "${task.text}" as ${done ? "done" : "not done"}.`;
  }

  function addGoalDirect(title, target) {
    if (!title || !title.trim()) return { message: "No goal title given.", id: null };
    const palette = ["#34C759", "#FF9500", "#5856D6", "#FF2D55", "#30B0C7"];
    const color = palette[goals.length % palette.length];
    const id = `g${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setGoals((prev) => [...prev, { id, title: title.trim(), target: target > 0 ? target : 3, color, media: null }]);
    return { message: `Added goal "${title.trim()}".`, id };
  }

  function removeGoalDirect(id) {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return `No goal with id "${id}" found.`;
    removeGoal(id);
    return `Removed goal "${goal.title}".`;
  }

  function addHabitDirect(title) {
    if (!title || !title.trim()) return "No habit title given.";
    const id = `h${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setHabits((prev) => [...prev, { id, title: title.trim(), done: false }]);
    return `Added habit "${title.trim()}".`;
  }

  function removeHabitDirect(id) {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return `No habit with id "${id}" found.`;
    removeHabit(id);
    return `Removed habit "${habit.title}".`;
  }

  function setHabitDoneDirect(id, done) {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return `No habit with id "${id}" found.`;
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, done: !!done } : h)));
    return `Marked habit "${habit.title}" as ${done ? "done" : "not done"}.`;
  }

  function executeToolCalls(toolCalls, titleToNewGoalId) {
    const results = new Map();

    // Pass 1: create goals first, so tasks in the same batch can link to a
    // goal that didn't exist until this response. titleToNewGoalId is shared
    // across every round of one chat turn, since a goal created in an earlier
    // round still needs to be linkable by tasks added in a later round.
    for (const call of toolCalls) {
      if (call.function.name !== "add_goal") continue;
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        results.set(call.id, "Couldn't parse that action's arguments.");
        continue;
      }
      const { message, id } = addGoalDirect(args.title, args.target);
      if (id && args.title) titleToNewGoalId[args.title.trim().toLowerCase()] = id;
      results.set(call.id, message);
    }

    // Pass 2: everything else.
    for (const call of toolCalls) {
      if (call.function.name === "add_goal") continue;
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        results.set(call.id, "Couldn't parse that action's arguments.");
        continue;
      }
      switch (call.function.name) {
        case "add_task": {
          let goalId = null;
          if (args.goalTitle) {
            const key = args.goalTitle.trim().toLowerCase();
            goalId = titleToNewGoalId[key] || goals.find((g) => g.title.toLowerCase() === key)?.id || null;
          }
          results.set(call.id, addTaskDirect(args.text, goalId));
          break;
        }
        case "remove_task":
          results.set(call.id, removeTaskDirect(args.id));
          break;
        case "set_task_done":
          results.set(call.id, setTaskDoneDirect(args.id, args.done));
          break;
        case "remove_goal":
          results.set(call.id, removeGoalDirect(args.id));
          break;
        case "add_habit":
          results.set(call.id, addHabitDirect(args.title));
          break;
        case "remove_habit":
          results.set(call.id, removeHabitDirect(args.id));
          break;
        case "set_habit_done":
          results.set(call.id, setHabitDoneDirect(args.id, args.done));
          break;
        default:
          results.set(call.id, `Unknown action "${call.function.name}".`);
      }
    }

    return toolCalls.map((call) => ({
      role: "tool",
      tool_call_id: call.id,
      content: results.get(call.id) ?? "No result.",
    }));
  }

  // Streams one round of /api/chat, updating a live "streaming" placeholder
  // message as text arrives so the reply appears as it's generated instead
  // of all at once at the end. Returns the round's final { reply, toolCalls }.
  async function streamChatRound(wireMessages, context, toolChoice) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: wireMessages, context, toolChoice }),
    });
    if (!res.ok || !res.body) {
      let message = "Something went wrong.";
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        // Non-JSON error body — fall back to the generic message.
      }
      throw new Error(message);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let toolCalls = null;
    let streamingAdded = false;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "delta") {
            content += event.text;
            if (!streamingAdded) {
              streamingAdded = true;
              setChatMessages((prev) => [...prev, { role: "assistant", content, streaming: true }]);
            } else {
              setChatMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) next[next.length - 1] = { ...last, content };
                return next;
              });
            }
          } else if (event.type === "tool_calls") {
            toolCalls = event.toolCalls;
            content = event.reply ?? content;
          } else if (event.type === "done") {
            content = event.reply ?? content;
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        }
      }
    } finally {
      if (streamingAdded) setChatMessages((prev) => prev.filter((m) => !m.streaming));
    }

    return { reply: content, toolCalls };
  }

  function clearChat() {
    setChatMessages([]);
    setChatError(null);
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const nextMessages = [...chatMessages, { role: "user", content: text }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatError(null);
    setChatLoading(true);

    const MAX_ROUNDS = 6;

    try {
      const context = buildAppContext();
      const titleToNewGoalId = {};
      let wireMessages = nextMessages;
      let finalReply = "";
      // Tracks what this turn actually created so the chat bubble can offer
      // quick-nav buttons straight to wherever the new stuff landed.
      const created = { task: false, goal: false, habit: false };

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const isLastRound = round === MAX_ROUNDS - 1;
        const result = await streamChatRound(wireMessages, context, isLastRound ? "none" : "auto");

        if (result.toolCalls?.length && !isLastRound) {
          for (const call of result.toolCalls) {
            if (call.function.name === "add_task") created.task = true;
            else if (call.function.name === "add_goal") created.goal = true;
            else if (call.function.name === "add_habit") created.habit = true;
          }
          const toolResults = executeToolCalls(result.toolCalls, titleToNewGoalId);
          wireMessages = [
            ...wireMessages,
            { role: "assistant", content: result.reply ?? null, tool_calls: result.toolCalls },
            ...toolResults,
          ];
          continue;
        }

        finalReply = result.reply || "";
        break;
      }

      if (!finalReply) {
        wireMessages = [...wireMessages, { role: "user", content: "Summarize what you just set up for me, in 2-3 sentences." }];
        const result = await streamChatRound(wireMessages, context, "none");
        finalReply = result.reply || "";
      }

      const didCreateSomething = created.task || created.goal || created.habit;
      setChatMessages((prev) => [
        ...prev.filter((m) => !m.streaming),
        { role: "assistant", content: finalReply || "Done.", created: didCreateSomething ? created : undefined },
      ]);
    } catch (err) {
      setChatMessages((prev) => prev.filter((m) => !m.streaming));
      setChatError(err.message || "Couldn't reach Proceed. Is the chat server running?");
    } finally {
      setChatLoading(false);
    }
  }

  function addTask() {
    if (!newTaskText.trim()) return;
    setTasks((prev) => [
      { id: `t${Date.now()}`, text: newTaskText.trim(), goalId: newTaskGoal || null, done: false },
      ...prev,
    ]);
    setNewTaskText("");
    setNewTaskGoal("");
    setShowAddTask(false);
  }

  function addGoal() {
    if (!newGoalTitle.trim()) return;
    const palette = ["#34C759", "#FF9500", "#5856D6", "#FF2D55", "#30B0C7"];
    const color = palette[goals.length % palette.length];
    setGoals((prev) => [...prev, { id: `g${Date.now()}`, title: newGoalTitle.trim(), target: 3, color }]);
    setNewGoalTitle("");
    setShowAddGoal(false);
  }

  function submitReflection() {
    if (!reflectDraft.win.trim() && !reflectDraft.friction.trim()) return;
    setReflections((prev) => [
      { id: `r${Date.now()}`, week: "This week", ...reflectDraft },
      ...prev,
    ]);
    setReflectDraft({ win: "", friction: "", energy: "Steady" });
  }

  return (
    <div className="pga-app min-h-dvh w-full flex" data-theme={theme}>
      <style>{`
        .pga-app {
          /* Light theme uses the logo's own palette (soft blue-white bg,
             brand navy as ink/accent); dark theme mirrors the dark lockup
             (near-black navy bg, pale blue-white text, brightened navy
             accent so it still reads against a dark surface). Toggled via
             data-theme, set on this element from React state. */
          color-scheme: light;
          --bg: #EEF3FA;
          --surface: #FFFFFF;
          --surface-2: #E4ECF6;
          --ink: #16375E;
          --ink-soft: rgba(22, 55, 94, 0.62);
          --accent: #16375E;
          --accent-soft: rgba(22, 55, 94, 0.12);
          --success: #34C759;
          --danger: #FF3B30;
          --clay: #FF9500;
          --clay-soft: rgba(255, 149, 0, 0.12);
          --border: rgba(22, 55, 94, 0.16);
          --shadow: 0 10px 30px rgba(22, 55, 94, 0.12);
          background: var(--bg);
          color: var(--ink);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow-x: hidden;
          overflow-wrap: anywhere;
        }

        .pga-app[data-theme="dark"] {
          color-scheme: dark;
          --bg: #10181F;
          --surface: #19232C;
          --surface-2: #212D39;
          --ink: #EAF3FA;
          --ink-soft: rgba(234, 243, 250, 0.62);
          --accent: #4C8FE0;
          --accent-soft: rgba(76, 143, 224, 0.2);
          --success: #30D158;
          --danger: #FF453A;
          --clay: #FF9F0A;
          --clay-soft: rgba(255, 159, 10, 0.18);
          --border: rgba(234, 243, 250, 0.14);
          --shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        /* Assistant avatar mark: fixed light chip so the badge reads the
           same regardless of theme, but the mark image itself swaps to
           the one drawn for a dark background so it isn't just a dim
           navy shape on a light circle. */
        .pga-avatar {
          background: #EEF3FA;
          box-shadow: 0 0 0 1px rgba(22, 55, 94, 0.12);
        }
        .pga-avatar .pga-avatar-dark { display: none; }
        .pga-app[data-theme="dark"] .pga-avatar {
          background: #16375E;
          box-shadow: 0 0 0 1px rgba(234, 243, 250, 0.16);
        }
        .pga-app[data-theme="dark"] .pga-avatar .pga-avatar-light { display: none; }
        .pga-app[data-theme="dark"] .pga-avatar .pga-avatar-dark { display: block; }

        .pga-theme-toggle {
          position: fixed;
          top: calc(env(safe-area-inset-top, 0px) + 12px);
          right: 14px;
          z-index: 55;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--surface) 88%, transparent);
          backdrop-filter: blur(12px) saturate(150%);
          -webkit-backdrop-filter: blur(12px) saturate(150%);
          color: var(--ink);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow);
          cursor: pointer;
        }
        .pga-theme-toggle:active { opacity: 0.7; }

        .pga-heading {
          font-family: inherit;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--ink);
        }

        .pga-nav-btn {
          display: flex; align-items: center; gap: 10px;
          width: 100%; text-align: left;
          padding: 10px 12px; border-radius: 10px;
          font-size: 14.5px; font-weight: 500; color: var(--ink-soft);
          border: none;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .pga-nav-btn:hover { background: rgba(120, 120, 128, 0.08); color: var(--ink); }
        .pga-nav-btn.active {
          background: var(--accent-soft); color: var(--accent);
        }
        @media (min-width: 1024px) {
          .pga-nav-chat-tab { display: none; }
        }

        .pga-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
        }

        .pga-task-row {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          transition: background 0.12s ease;
        }
        .pga-task-row > button:first-child {
          margin-top: 1px;
        }
        .pga-task-row:last-child { border-bottom: none; }
        .pga-task-row:hover { background: rgba(120, 120, 128, 0.06); }

        .pga-chip {
          font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
          display: inline-flex; align-items: center; gap: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pga-input {
          width: 100%; background: var(--surface-2); border: none;
          border-radius: 10px; padding: 10px 12px; font-size: 15px; color: var(--ink);
          font-family: inherit;
        }
        .pga-input::placeholder { color: var(--ink-soft); }
        .pga-input:focus { outline: none; box-shadow: 0 0 0 3px var(--accent-soft); }

        .pga-btn-primary {
          background: var(--accent); color: #fff;
          border-radius: 12px; padding: 10px 18px; font-size: 15px; font-weight: 600;
          border: none; cursor: pointer;
          white-space: nowrap; flex-shrink: 0;
        }
        .pga-btn-primary:hover { opacity: 0.88; }
        .pga-btn-primary:active { opacity: 0.7; }

        .pga-btn-ghost {
          background: var(--surface-2); color: var(--accent);
          border: none; border-radius: 12px;
          padding: 10px 16px; font-size: 15px; font-weight: 600; cursor: pointer;
          white-space: nowrap; flex-shrink: 0;
        }
        .pga-btn-ghost:hover { opacity: 0.85; }
        .pga-btn-ghost:active { opacity: 0.65; }

        .pga-segment {
          display: flex; gap: 2px; padding: 2px;
          background: var(--surface-2); border-radius: 9px;
        }
        .pga-segment button {
          flex: 1; padding: 7px 10px; font-size: 13.5px; font-weight: 600;
          border-radius: 7px; border: none; background: transparent; color: var(--ink-soft);
          cursor: pointer; transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
        }
        .pga-segment button.active {
          background: var(--surface); color: var(--ink);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
        }

        .pga-progress-track {
          height: 6px; border-radius: 999px; background: var(--surface-2); overflow: hidden;
        }
        .pga-progress-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }

        .pga-bar-col { display: flex; flex-direction: column; justify-content: flex-end; gap: 3px; }

        .pga-app button:focus-visible,
        .pga-app input:focus-visible,
        .pga-app select:focus-visible,
        .pga-app textarea:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .pga-empty {
          text-align: center; padding: 40px 20px; color: var(--ink-soft); font-size: 14px;
        }

        @keyframes pgaSlideDown {
          from { opacity: 0; transform: translate(-50%, -14px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .pga-banner-in { animation: pgaSlideDown 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) forwards; }

        .pga-main {
          min-width: 0;
          padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
        }
        @media (min-width: 640px) {
          .pga-main { padding-bottom: 2.5rem; }
        }

        /* While the chat input is focused (keyboard almost certainly open on
           phones/tablets), free up the space the fixed bottom nav normally
           reserves so the input isn't left cramped above the keyboard. */
        @media (max-width: 639px) {
          body:has(.pga-chat-input:focus) .pga-mobile-nav {
            display: none;
          }
          body:has(.pga-chat-input:focus) .pga-main {
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
        }

        .pga-app,
        .pga-app * {
          -webkit-tap-highlight-color: transparent;
        }
        .pga-app button,
        .pga-app input,
        .pga-app select,
        .pga-app textarea {
          touch-action: manipulation;
        }
        .pga-app button,
        .pga-nav-btn,
        .pga-segment button {
          -webkit-user-select: none;
          user-select: none;
        }
      `}</style>

      <button
        type="button"
        className="pga-theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun size={17} strokeWidth={1.75} /> : <Moon size={17} strokeWidth={1.75} />}
      </button>

      {!userName ? (
        <NameGate nameDraft={nameDraft} setNameDraft={setNameDraft} onSubmitName={submitName} />
      ) : (
      <>
      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 border-r px-4 py-6 hidden sm:flex flex-col gap-1"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <AssistantAvatar size={34} />
          <div>
            <div className="pga-heading" style={{ fontSize: "17px", fontWeight: 700, lineHeight: 1.1 }}>
              Proceed
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--ink-soft)" }}>your assistant</div>
          </div>
        </div>
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              // The persistent chat panel (lg+) replaces this tab there, so
              // it only needs to stay in the nav below that breakpoint.
              className={`pga-nav-btn ${view === item.id ? "active" : ""} ${item.id === "chat" ? "pga-nav-chat-tab" : ""}`}
              onClick={() => setView(item.id)}
            >
              <Icon size={16} strokeWidth={1.75} />
              {item.label}
            </button>
          );
        })}
      </aside>

      {/* Main */}
      <main
        className="pga-main flex-1 px-5 pt-7 sm:px-10 sm:pt-10 max-w-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {view === "today" && (
          <TodayView
            tasks={tasks}
            goals={goals}
            goalById={goalById}
            toggleTask={toggleTask}
            removeTask={removeTask}
            neglectedGoal={neglectedGoal}
            showAddTask={showAddTask}
            setShowAddTask={setShowAddTask}
            newTaskText={newTaskText}
            setNewTaskText={setNewTaskText}
            newTaskGoal={newTaskGoal}
            setNewTaskGoal={setNewTaskGoal}
            addTask={addTask}
            isFreshStart={isFreshStart}
            onStartOnboardingWithAI={startOnboardingWithAI}
            account={account}
            onSignOut={handleSignOut}
            onGoogleSignIn={handleSignInWithGoogle}
            showGoogleButton={!!CLERK_PUBLISHABLE_KEY}
            googleError={googleError}
            waPhone={waPhone}
            setWaPhone={setWaPhone}
            waCodeInput={waCodeInput}
            setWaCodeInput={setWaCodeInput}
            waStep={waStep}
            waError={waError}
            waLoading={waLoading}
            waLinkedPhone={waLinkedPhone}
            onSendWaCode={sendWaCode}
            onVerifyWaCode={verifyWaCode}
            userName={userName}
          />
        )}

        {view === "chat" && (
          <ChatView
            messages={chatMessages}
            input={chatInput}
            setInput={setChatInput}
            loading={chatLoading}
            error={chatError}
            onSend={sendChatMessage}
            onClear={clearChat}
            onNavigate={setView}
          />
        )}

        {view === "goals" && (
          <GoalsView
            goals={goals}
            tasks={tasks}
            doneCountForGoal={doneCountForGoal}
            removeGoal={removeGoal}
            setGoalMedia={setGoalMedia}
            removeGoalMedia={removeGoalMedia}
            showAddGoal={showAddGoal}
            setShowAddGoal={setShowAddGoal}
            newGoalTitle={newGoalTitle}
            setNewGoalTitle={setNewGoalTitle}
            addGoal={addGoal}
          />
        )}

        {view === "habits" && (
          <HabitsView
            habits={habits}
            toggleHabit={toggleHabit}
            removeHabit={removeHabit}
            showAddHabit={showAddHabit}
            setShowAddHabit={setShowAddHabit}
            newHabitText={newHabitText}
            setNewHabitText={setNewHabitText}
            addHabit={addHabit}
            notifPermission={notifPermission}
            requestNotifPermission={requestNotifPermission}
            pushEnabled={pushEnabled}
            isSignedIn={!!clerk?.isSignedIn}
          />
        )}

        {view === "learn" && (
          <LearnView goals={goals} watchList={watchList} onSaveVideo={saveVideoToWatchList} onRemoveVideo={removeVideoFromWatchList} />
        )}

        {view === "reflect" && (
          <ReflectView
            reflections={reflections}
            reflectDraft={reflectDraft}
            setReflectDraft={setReflectDraft}
            submitReflection={submitReflection}
          />
        )}

        {view === "trends" && <TrendsView goals={goals} />}
      </main>

      {/* Persistent chat panel — desktop only; the "Chat" nav tab covers
          this below the lg breakpoint (see .pga-nav-chat-tab). */}
      <aside
        className="hidden lg:flex flex-col shrink-0"
        style={{
          width: "360px",
          borderLeft: "1px solid var(--border)",
          background: "var(--surface)",
          position: "sticky",
          top: 0,
          height: "100dvh",
          padding: "24px 20px",
        }}
      >
        <ChatView
          panel
          messages={chatMessages}
          input={chatInput}
          setInput={setChatInput}
          loading={chatLoading}
          error={chatError}
          onSend={sendChatMessage}
          onClear={clearChat}
          onNavigate={setView}
        />
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="pga-mobile-nav sm:hidden fixed bottom-0 left-0 right-0 flex items-stretch"
        style={{
          background: "color-mix(in srgb, var(--surface) 82%, transparent)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5"
              style={{ color: active ? "var(--accent)" : "var(--ink-soft)" }}
            >
              <Icon size={19} strokeWidth={active ? 2 : 1.75} />
              <span style={{ fontSize: "10.5px", fontWeight: active ? 600 : 400 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <NagToast
        habit={nagHabit}
        onComplete={() => {
          toggleHabit(nagHabit.id);
          setNagHabit(null);
        }}
        onDismiss={() => setNagHabit(null)}
      />
      </>
      )}
    </div>
  );
}

// The very first thing shown inside the app (right after the boot splash),
// before there's a name to greet the user by. Lives inside .pga-app so it
// still gets that scope's CSS variables and component classes.
function NameGate({ nameDraft, setNameDraft, onSubmitName }) {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center px-6">
      <div className="pga-card px-6 py-8 w-full" style={{ maxWidth: "420px" }}>
        <div className="flex justify-center mb-4">
          <AssistantAvatar size={48} />
        </div>
        <div
          className="mb-5"
          style={{
            background: "var(--surface-2)",
            borderRadius: "16px",
            padding: "12px 16px",
            fontSize: "15px",
            lineHeight: 1.45,
            color: "var(--ink)",
            textAlign: "center",
          }}
        >
          Hey, I'm Proceed! I can help you turn your goals into tasks and habits that keep you on track. And when
          you need advice, someone to talk to, or simply a chat, I'm here for you. What should I call you?
        </div>
        <div className="flex gap-2">
          <input
            className="pga-input"
            placeholder="Type your name…"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmitName()}
            autoFocus
          />
          <button className="pga-btn-primary" onClick={onSubmitName} disabled={!nameDraft.trim()}>
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}

// Bridges Clerk's hooks (which only work inside <ClerkProvider>) into the
// plain-object shape AppInner expects, so AppInner itself never has to know
// whether Clerk is configured — it just gets `clerk: null` when it isn't.
function ClerkBridge() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken, signOut } = useAuth();
  const { signIn } = useSignIn();

  const clerk = useMemo(() => {
    if (!isLoaded) return null;
    return {
      isSignedIn,
      email: user?.primaryEmailAddress?.emailAddress || null,
      name: user?.fullName || null,
      picture: user?.imageUrl || null,
      getToken,
      signOut,
      signInWithGoogle: () =>
        signIn.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: `${window.location.origin}/sso-callback`,
          redirectUrlComplete: window.location.origin,
        }),
    };
  }, [isLoaded, isSignedIn, user, getToken, signOut, signIn]);

  return <AppInner clerk={clerk} />;
}

export default function App() {
  if (!CLERK_PUBLISHABLE_KEY) return <AppInner clerk={null} />;
  // Google's OAuth redirect lands back here; Clerk completes the sign-in and
  // this then sends the user on to the app itself.
  if (window.location.pathname === "/sso-callback") {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <AuthenticateWithRedirectCallback afterSignInUrl="/" afterSignUpUrl="/" />
      </ClerkProvider>
    );
  }
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <ClerkBridge />
    </ClerkProvider>
  );
}

function NagToast({ habit, onComplete, onDismiss }) {
  if (!habit) return null;
  return (
    <div
      className="pga-card pga-banner-in"
      style={{
        position: "fixed",
        top: "calc(env(safe-area-inset-top, 0px) + 12px)",
        left: "50%",
        width: "calc(100% - 24px)",
        maxWidth: "380px",
        padding: "12px 14px",
        zIndex: 60,
        boxShadow: "var(--shadow)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        background: "color-mix(in srgb, var(--surface) 92%, transparent)",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <AssistantAvatar size={22} />
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", flex: 1 }}>Proceed</span>
        <span style={{ fontSize: "12px", color: "var(--ink-soft)" }}>now</span>
        <button onClick={onDismiss} aria-label="Dismiss" style={{ color: "var(--ink-soft)" }}>
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <p style={{ fontSize: "14px", color: "var(--ink)", marginBottom: "10px" }}>
        Still haven't done "{habit.title}" today. Quick, knock it out?
      </p>
      <div className="flex justify-end gap-2">
        <button
          className="pga-btn-ghost"
          style={{ padding: "6px 12px", fontSize: "12.5px" }}
          onClick={onDismiss}
        >
          Later
        </button>
        <button
          className="pga-btn-primary"
          style={{ padding: "6px 12px", fontSize: "12.5px" }}
          onClick={onComplete}
        >
          Mark done
        </button>
      </div>
    </div>
  );
}

// Google is the only way to sign up or log in. WhatsApp linking is a
// secondary, optional step that only makes sense once an account already
// exists — it attaches a phone number to that account so messages sent to
// Proceed on WhatsApp land in the same goals/tasks/habits/chat record.
function AccountSyncCard({
  compact,
  account,
  onUnlink,
  onGoogleSignIn,
  showGoogleButton,
  googleError,
  waPhone,
  setWaPhone,
  waCodeInput,
  setWaCodeInput,
  waStep,
  waError,
  waLoading,
  waLinkedPhone,
  onSendWaCode,
  onVerifyWaCode,
}) {
  if (!account) {
    return (
      <div className={compact ? "" : "pga-card px-4 py-4"}>
        {!compact && (
          <p className="mb-3" style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
            Sign in with Google to keep your goals, tasks, and chats saved to your account — pick up right where
            you left off on any device.
          </p>
        )}
        {showGoogleButton ? (
          <>
            <button
              onClick={onGoogleSignIn}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                width: "100%",
                padding: "11px 16px",
                borderRadius: "999px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: "14.5px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Continue with Google
            </button>
            {googleError && (
              <p className="mt-2" style={{ fontSize: "12.5px", color: "var(--danger)" }}>
                {googleError}
              </p>
            )}
          </>
        ) : (
          <p style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>
            Google sign-in isn't set up yet. Your data still saves on this device.
          </p>
        )}
      </div>
    );
  }

  const label = `Signed in as ${account.email}`;

  return (
    <div className={compact ? "" : "pga-card px-4 py-4"}>
      <div className="flex items-center gap-2" style={{ fontSize: compact ? "12.5px" : "13.5px", color: "var(--ink-soft)" }}>
        <CheckCircle2 size={14} color="var(--success)" />
        <span style={{ flex: 1 }}>{label}</span>
        {!compact && (
          <button onClick={onUnlink} style={{ color: "var(--accent)", fontWeight: 600 }}>
            Sign out
          </button>
        )}
      </div>

      {account.type === "google" && !compact && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          {waLinkedPhone ? (
            <div className="flex items-center gap-2" style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>
              <CheckCircle2 size={13} color="var(--success)" />
              <span>Also linked to WhatsApp ({waLinkedPhone})</span>
            </div>
          ) : (
            <>
              <p className="mb-2" style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>
                Also chat with Proceed on WhatsApp:
              </p>
              {waStep === "idle" && (
                <div className="flex gap-2">
                  <input
                    className="pga-input"
                    placeholder="+1 555 123 4567"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onSendWaCode()}
                    disabled={waLoading}
                  />
                  <button className="pga-btn-primary" onClick={onSendWaCode} disabled={waLoading} style={{ whiteSpace: "nowrap" }}>
                    Send code
                  </button>
                </div>
              )}
              {waStep === "sent" && (
                <div className="flex gap-2">
                  <input
                    className="pga-input"
                    placeholder="6-digit code"
                    value={waCodeInput}
                    onChange={(e) => setWaCodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onVerifyWaCode()}
                    disabled={waLoading}
                  />
                  <button className="pga-btn-primary" onClick={onVerifyWaCode} disabled={waLoading} style={{ whiteSpace: "nowrap" }}>
                    Verify
                  </button>
                </div>
              )}
              {waError && (
                <p className="mt-2" style={{ fontSize: "12.5px", color: "var(--danger)" }}>
                  {waError}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onToggle, onRemove }) {
  return (
    <div className="pga-task-row">
      <button onClick={() => onToggle(task.id)} className="shrink-0" aria-label="Toggle task">
        {task.done ? (
          <CheckCircle2 size={19} color="var(--success)" strokeWidth={1.75} />
        ) : (
          <Circle size={19} color="var(--ink-soft)" strokeWidth={1.75} />
        )}
      </button>
      <span
        style={{
          fontSize: "14.5px",
          color: task.done ? "var(--ink-soft)" : "var(--ink)",
          textDecoration: task.done ? "line-through" : "none",
          flex: 1,
          minWidth: 0,
        }}
      >
        {task.text}
      </span>
      <button onClick={() => onRemove(task.id)} className="shrink-0" aria-label="Remove task" style={{ color: "var(--ink-soft)" }}>
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function TodayView({
  tasks,
  goals,
  goalById,
  toggleTask,
  removeTask,
  neglectedGoal,
  showAddTask,
  setShowAddTask,
  newTaskText,
  setNewTaskText,
  newTaskGoal,
  setNewTaskGoal,
  addTask,
  isFreshStart,
  onStartOnboardingWithAI,
  account,
  onSignOut,
  onGoogleSignIn,
  showGoogleButton,
  googleError,
  waPhone,
  setWaPhone,
  waCodeInput,
  setWaCodeInput,
  waStep,
  waError,
  waLoading,
  waLinkedPhone,
  onSendWaCode,
  onVerifyWaCode,
  userName,
}) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Group tasks by goal instead of repeating a goal tag on every card —
  // each goal that has tasks gets its own section, with everything else
  // (no goal, or a goal that's since been removed) in a plain list.
  const unassignedTasks = tasks.filter((t) => !t.goalId || !goalById(t.goalId));
  const goalSections = goals
    .map((g) => ({ goal: g, tasks: tasks.filter((t) => t.goalId === g.id) }))
    .filter((section) => section.tasks.length > 0);

  // Picked once per mount, not on every render — Today unmounts when you
  // switch tabs, so coming back picks a fresh one relevant to the current
  // goals, without it changing mid-visit.
  const [inspiration] = useState(() =>
    isFreshStart ? firstInspirationForNewUsers() : pickInspiration(goals)
  );

  const personalLine = userName && inspiration.personal ? inspiration.personal(userName) : null;

  return (
    <div>
      <div className="mb-4" style={{ fontSize: "13px", color: "var(--ink-soft)" }}>{today}</div>

      <div className="pga-card px-4 py-4 mb-6 flex items-start gap-3">
        <Quote size={18} strokeWidth={1.75} color="var(--accent)" style={{ flexShrink: 0, marginTop: "2px" }} />
        <div>
          <div style={{ fontSize: "11.5px", fontWeight: 700, letterSpacing: "0.04em", color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: "4px" }}>
            Wise words &amp; inspiration
          </div>
          {personalLine ? (
            <p style={{ fontSize: "14.5px", color: "var(--ink)", lineHeight: 1.4 }}>{personalLine}</p>
          ) : (
            <>
              <p style={{ fontSize: "14.5px", color: "var(--ink)", lineHeight: 1.4, marginBottom: "4px" }}>
                "{inspiration.text}"
              </p>
              <div style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>— {inspiration.author}</div>
            </>
          )}
        </div>
      </div>

      {isFreshStart ? (
        <div className="pga-card px-6 py-10 text-center">
          <div className="flex justify-center mb-4">
            <AssistantAvatar size={48} />
          </div>
          <h2 className="pga-heading mb-2" style={{ fontSize: "19px", fontWeight: 700 }}>
            Let's set up your first goal
          </h2>
          <p className="mb-6" style={{ fontSize: "14px", color: "var(--ink-soft)", maxWidth: "440px", marginInline: "auto" }}>
            Type what you're working toward and hit Proceed.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="pga-btn-primary" onClick={onStartOnboardingWithAI}>
              Chat with Proceed
            </button>
          </div>
        </div>
      ) : (
        <>
          {neglectedGoal && (
            <div
              className="pga-card mb-6 px-4 py-3 flex items-start gap-3"
              style={{ borderColor: "var(--clay)", background: "var(--clay-soft)" }}
            >
              <AssistantAvatar size={30} />
              <p style={{ fontSize: "13.5px", color: "var(--ink)", paddingTop: "3px" }}>
                "{neglectedGoal.title}" hasn't had a completed task this week. Worth a small step today, or a
                look at whether the goal still fits.
              </p>
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="pga-card mb-4">
              <div className="pga-empty">Nothing on the list yet. Add a task below to get started.</div>
            </div>
          ) : (
            <>
              {unassignedTasks.length > 0 && (
                <div className="pga-card mb-4">
                  {unassignedTasks.map((t) => (
                    <TaskRow key={t.id} task={t} onToggle={toggleTask} onRemove={removeTask} />
                  ))}
                </div>
              )}
              {goalSections.map(({ goal, tasks: goalTasks }) => (
                <div className="mb-4" key={goal.id}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span
                      style={{ width: "8px", height: "8px", borderRadius: "50%", background: goal.color, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)" }}>{goal.title}</span>
                  </div>
                  <div className="pga-card">
                    {goalTasks.map((t) => (
                      <TaskRow key={t.id} task={t} onToggle={toggleTask} onRemove={removeTask} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {showAddTask ? (
            <div className="pga-card px-4 py-4">
              <input
                autoFocus
                className="pga-input mb-2"
                placeholder="What are you getting done?"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
              />
              <select
                className="pga-input mb-3"
                value={newTaskGoal}
                onChange={(e) => setNewTaskGoal(e.target.value)}
              >
                <option value="">No linked goal</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button className="pga-btn-primary" onClick={addTask}>Add task</button>
                <button className="pga-btn-ghost" onClick={() => setShowAddTask(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button
              className="flex items-center gap-2"
              style={{ fontSize: "14px", color: "var(--ink-soft)" }}
              onClick={() => setShowAddTask(true)}
            >
              <Plus size={16} /> Add a task
            </button>
          )}
        </>
      )}

      {/* Google sign-in is left out of the front page for now (revisit
          later) — but if someone's already signed in from before, still
          show their account status / WhatsApp linking. */}
      {account && (
        <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
          <AccountSyncCard
            compact={!isFreshStart && (account.type !== "google" || !!waLinkedPhone)}
            account={account}
            onUnlink={onSignOut}
            onGoogleSignIn={onGoogleSignIn}
            showGoogleButton={showGoogleButton}
            googleError={googleError}
            waPhone={waPhone}
            setWaPhone={setWaPhone}
            waCodeInput={waCodeInput}
            setWaCodeInput={setWaCodeInput}
            waStep={waStep}
            waError={waError}
            waLoading={waLoading}
            waLinkedPhone={waLinkedPhone}
            onSendWaCode={onSendWaCode}
            onVerifyWaCode={onVerifyWaCode}
          />
        </div>
      )}
    </div>
  );
}

// panel=true renders the compact form used in the persistent desktop
// sidebar (AppInner) instead of the full "Chat" nav view — same
// messages/input, just sized to fill its container rather than the page.
function ChatView({ messages, input, setInput, loading, error, onSend, onClear, onNavigate, panel = false }) {
  const bottomRef = useRef(null);
  const isStreaming = messages.some((m) => m.streaming);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="flex flex-col" style={{ height: panel ? "100%" : "calc(100dvh - 140px)" }}>
      <div className="flex items-center justify-between mb-1">
        <h1 className="pga-heading" style={{ fontSize: panel ? "17px" : "28px", fontWeight: 700 }}>Ask Proceed</h1>
        {messages.length > 0 && (
          <button
            onClick={onClear}
            disabled={loading}
            className="flex items-center gap-1.5"
            style={{ fontSize: "13px", color: "var(--ink-soft)", opacity: loading ? 0.5 : 1 }}
          >
            <Trash2 size={14} strokeWidth={1.75} /> {panel ? "" : "Clear chat"}
          </button>
        )}
      </div>
      {!panel && (
        <p className="mb-4" style={{ fontSize: "13.5px", color: "var(--ink-soft)" }}>
          Your assistant can see — and change — today's tasks, goals, and habits.
        </p>
      )}

      <div
        className={`pga-card flex-1 overflow-y-auto px-4 py-4 mb-3 ${panel ? "mt-3" : ""}`}
        style={{ display: "flex", flexDirection: "column", gap: "10px", overscrollBehavior: "contain" }}
      >
        {messages.length === 0 && (
          <div className="pga-empty">
            Ask me a question and hit Proceed.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}
          >
            <div
              style={{
                maxWidth: "78%",
                padding: "9px 13px",
                borderRadius: "18px",
                fontSize: "14.5px",
                lineHeight: 1.4,
                background: m.role === "user" ? "var(--accent)" : "var(--surface-2)",
                color: m.role === "user" ? "#fff" : "var(--ink)",
                whiteSpace: "pre-wrap",
              }}
            >
              {m.content}
            </div>
            {m.created && (
              <div className="flex flex-wrap gap-2">
                {m.created.task && (
                  <button
                    className="pga-btn-ghost"
                    style={{ fontSize: "12px", padding: "5px 12px" }}
                    onClick={() => onNavigate("today")}
                  >
                    View Todo
                  </button>
                )}
                {m.created.habit && (
                  <button
                    className="pga-btn-ghost"
                    style={{ fontSize: "12px", padding: "5px 12px" }}
                    onClick={() => onNavigate("habits")}
                  >
                    View Habits
                  </button>
                )}
                {m.created.goal && (
                  <button
                    className="pga-btn-ghost"
                    style={{ fontSize: "12px", padding: "5px 12px" }}
                    onClick={() => onNavigate("learn")}
                  >
                    View Videos
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && !isStreaming && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "9px 13px",
                borderRadius: "18px",
                background: "var(--surface-2)",
                fontSize: "14.5px",
                color: "var(--ink-soft)",
              }}
            >
              Proceed is typing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div
          className="pga-card mb-3 px-4 py-3"
          style={{ fontSize: "13px", color: "var(--danger)", borderColor: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className="pga-input pga-chat-input"
          placeholder="Message Proceed…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          disabled={loading}
        />
        <button className="pga-btn-primary" onClick={onSend} disabled={loading || !input.trim()}>
          Proceed
        </button>
      </div>
    </div>
  );
}

function GoalsView({
  goals,
  tasks,
  doneCountForGoal,
  removeGoal,
  setGoalMedia,
  removeGoalMedia,
  showAddGoal,
  setShowAddGoal,
  newGoalTitle,
  setNewGoalTitle,
  addGoal,
}) {
  return (
    <div>
      <h1 className="pga-heading mb-1" style={{ fontSize: "28px", fontWeight: 700 }}>Active goals</h1>
      <p className="mb-6" style={{ fontSize: "13.5px", color: "var(--ink-soft)" }}>
        Every task you tag to a goal counts here, automatically.
      </p>

      {goals.length === 0 && (
        <div className="pga-card mb-5">
          <div className="pga-empty">No goals yet. Add one below, or ask Proceed in Chat to help you set one up.</div>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-5">
        {goals.map((g) => {
          const done = doneCountForGoal(g.id);
          const pct = Math.min(100, Math.round((done / g.target) * 100));
          return (
            <div className="pga-card px-4 py-4" key={g.id}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="pga-heading" style={{ fontSize: "17px", fontWeight: 600, minWidth: 0 }}>{g.title}</span>
                <div className="flex items-center gap-3" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>{done} / {g.target} this week</span>
                  <button
                    onClick={() => removeGoal(g.id)}
                    className="shrink-0"
                    aria-label="Remove goal"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {g.media ? (
                <div className="relative mb-3" style={{ borderRadius: "6px", overflow: "hidden" }}>
                  {g.media.type === "video" ? (
                    <video
                      src={g.media.url}
                      controls
                      style={{ width: "100%", maxHeight: "160px", objectFit: "cover", borderRadius: "6px" }}
                    />
                  ) : (
                    <img
                      src={g.media.url}
                      alt={g.title}
                      style={{ width: "100%", maxHeight: "160px", objectFit: "cover", borderRadius: "6px" }}
                    />
                  )}
                  <button
                    onClick={() => removeGoalMedia(g.id)}
                    aria-label="Remove media"
                    style={{
                      position: "absolute",
                      top: "6px",
                      right: "6px",
                      background: "rgba(0,0,0,0.55)",
                      borderRadius: "999px",
                      padding: "4px",
                      color: "#fff",
                      display: "flex",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label
                  className="pga-btn-ghost"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12.5px",
                    padding: "6px 10px",
                    cursor: "pointer",
                    marginBottom: "10px",
                  }}
                >
                  <ImageIcon size={14} /> Add photo or video
                  <input
                    type="file"
                    accept="image/*,video/*"
                    style={{ display: "none" }}
                    onChange={(e) => setGoalMedia(g.id, e.target.files?.[0])}
                  />
                </label>
              )}

              <div className="pga-progress-track">
                <div className="pga-progress-fill" style={{ width: `${pct}%`, background: g.color }} />
              </div>
            </div>
          );
        })}
      </div>

      {showAddGoal ? (
        <div className="pga-card px-4 py-4">
          <input
            autoFocus
            className="pga-input mb-3"
            placeholder="e.g. Get comfortable pushing back in meetings"
            value={newGoalTitle}
            onChange={(e) => setNewGoalTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGoal()}
          />
          <div className="flex gap-2">
            <button className="pga-btn-primary" onClick={addGoal}>Add goal</button>
            <button className="pga-btn-ghost" onClick={() => setShowAddGoal(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          className="flex items-center gap-2"
          style={{ fontSize: "14px", color: "var(--ink-soft)" }}
          onClick={() => setShowAddGoal(true)}
        >
          <Plus size={16} /> Add a goal
        </button>
      )}
    </div>
  );
}

function HabitsView({
  habits,
  toggleHabit,
  removeHabit,
  showAddHabit,
  setShowAddHabit,
  newHabitText,
  setNewHabitText,
  addHabit,
  notifPermission,
  requestNotifPermission,
  pushEnabled,
  isSignedIn,
}) {
  const doneCount = habits.filter((h) => h.done).length;

  return (
    <div>
      <h1 className="pga-heading mb-1" style={{ fontSize: "28px", fontWeight: 700 }}>Daily habits</h1>
      <p className="mb-6" style={{ fontSize: "13.5px", color: "var(--ink-soft)" }}>
        {doneCount} / {habits.length} done today. Leave one unchecked and Proceed will keep nudging you.
      </p>

      {notifPermission === "default" && (
        <div className="pga-card mb-4 px-4 py-3 flex items-center justify-between gap-3">
          <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
            Turn on notifications so nudges reach you even with the app closed.
          </span>
          <button
            className="pga-btn-ghost"
            style={{ fontSize: "12.5px", padding: "6px 12px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "6px" }}
            onClick={requestNotifPermission}
          >
            <Bell size={14} /> Enable
          </button>
        </div>
      )}
      {notifPermission === "denied" && (
        <div className="pga-card mb-4 px-4 py-3" style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>
          Notifications are blocked. Proceed will still nudge you in-app while it's open.
        </div>
      )}
      {notifPermission === "granted" && !isSignedIn && (
        <div className="pga-card mb-4 px-4 py-3" style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>
          Notifications are on for while the app's open. Sign in with Google to also get nudges when it's closed.
        </div>
      )}
      {notifPermission === "granted" && isSignedIn && pushEnabled && (
        <div className="pga-card mb-4 px-4 py-3 flex items-center gap-2" style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>
          <CheckCircle2 size={14} color="var(--success)" />
          Background alerts are on — nudges reach you even with the app closed.
        </div>
      )}

      <div className="pga-card mb-4">
        {habits.length === 0 && (
          <div className="pga-empty">No habits yet. Add one below, or ask Proceed in Chat to suggest some.</div>
        )}
        {habits.map((h) => (
          <div className="pga-task-row" key={h.id}>
            <button onClick={() => toggleHabit(h.id)} className="shrink-0" aria-label="Toggle habit">
              {h.done ? (
                <CheckCircle2 size={19} color="var(--success)" strokeWidth={1.75} />
              ) : (
                <Circle size={19} color="var(--ink-soft)" strokeWidth={1.75} />
              )}
            </button>
            <span
              style={{
                fontSize: "14.5px",
                color: h.done ? "var(--ink-soft)" : "var(--ink)",
                textDecoration: h.done ? "line-through" : "none",
                flex: 1,
                minWidth: 0,
              }}
            >
              {h.title}
            </span>
            <button
              onClick={() => removeHabit(h.id)}
              className="shrink-0"
              aria-label="Remove habit"
              style={{ color: "var(--ink-soft)" }}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>
        ))}
      </div>

      {showAddHabit ? (
        <div className="pga-card px-4 py-4">
          <input
            autoFocus
            className="pga-input mb-3"
            placeholder="e.g. 10-minute walk"
            value={newHabitText}
            onChange={(e) => setNewHabitText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHabit()}
          />
          <div className="flex gap-2">
            <button className="pga-btn-primary" onClick={addHabit}>Add habit</button>
            <button className="pga-btn-ghost" onClick={() => setShowAddHabit(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          className="flex items-center gap-2"
          style={{ fontSize: "14px", color: "var(--ink-soft)" }}
          onClick={() => setShowAddHabit(true)}
        >
          <Plus size={16} /> Add a habit
        </button>
      )}
    </div>
  );
}

// Pulls a handful of YouTube videos per goal on demand (not automatically,
// to keep API quota usage down) and plays them inline via an embedded
// player instead of just linking out to YouTube.
function LearnView({ goals, watchList, onSaveVideo, onRemoveVideo }) {
  const [videosByGoal, setVideosByGoal] = useState({}); // { [goalId]: { loading, error, items } }
  const [playing, setPlaying] = useState({}); // { [goalId]: videoId }
  const [watchLaterPlaying, setWatchLaterPlaying] = useState(null);
  const savedIds = new Set(watchList.map((v) => v.id));
  // Tracks which goals we've already kicked off an automatic search for, so
  // the auto-search effect never re-fires for the same goal (avoids burning
  // YouTube quota every time this view re-renders); manual "Refresh" clicks
  // bypass this entirely and always re-search.
  const autoSearched = useRef(new Set());

  async function loadVideos(goal) {
    setVideosByGoal((prev) => ({ ...prev, [goal.id]: { ...prev[goal.id], loading: true, error: null } }));
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(goal.title)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load videos.");
      setVideosByGoal((prev) => ({ ...prev, [goal.id]: { loading: false, error: null, items: data.items || [] } }));
    } catch (err) {
      setVideosByGoal((prev) => ({
        ...prev,
        [goal.id]: { loading: false, error: err.message, items: prev[goal.id]?.items || [] },
      }));
    }
  }

  // Automatically find courses for every goal instead of waiting for a
  // click — each goal only triggers one auto-search ever (per page load),
  // since results are cached server-side anyway.
  useEffect(() => {
    goals.forEach((goal) => {
      if (autoSearched.current.has(goal.id)) return;
      autoSearched.current.add(goal.id);
      loadVideos(goal);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  return (
    <div>
      <h1 className="pga-heading mb-1" style={{ fontSize: "28px", fontWeight: 700 }}>Learn</h1>
      <p className="mb-6" style={{ fontSize: "13.5px", color: "var(--ink-soft)" }}>
        YouTube videos picked for what you're working toward — pulled per goal, playable right here.
      </p>

      {watchList.length > 0 && (
        <div className="pga-card px-4 py-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Bookmark size={16} color="var(--accent)" fill="var(--accent)" />
            <span style={{ fontWeight: 600, fontSize: "15px" }}>Watch Later</span>
          </div>

          {watchLaterPlaying && (
            <div
              className="mb-3"
              style={{ position: "relative", paddingTop: "56.25%", borderRadius: "10px", overflow: "hidden" }}
            >
              <iframe
                src={`https://www.youtube.com/embed/${watchLaterPlaying}?autoplay=1`}
                title="YouTube video player"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
              />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {watchList.map((v) => (
              <div key={v.id} style={{ textAlign: "left" }}>
                <div
                  onClick={() => setWatchLaterPlaying(v.id)}
                  style={{ position: "relative", borderRadius: "8px", overflow: "hidden", marginBottom: "4px", cursor: "pointer" }}
                >
                  <img src={v.thumbnail} alt={v.title} style={{ width: "100%", display: "block" }} />
                  <PlayCircle
                    size={28}
                    color="#fff"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))",
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveVideo(v.id);
                      if (watchLaterPlaying === v.id) setWatchLaterPlaying(null);
                    }}
                    aria-label="Remove from watch list"
                    style={{
                      position: "absolute",
                      top: "4px",
                      right: "4px",
                      background: "rgba(0,0,0,0.55)",
                      borderRadius: "999px",
                      padding: "4px",
                      display: "flex",
                    }}
                  >
                    <X size={13} color="#fff" strokeWidth={2} />
                  </button>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--ink)",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {v.title}
                </span>
                {v.goalTitle && (
                  <div style={{ fontSize: "11px", color: "var(--ink-soft)" }}>{v.goalTitle}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <div className="pga-card">
          <div className="pga-empty">Add a goal first, then come back here to find videos for it.</div>
        </div>
      ) : (
        goals.map((goal) => {
          const state = videosByGoal[goal.id];
          const nowPlaying = playing[goal.id];
          return (
            <div className="pga-card px-4 py-4 mb-4" key={goal.id}>
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                  <span
                    style={{ width: "8px", height: "8px", borderRadius: "50%", background: goal.color, flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: "15px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {goal.title}
                  </span>
                </div>
                <button
                  className="pga-btn-ghost"
                  style={{ padding: "6px 12px", fontSize: "12.5px" }}
                  onClick={() => loadVideos(goal)}
                  disabled={state?.loading}
                >
                  {state?.loading ? "Loading…" : state ? "Refresh" : "Find videos"}
                </button>
              </div>

              {state?.error && (
                <p className="mb-2" style={{ fontSize: "12.5px", color: "var(--danger)" }}>
                  {state.error}
                </p>
              )}

              {nowPlaying && (
                <div
                  className="mb-3"
                  style={{ position: "relative", paddingTop: "56.25%", borderRadius: "10px", overflow: "hidden" }}
                >
                  <iframe
                    src={`https://www.youtube.com/embed/${nowPlaying}?autoplay=1`}
                    title="YouTube video player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                  />
                </div>
              )}

              {state?.items?.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {state.items.map((v) => {
                    const isSaved = savedIds.has(v.id);
                    return (
                      <div key={v.id} style={{ textAlign: "left" }}>
                        <div
                          onClick={() => setPlaying((p) => ({ ...p, [goal.id]: v.id }))}
                          style={{ position: "relative", borderRadius: "8px", overflow: "hidden", marginBottom: "4px", cursor: "pointer" }}
                        >
                          <img src={v.thumbnail} alt={v.title} style={{ width: "100%", display: "block" }} />
                          <PlayCircle
                            size={28}
                            color="#fff"
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))",
                            }}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSaved) onRemoveVideo(v.id);
                              else onSaveVideo(v, goal);
                            }}
                            aria-label={isSaved ? "Remove from watch list" : "Save to watch list"}
                            style={{
                              position: "absolute",
                              top: "4px",
                              right: "4px",
                              background: "rgba(0,0,0,0.55)",
                              borderRadius: "999px",
                              padding: "4px",
                              display: "flex",
                            }}
                          >
                            <Bookmark size={14} color={isSaved ? "#FFD60A" : "#fff"} fill={isSaved ? "#FFD60A" : "none"} strokeWidth={2} />
                          </button>
                        </div>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--ink)",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {v.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {!state && (
                <p style={{ fontSize: "12.5px", color: "var(--ink-soft)" }}>Looking for courses…</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function ReflectView({ reflections, reflectDraft, setReflectDraft, submitReflection }) {
  const energies = ["Low", "Steady", "Strong"];
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <AssistantAvatar size={30} />
        <h1 className="pga-heading" style={{ fontSize: "28px", fontWeight: 700 }}>Weekly check-in</h1>
      </div>
      <p className="mb-6" style={{ fontSize: "13.5px", color: "var(--ink-soft)" }}>
        Three short questions. Takes about two minutes.
      </p>

      <div className="pga-card px-4 py-4 mb-6">
        <label style={{ fontSize: "13px", color: "var(--ink-soft)" }}>What went well this week?</label>
        <textarea
          className="pga-input mt-1 mb-3"
          rows={2}
          value={reflectDraft.win}
          onChange={(e) => setReflectDraft((d) => ({ ...d, win: e.target.value }))}
        />
        <label style={{ fontSize: "13px", color: "var(--ink-soft)" }}>Where did you get stuck?</label>
        <textarea
          className="pga-input mt-1 mb-3"
          rows={2}
          value={reflectDraft.friction}
          onChange={(e) => setReflectDraft((d) => ({ ...d, friction: e.target.value }))}
        />
        <label style={{ fontSize: "13px", color: "var(--ink-soft)" }}>Energy this week</label>
        <div className="pga-segment mt-2 mb-4">
          {energies.map((e) => (
            <button
              key={e}
              onClick={() => setReflectDraft((d) => ({ ...d, energy: e }))}
              className={reflectDraft.energy === e ? "active" : ""}
            >
              {e}
            </button>
          ))}
        </div>
        <button className="pga-btn-primary" onClick={submitReflection}>Save check-in</button>
      </div>

      <h2 className="pga-heading mb-3" style={{ fontSize: "17px", fontWeight: 600 }}>Past check-ins</h2>
      <div className="flex flex-col gap-3">
        {reflections.map((r) => (
          <div className="pga-card px-4 py-3" key={r.id}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>{r.week}</span>
              <span className="pga-chip" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                {r.energy}
              </span>
            </div>
            {r.win && <p style={{ fontSize: "14px", marginBottom: "4px" }}>{r.win}</p>}
            {r.friction && <p style={{ fontSize: "14px", color: "var(--ink-soft)" }}>{r.friction}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendsView({ goals }) {
  const maxVal = Math.max(...trendWeeks.flatMap((w) => goals.map((g) => w[g.id] || 0)), 1);

  return (
    <div>
      <h1 className="pga-heading mb-1" style={{ fontSize: "28px", fontWeight: 700 }}>Four-week momentum</h1>
      <p className="mb-6" style={{ fontSize: "13.5px", color: "var(--ink-soft)" }}>
        Completed tasks per goal, by week.
      </p>

      <div className="pga-card px-5 py-6">
        <div className="flex items-end gap-6" style={{ height: "150px" }}>
          {trendWeeks.map((w) => (
            <div key={w.week} className="pga-bar-col" style={{ height: "100%", flex: 1 }}>
              <div className="flex items-end gap-1.5" style={{ height: "100%" }}>
                {goals.map((g) => {
                  const v = w[g.id] || 0;
                  const h = Math.max(4, Math.round((v / maxVal) * 100));
                  return (
                    <div
                      key={g.id}
                      title={`${g.title}: ${v}`}
                      style={{
                        width: "12px",
                        height: `${h}%`,
                        background: g.color,
                        borderRadius: "3px 3px 0 0",
                      }}
                    />
                  );
                })}
              </div>
              <span style={{ fontSize: "12px", color: "var(--ink-soft)", textAlign: "center" }}>{w.week}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-4 mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          {goals.map((g) => (
            <div key={g.id} className="flex items-center gap-2">
              <span style={{ width: "9px", height: "9px", borderRadius: "2px", background: g.color, display: "inline-block" }} />
              <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>{g.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
