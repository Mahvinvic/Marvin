// Pure, I/O-free state helpers shared by the web chat endpoint's tool
// execution (mirrored in src/App.jsx for the browser) and the WhatsApp
// webhook, which has no browser to run tool calls against — this is the
// server-side equivalent.

function genId(prefix) {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyState() {
  return { goals: [], tasks: [], habits: [] };
}

function doneCountForGoal(state, goalId) {
  return state.tasks.filter((t) => t.goalId === goalId && t.done).length;
}

export function buildContext(state) {
  return JSON.stringify({
    goals: state.goals.map((g) => ({ id: g.id, title: g.title, target: g.target, doneThisWeek: doneCountForGoal(state, g.id) })),
    tasks: state.tasks.map((t) => ({ id: t.id, text: t.text, goalId: t.goalId, done: t.done })),
    habits: state.habits.map((h) => ({ id: h.id, title: h.title, done: h.done })),
  });
}

// Mutates titleToNewGoalId in place so it can accumulate across multiple
// rounds of one agentic turn (a goal created in round 1 must still be
// linkable by a task added in round 2).
export function executeToolCalls(state, toolCalls, titleToNewGoalId = {}) {
  let goals = [...state.goals];
  let tasks = [...state.tasks];
  let habits = [...state.habits];
  const results = new Map();

  function addGoalDirect(title, target) {
    if (!title || !title.trim()) return { message: "No goal title given.", id: null };
    const palette = ["#34C759", "#FF9500", "#5856D6", "#FF2D55", "#30B0C7"];
    const color = palette[goals.length % palette.length];
    const id = genId("g");
    goals = [...goals, { id, title: title.trim(), target: target > 0 ? target : 3, color, media: null }];
    return { message: `Added goal "${title.trim()}".`, id };
  }

  function addTaskDirect(text, goalId) {
    if (!text || !text.trim()) return "No task text given.";
    const id = genId("t");
    tasks = [{ id, text: text.trim(), goalId: goalId || null, done: false }, ...tasks];
    return `Added task "${text.trim()}".`;
  }

  function removeTaskDirect(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return `No task with id "${id}" found.`;
    tasks = tasks.filter((t) => t.id !== id);
    return `Removed task "${task.text}".`;
  }

  function setTaskDoneDirect(id, done) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return `No task with id "${id}" found.`;
    tasks = tasks.map((t) => (t.id === id ? { ...t, done: !!done } : t));
    return `Marked task "${task.text}" as ${done ? "done" : "not done"}.`;
  }

  function removeGoalDirect(id) {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return `No goal with id "${id}" found.`;
    goals = goals.filter((g) => g.id !== id);
    tasks = tasks.map((t) => (t.goalId === id ? { ...t, goalId: null } : t));
    return `Removed goal "${goal.title}".`;
  }

  function addHabitDirect(title) {
    if (!title || !title.trim()) return "No habit title given.";
    const id = genId("h");
    habits = [...habits, { id, title: title.trim(), done: false }];
    return `Added habit "${title.trim()}".`;
  }

  function removeHabitDirect(id) {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return `No habit with id "${id}" found.`;
    habits = habits.filter((h) => h.id !== id);
    return `Removed habit "${habit.title}".`;
  }

  function setHabitDoneDirect(id, done) {
    const habit = habits.find((h) => h.id === id);
    if (!habit) return `No habit with id "${id}" found.`;
    habits = habits.map((h) => (h.id === id ? { ...h, done: !!done } : h));
    return `Marked habit "${habit.title}" as ${done ? "done" : "not done"}.`;
  }

  // Pass 1: create goals first, so tasks in the same batch (or a later
  // round of the same turn) can link to a goal that didn't exist yet.
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

  const toolResults = toolCalls.map((call) => ({
    role: "tool",
    tool_call_id: call.id,
    content: results.get(call.id) ?? "No result.",
  }));

  return { state: { goals, tasks, habits }, toolResults };
}
