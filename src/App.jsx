import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Target,
  MessageSquareText,
  TrendingUp,
  X,
  ListTodo,
} from "lucide-react";

const initialGoals = [
  { id: "g1", title: "Build public speaking confidence", target: 3, color: "#3F5B45" },
  { id: "g2", title: "Strengthen delegation habits", target: 2, color: "#7D6A4F" },
  { id: "g3", title: "Deepen SQL & data fluency", target: 4, color: "#4A6670" },
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
  { id: "goals", label: "Goals", icon: Target },
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
    const palette = ["#3F5B45", "#7D6A4F", "#4A6670", "#8B5A3C", "#5B4B6E"];
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
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&display=swap');

        .pga-app {
          --bg: #EFEDE6;
          --surface: #FBFAF6;
          --ink: #2B2A26;
          --ink-soft: #6B6558;
          --accent: #3F5B45;
          --accent-soft: #DCE3D6;
          --clay: #A6603B;
          --clay-soft: #EFDDCF;
          --border: #DDD9CC;
          background: var(--bg);
          color: var(--ink);
          font-family: 'Work Sans', sans-serif;
        }
        .pga-serif { font-family: 'Fraunces', serif; }

        .pga-nav-btn {
          display: flex; align-items: center; gap: 10px;
          width: 100%; text-align: left;
          padding: 9px 12px; border-radius: 6px;
          font-size: 14px; color: var(--ink-soft);
          border: 1px solid transparent;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .pga-nav-btn:hover { background: rgba(0,0,0,0.03); color: var(--ink); }
        .pga-nav-btn.active {
          background: var(--surface); color: var(--ink);
          border-color: var(--border);
        }

        .pga-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
        }

        .pga-task-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
        }
        .pga-task-row:last-child { border-bottom: none; }

        .pga-chip {
          font-size: 11.5px; padding: 2px 9px; border-radius: 999px;
          display: inline-flex; align-items: center; gap: 5px;
          white-space: nowrap;
        }

        .pga-input {
          width: 100%; background: var(--surface); border: 1px solid var(--border);
          border-radius: 6px; padding: 9px 11px; font-size: 14px; color: var(--ink);
          font-family: 'Work Sans', sans-serif;
        }
        .pga-input:focus { outline: none; border-color: var(--accent); }

        .pga-btn-primary {
          background: var(--accent); color: #FBFAF6;
          border-radius: 6px; padding: 9px 16px; font-size: 14px;
          border: none; cursor: pointer;
        }
        .pga-btn-primary:hover { opacity: 0.92; }

        .pga-btn-ghost {
          background: transparent; color: var(--ink-soft);
          border: 1px solid var(--border); border-radius: 6px;
          padding: 9px 14px; font-size: 14px; cursor: pointer;
        }
        .pga-btn-ghost:hover { color: var(--ink); border-color: var(--ink-soft); }

        .pga-progress-track {
          height: 5px; border-radius: 999px; background: var(--border); overflow: hidden;
        }
        .pga-progress-fill { height: 100%; border-radius: 999px; }

        .pga-bar-col { display: flex; flex-direction: column; justify-content: flex-end; gap: 3px; }

        .pga-task-row { transition: background 0.12s ease; }
        .pga-task-row:hover { background: rgba(0,0,0,0.015); }

        .pga-app button:focus-visible,
        .pga-app input:focus-visible,
        .pga-app select:focus-visible,
        .pga-app textarea:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .pga-empty {
          text-align: center; padding: 34px 20px; color: var(--ink-soft); font-size: 13.5px;
        }
      `}</style>

      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r px-4 py-6 hidden sm:flex flex-col gap-1" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <AssistantAvatar size={34} />
          <div>
            <div className="pga-serif" style={{ fontSize: "16px", fontWeight: 500, lineHeight: 1.1 }}>
              Waypoint
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

        {view === "goals" && (
          <GoalsView
            goals={goals}
            tasks={tasks}
            doneCountForGoal={doneCountForGoal}
            showAddGoal={showAddGoal}
            setShowAddGoal={setShowAddGoal}
            newGoalTitle={newGoalTitle}
            setNewGoalTitle={setNewGoalTitle}
            addGoal={addGoal}
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
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
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
              <Icon size={19} strokeWidth={1.75} />
              <span style={{ fontSize: "10.5px" }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function TodayView({
  tasks,
  goals,
  goalById,
  toggleTask,
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
      <h1 className="pga-serif mb-6" style={{ fontSize: "26px", fontWeight: 500 }}>
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
                  <CheckCircle2 size={19} color="var(--accent)" strokeWidth={1.75} />
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

function GoalsView({ goals, tasks, doneCountForGoal, showAddGoal, setShowAddGoal, newGoalTitle, setNewGoalTitle, addGoal }) {
  return (
    <div>
      <h1 className="pga-serif mb-1" style={{ fontSize: "26px", fontWeight: 500 }}>Active goals</h1>
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
                <span className="pga-serif" style={{ fontSize: "16px", fontWeight: 500 }}>{g.title}</span>
                <span style={{ fontSize: "13px", color: "var(--ink-soft)" }}>{done} / {g.target} this week</span>
              </div>
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

function ReflectView({ reflections, reflectDraft, setReflectDraft, submitReflection }) {
  const energies = ["Low", "Steady", "Strong"];
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <AssistantAvatar size={30} />
        <h1 className="pga-serif" style={{ fontSize: "26px", fontWeight: 500 }}>Weekly check-in</h1>
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
        <div className="flex gap-2 mt-2 mb-4">
          {energies.map((e) => (
            <button
              key={e}
              onClick={() => setReflectDraft((d) => ({ ...d, energy: e }))}
              className="pga-chip"
              style={{
                padding: "6px 14px",
                border: `1px solid ${reflectDraft.energy === e ? "var(--accent)" : "var(--border)"}`,
                background: reflectDraft.energy === e ? "var(--accent-soft)" : "transparent",
                color: "var(--ink)",
              }}
            >
              {e}
            </button>
          ))}
        </div>
        <button className="pga-btn-primary" onClick={submitReflection}>Save check-in</button>
      </div>

      <h2 className="pga-serif mb-3" style={{ fontSize: "16px", fontWeight: 500 }}>Past check-ins</h2>
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
      <h1 className="pga-serif mb-1" style={{ fontSize: "26px", fontWeight: 500 }}>Four-week momentum</h1>
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
