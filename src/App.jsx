import React, { useState, useMemo, useEffect, useRef } from "react";
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
} from "lucide-react";

const NAG_INTERVAL_MS = 30 * 60 * 1000;

const initialGoals = [
  { id: "g1", title: "Build public speaking confidence", target: 3, color: "#34C759", media: null },
  { id: "g2", title: "Strengthen delegation habits", target: 2, color: "#FF9500", media: null },
  { id: "g3", title: "Deepen SQL & data fluency", target: 4, color: "#5856D6", media: null },
];

const initialHabits = [
  { id: "h1", title: "Drink 2L of water", done: false },
  { id: "h2", title: "Stretch for 10 minutes", done: false },
  { id: "h3", title: "Lights out by 11pm", done: false },
];

const initialTasks = [
  { id: "t1", text: "Volunteer to lead Thursday's standup", goalId: "g1", done: true },
  { id: "t2", text: "Record a 2-minute practice pitch", goalId: "g1", done: false },
  { id: "t3", text: "Hand off the onboarding doc to Priya", goalId: "g2", done: true },
  { id: "t4", text: "Let the team decide the sprint order", goalId: "g2", done: false },
  { id: "t5", text: "Finish the window functions exercise", goalId: "g3", done: false },
  { id: "t6", text: "Rewrite yesterday's report query", goalId: "g3", done: true },
  { id: "t7", text: "Reply to the client escalation email", goalId: null, done: false },
];

const initialReflections = [
  {
    id: "r1",
    week: "Sep 1–7",
    win: "Led the retro without notes for the first time.",
    friction: "Kept saying yes to extra meetings.",
    energy: "Steady",
  },
];

const trendWeeks = [
  { week: "Wk 1", g1: 1, g2: 1, g3: 2 },
  { week: "Wk 2", g1: 2, g2: 0, g3: 3 },
  { week: "Wk 3", g1: 1, g2: 2, g3: 2 },
  { week: "Wk 4", g1: 2, g2: 1, g3: 4 },
];

const NAV = [
  { id: "today", label: "Today", icon: ListTodo },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "goals", label: "Goals", icon: Target },
  { id: "habits", label: "Habits", icon: HeartPulse },
  { id: "reflect", label: "Reflect", icon: MessageSquareText },
  { id: "trends", label: "Trends", icon: TrendingUp },
];

// Flat, illustrated avatar for the assistant persona — appears anywhere
// the app is "speaking" to the user (nudges, check-in prompts, sidebar id).
function AssistantAvatar({ size = 40 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        background: "#E4DFC9",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        {/* shoulders / suit jacket */}
        <path d="M4 40C4 29 11 24 20 24C29 24 36 29 36 40Z" fill="#242320" />
        {/* lapels */}
        <path d="M15 25L20 34L17.5 26.5Z" fill="#1B1A17" />
        <path d="M25 25L20 34L22.5 26.5Z" fill="#1B1A17" />
        {/* shirt */}
        <path d="M16 26L20 33L24 26L23 24.5H17Z" fill="#FBFAF6" />
        {/* tie */}
        <path d="M18.7 26.5L20 30.5L21.3 26.5L20 25.3Z" fill="#3F5B45" />
        {/* neck */}
        <rect x="16.5" y="19" width="7" height="7" fill="#7A4A2E" />
        {/* head */}
        <circle cx="20" cy="14" r="9" fill="#8A5636" />
        {/* short hair */}
        <path
          d="M11 14C11 7.5 15 4.5 20 4.5C25 4.5 29 7.5 29 14C29 10.5 26.5 8.5 20 8.5C13.5 8.5 11 10.5 11 14Z"
          fill="#1B140F"
        />
        {/* low fade sides */}
        <path d="M11.5 14.5C11 12.5 11.3 10.8 12.3 9.5C11.6 11 11.4 12.8 11.8 14.8Z" fill="#1B140F" />
        <path d="M28.5 14.5C29 12.5 28.7 10.8 27.7 9.5C28.4 11 28.6 12.8 28.2 14.8Z" fill="#1B140F" />
      </svg>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("today");
  const [goals, setGoals] = useState(initialGoals);
  const [tasks, setTasks] = useState(initialTasks);
  const [reflections, setReflections] = useState(initialReflections);

  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskGoal, setNewTaskGoal] = useState("");

  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");

  const [reflectDraft, setReflectDraft] = useState({ win: "", friction: "", energy: "Steady" });

  const [habits, setHabits] = useState(initialHabits);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitText, setNewHabitText] = useState("");
  const [notifPermission, setNotifPermission] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported"
  );
  const [nagHabit, setNagHabit] = useState(null);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);

  const habitsRef = useRef(habits);
  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

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

  function requestNotifPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission().then(setNotifPermission);
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
    if (!title || !title.trim()) return "No goal title given.";
    const palette = ["#34C759", "#FF9500", "#5856D6", "#FF2D55", "#30B0C7"];
    const color = palette[goals.length % palette.length];
    const id = `g${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setGoals((prev) => [...prev, { id, title: title.trim(), target: target > 0 ? target : 3, color, media: null }]);
    return `Added goal "${title.trim()}".`;
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

  function executeToolCall(call) {
    let args = {};
    try {
      args = JSON.parse(call.function.arguments || "{}");
    } catch {
      return "Couldn't parse that action's arguments.";
    }
    switch (call.function.name) {
      case "add_task":
        return addTaskDirect(args.text, args.goalId);
      case "remove_task":
        return removeTaskDirect(args.id);
      case "set_task_done":
        return setTaskDoneDirect(args.id, args.done);
      case "add_goal":
        return addGoalDirect(args.title, args.target);
      case "remove_goal":
        return removeGoalDirect(args.id);
      case "add_habit":
        return addHabitDirect(args.title);
      case "remove_habit":
        return removeHabitDirect(args.id);
      case "set_habit_done":
        return setHabitDoneDirect(args.id, args.done);
      default:
        return `Unknown action "${call.function.name}".`;
    }
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const nextMessages = [...chatMessages, { role: "user", content: text }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatError(null);
    setChatLoading(true);

    try {
      const context = buildAppContext();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      if (data.toolCalls?.length) {
        const toolResults = data.toolCalls.map((call) => ({
          role: "tool",
          tool_call_id: call.id,
          content: executeToolCall(call),
        }));

        const followUpMessages = [
          ...nextMessages,
          { role: "assistant", content: data.reply ?? null, tool_calls: data.toolCalls },
          ...toolResults,
        ];

        const res2 = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: followUpMessages, context, toolChoice: "none" }),
        });
        const data2 = await res2.json();
        if (!res2.ok) throw new Error(data2.error || "Something went wrong.");
        setChatMessages((prev) => [...prev, { role: "assistant", content: data2.reply }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (err) {
      setChatError(err.message || "Couldn't reach Marvin. Is the chat server running?");
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
    <div className="pga-app min-h-screen w-full flex">
      <style>{`
        .pga-app {
          --bg: #F2F2F7;
          --surface: #FFFFFF;
          --surface-2: #F2F2F7;
          --ink: #000000;
          --ink-soft: rgba(60, 60, 67, 0.6);
          --accent: #007AFF;
          --accent-soft: rgba(0, 122, 255, 0.12);
          --success: #34C759;
          --danger: #FF3B30;
          --clay: #FF9500;
          --clay-soft: rgba(255, 149, 0, 0.12);
          --border: rgba(60, 60, 67, 0.22);
          --shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
          background: var(--bg);
          color: var(--ink);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        @media (prefers-color-scheme: dark) {
          .pga-app {
            --bg: #000000;
            --surface: #1C1C1E;
            --surface-2: #2C2C2E;
            --ink: #FFFFFF;
            --ink-soft: rgba(235, 235, 245, 0.6);
            --accent: #0A84FF;
            --accent-soft: rgba(10, 132, 255, 0.18);
            --success: #30D158;
            --danger: #FF453A;
            --clay: #FF9F0A;
            --clay-soft: rgba(255, 159, 10, 0.18);
            --border: rgba(84, 84, 88, 0.6);
            --shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
        }

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

        .pga-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
        }

        .pga-task-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          transition: background 0.12s ease;
        }
        .pga-task-row:last-child { border-bottom: none; }
        .pga-task-row:hover { background: rgba(120, 120, 128, 0.06); }

        .pga-chip {
          font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
          display: inline-flex; align-items: center; gap: 5px;
          white-space: nowrap;
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
        }
        .pga-btn-primary:hover { opacity: 0.88; }
        .pga-btn-primary:active { opacity: 0.7; }

        .pga-btn-ghost {
          background: var(--surface-2); color: var(--accent);
          border: none; border-radius: 12px;
          padding: 10px 16px; font-size: 15px; font-weight: 600; cursor: pointer;
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
      `}</style>

      {/* Sidebar */}
      <aside
        className="w-56 shrink-0 border-r px-4 py-6 hidden sm:flex flex-col gap-1"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <AssistantAvatar size={34} />
          <div>
            <div className="pga-heading" style={{ fontSize: "17px", fontWeight: 700, lineHeight: 1.1 }}>
              Marvin
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--ink-soft)" }}>your assistant</div>
          </div>
        </div>
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`pga-nav-btn ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
            >
              <Icon size={16} strokeWidth={1.75} />
              {item.label}
            </button>
          );
        })}
      </aside>

      {/* Main */}
      <main className="flex-1 px-5 pt-7 pb-24 sm:px-10 sm:py-10 sm:pb-10 max-w-2xl">
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
          />
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

      {/* Mobile bottom nav */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 flex items-stretch"
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
    </div>
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
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", flex: 1 }}>Marvin</span>
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
}) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div>
      <div className="mb-1" style={{ fontSize: "13px", color: "var(--ink-soft)" }}>{today}</div>
      <h1 className="pga-heading mb-6" style={{ fontSize: "28px", fontWeight: 700 }}>
        What moves you forward today
      </h1>

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

      <div className="pga-card mb-4">
        {tasks.length === 0 && (
          <div className="pga-empty">Nothing on the list yet. Add a task below to get started.</div>
        )}
        {tasks.map((t) => {
          const goal = goalById(t.goalId);
          return (
            <div className="pga-task-row" key={t.id}>
              <button onClick={() => toggleTask(t.id)} className="shrink-0" aria-label="Toggle task">
                {t.done ? (
                  <CheckCircle2 size={19} color="var(--success)" strokeWidth={1.75} />
                ) : (
                  <Circle size={19} color="var(--ink-soft)" strokeWidth={1.75} />
                )}
              </button>
              <span
                style={{
                  fontSize: "14.5px",
                  color: t.done ? "var(--ink-soft)" : "var(--ink)",
                  textDecoration: t.done ? "line-through" : "none",
                  flex: 1,
                }}
              >
                {t.text}
              </span>
              {goal && (
                <span className="pga-chip" style={{ background: goal.color + "22", color: goal.color }}>
                  {goal.title.length > 22 ? goal.title.slice(0, 22) + "…" : goal.title}
                </span>
              )}
              <button
                onClick={() => removeTask(t.id)}
                className="shrink-0"
                aria-label="Remove task"
                style={{ color: "var(--ink-soft)" }}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}

function ChatView({ messages, input, setInput, loading, error, onSend }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 140px)", minHeight: "420px" }}>
      <h1 className="pga-heading mb-1" style={{ fontSize: "28px", fontWeight: 700 }}>Ask Marvin</h1>
      <p className="mb-4" style={{ fontSize: "13.5px", color: "var(--ink-soft)" }}>
        Your assistant can see — and change — today's tasks, goals, and habits.
      </p>

      <div
        className="pga-card flex-1 overflow-y-auto px-4 py-4 mb-3"
        style={{ display: "flex", flexDirection: "column", gap: "10px" }}
      >
        {messages.length === 0 && (
          <div className="pga-empty">
            Ask about your goals, or tell Marvin to add, complete, or remove a task, goal, or habit.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
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
          </div>
        ))}
        {loading && (
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
              Marvin is typing…
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
          className="pga-input"
          placeholder="Message Marvin…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
          disabled={loading}
        />
        <button className="pga-btn-primary" onClick={onSend} disabled={loading || !input.trim()}>
          Send
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

      <div className="flex flex-col gap-3 mb-5">
        {goals.map((g) => {
          const done = doneCountForGoal(g.id);
          const pct = Math.min(100, Math.round((done / g.target) * 100));
          return (
            <div className="pga-card px-4 py-4" key={g.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="pga-heading" style={{ fontSize: "17px", fontWeight: 600 }}>{g.title}</span>
                <div className="flex items-center gap-3">
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
}) {
  const doneCount = habits.filter((h) => h.done).length;

  return (
    <div>
      <h1 className="pga-heading mb-1" style={{ fontSize: "28px", fontWeight: 700 }}>Daily habits</h1>
      <p className="mb-6" style={{ fontSize: "13.5px", color: "var(--ink-soft)" }}>
        {doneCount} / {habits.length} done today. Leave one unchecked and Marvin will keep nudging you.
      </p>

      {notifPermission === "default" && (
        <div className="pga-card mb-4 px-4 py-3 flex items-center justify-between gap-3">
          <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
            Turn on browser notifications so nudges reach you even in another tab.
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
          Notifications are blocked. Marvin will still nudge you in-app while it's open.
        </div>
      )}

      <div className="pga-card mb-4">
        {habits.length === 0 && (
          <div className="pga-empty">No habits yet. Add one below to start tracking.</div>
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
