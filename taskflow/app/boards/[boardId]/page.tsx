"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, GripVertical, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ColumnKind = "todo" | "in-progress" | "done" | "custom";

type Column = {
  id: string;
  kind: ColumnKind;
  title: string;
  taskIds: string[];
};

type Task = {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  dueDate: string | null;
  completedAt?: string | null;
};

type BoardData = {
  id: string;
  projectId: string;
  ownerEmail: string;
  columns: Record<string, Column>;
  columnOrder: string[];
  tasks: Record<string, Task>;
};

type Project = {
  id: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  createdAt: string;
};

const PROJECTS_KEY = "taskflow-projects-v1";
const BOARDS_KEY = "taskflow-boards-v1";
const CURRENT_USER_KEY = "taskflow-current-user-v1";

/** Keep Done rightmost (scroll order) to reduce accidental “crossing over” Done. */
function withDoneLast(columnOrder: string[]) {
  const without = columnOrder.filter((id) => id !== "done");
  return columnOrder.includes("done") ? [...without, "done"] : without;
}

function createSkeletonBoard(projectId: string, ownerEmail: string): BoardData {
  return {
    id: `board-${projectId}`,
    projectId,
    ownerEmail,
    columns: {
      todo: { id: "todo", kind: "todo", title: "To Do", taskIds: [] },
      "in-progress": { id: "in-progress", kind: "in-progress", title: "In Progress", taskIds: [] },
      done: { id: "done", kind: "done", title: "Done", taskIds: [] },
    },
    columnOrder: ["todo", "in-progress", "done"],
    tasks: {},
  };
}

function isValidDate(value: string) {
  if (!value) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function getTagClass(kind: ColumnKind) {
  if (kind === "todo") return "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300";
  if (kind === "in-progress")
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  if (kind === "done") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300";
}

function getDeadlineMeta(task: Task, columnId: string) {
  if (columnId === "done") {
    const planned = task.dueDate && isValidDate(task.dueDate) ? task.dueDate : null;
    const completed = task.completedAt && isValidDate(task.completedAt) ? task.completedAt : null;
    if (!planned) {
      return { text: completed ? `Completed: ${completed}` : "Completed", className: "text-zinc-500" };
    }
    if (!completed) {
      return { text: `Planned: ${planned} | Completed: unknown`, className: "text-zinc-500" };
    }
    const isLate =
      new Date(`${completed}T00:00:00`).getTime() > new Date(`${planned}T00:00:00`).getTime();
    return {
      text: `Planned: ${planned} | Completed: ${completed}${isLate ? " (late delivered)" : ""}`,
      className: "text-zinc-500",
    };
  }

  if (!task.dueDate || !isValidDate(task.dueDate)) {
    return { text: "Deadline: not set", className: "text-zinc-500" };
  }
  const planned = new Date(`${task.dueDate}T00:00:00`);
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.ceil((planned.getTime() - dayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `Deadline: ${task.dueDate} (passed)`, className: "text-red-600 dark:text-red-400" };
  }
  if (diffDays <= 3) {
    return { text: `Deadline: ${task.dueDate} (${diffDays} days left)`, className: "text-yellow-600 dark:text-yellow-400" };
  }
  return { text: `Deadline: ${task.dueDate} (${diffDays} days left)`, className: "text-emerald-600 dark:text-emerald-400" };
}

function BoardColumn({
  column,
  tasks,
  onOpenTask,
  onDeleteColumn,
}: {
  column: Column;
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
  onDeleteColumn: (columnId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", columnId: column.id },
  });
  const canDelete = column.taskIds.length === 0;

  return (
    <section
      ref={setNodeRef}
      className={`min-h-[420px] w-[320px] shrink-0 rounded-2xl border border-zinc-200/70 bg-zinc-100/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/70 ${
        isOver ? "ring-2 ring-blue-500/60" : ""
      }`}
    >
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{column.title}</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-800">{tasks.length}</span>
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => onDeleteColumn(column.id)}
            className="rounded p-1 text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
            aria-label="Kolonu sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} column={column} onOpenTask={onOpenTask} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableTask({
  task,
  column,
  onOpenTask,
}: {
  task: Task;
  column: Column;
  onOpenTask: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", taskId: task.id, columnId: column.id },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const deadlineMeta = getDeadlineMeta(task, column.id);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-950 ${
        isDragging ? "opacity-50" : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${getTagClass(column.kind)}`}>
          {column.title}
        </span>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-1 hover:bg-zinc-100 active:cursor-grabbing dark:hover:bg-zinc-800"
          aria-label="Drag task"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
      <button 
        type="button" 
        onClick={() => {
          if (column.id !== "done") onOpenTask(task.id);
        }} 
        className={`w-full text-left ${column.id === "done" ? "cursor-default opacity-80" : "cursor-pointer"}`}
      >
        <h3 className={`text-sm font-semibold ${column.id === "done" ? "line-through text-zinc-500" : ""}`}>{task.title}</h3>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{task.description}</p>
      </button>
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className={deadlineMeta.className}>{deadlineMeta.text}</span>
        <span className="italic opacity-80">{task.createdBy}</span>
      </div>
      {/* Status badge on top is source of truth; no duplicate status buttons */}
    </article>
  );
}

export default function BoardPage() {
  const params = useParams<{ boardId: string }>();
  const router = useRouter();
  const boardId = params.boardId;

  const [isReady, setIsReady] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskError, setTaskError] = useState("");
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newColumnId, setNewColumnId] = useState("todo");
  const [createError, setCreateError] = useState("");
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [columnKindDraft, setColumnKindDraft] = useState<ColumnKind>("custom");
  const [columnTitleDraft, setColumnTitleDraft] = useState("");
  const [columnError, setColumnError] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    const rawUser = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!rawUser) {
      document.cookie = "taskflow_auth=; Max-Age=0; path=/; SameSite=Lax";
      router.replace("/login");
      return;
    }
    const user = JSON.parse(rawUser) as { email: string; fullName: string };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentUserName(user.fullName);

    // 2. PROJE KONTROLÜ: Yoksa sahte proje oluştur.
    const activeBoardId = boardId || "default-board"; // URL'de ID yoksa default kullan
    const rawProjects = window.localStorage.getItem(PROJECTS_KEY);
    const projects = rawProjects ? (JSON.parse(rawProjects) as Project[]) : [];
    let foundProject = projects.find((item) => item.id === activeBoardId && item.ownerEmail === user.email);
    
    if (!foundProject) {
      foundProject = {
        id: activeBoardId,
        name: "TaskFlow Demo Projesi",
        ownerEmail: user.email,
        ownerName: user.fullName,
        createdAt: new Date().toISOString()
      };
      projects.push(foundProject);
      window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    }
    setProject(foundProject);

    // 3. BOARD KONTROLÜ: Yoksa iskelet board oluştur.
    const rawBoards = window.localStorage.getItem(BOARDS_KEY);
    const boards = rawBoards ? (JSON.parse(rawBoards) as Record<string, BoardData>) : {};
    if (!boards[activeBoardId]) {
      boards[activeBoardId] = createSkeletonBoard(activeBoardId, user.email);
      window.localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
    }
    
    const loaded = boards[activeBoardId];
    setBoard({
      ...loaded,
      columnOrder: withDoneLast(loaded.columnOrder),
    });
    setNewColumnId(withDoneLast(loaded.columnOrder)[0] ?? "todo");
    setIsReady(true);
  }, [boardId, router]);

  useEffect(() => {
    if (!board || !isReady) return;
    const rawBoards = window.localStorage.getItem(BOARDS_KEY);
    const allBoards = rawBoards ? (JSON.parse(rawBoards) as Record<string, BoardData>) : {};
    allBoards[board.projectId] = board;
    window.localStorage.setItem(BOARDS_KEY, JSON.stringify(allBoards));
  }, [board, isReady]);

  const findTaskColumn = (taskId: string) => {
    if (!board) return undefined;
    return board.columnOrder.find((columnId) => board.columns[columnId]?.taskIds.includes(taskId));
  };

  const moveTask = (taskId: string, targetColumnId: string) => {
    setBoard((current) => {
      if (!current) return current;
      const sourceColumnId = current.columnOrder.find((columnId) => current.columns[columnId]?.taskIds.includes(taskId));
      if (!sourceColumnId || sourceColumnId === targetColumnId) return current;
      const source = current.columns[sourceColumnId];
      const target = current.columns[targetColumnId];
      if (!source || !target) return current;
      return {
        ...current,
        columnOrder: withDoneLast(current.columnOrder),
        tasks: {
          ...current.tasks,
          [taskId]: {
            ...current.tasks[taskId],
            completedAt:
              targetColumnId === "done"
                ? current.tasks[taskId].completedAt ?? new Date().toISOString().slice(0, 10)
                : null,
          },
        },
        columns: {
          ...current.columns,
          [sourceColumnId]: { ...source, taskIds: source.taskIds.filter((id) => id !== taskId) },
          [targetColumnId]: { ...target, taskIds: [...target.taskIds, taskId] },
        },
      };
    });
  };

  const deleteColumn = (columnId: string) => {
    setBoard((current) => {
      if (!current) return current;
      const column = current.columns[columnId];
      if (!column) return current;
      if (column.taskIds.length > 0) {
        window.alert("Ici dolu kolon silinemez.");
        return current;
      }
      const columns = { ...current.columns };
      delete columns[columnId];
      return {
        ...current,
        columns,
        columnOrder: current.columnOrder.filter((id) => id !== columnId),
      };
    });
  };

  const saveColumn = () => {
    setBoard((current) => {
      if (!current) return current;
      const nextColumns = { ...current.columns };
      const nextOrder = [...current.columnOrder];
      if (columnKindDraft === "custom") {
        const label = columnTitleDraft.trim();
        if (!label) {
          setColumnError("Custom kolon icin etiket zorunlu.");
          return current;
        }
        const id = `custom-${Date.now()}`;
        nextColumns[id] = { id, kind: "custom", title: label, taskIds: [] };
        nextOrder.push(id);
      } else {
        if (nextColumns[columnKindDraft]) {
          setColumnError("Bu kolon zaten mevcut.");
          return current;
        }
        const title =
          columnKindDraft === "todo" ? "To Do" : columnKindDraft === "in-progress" ? "In Progress" : "Done";
        nextColumns[columnKindDraft] = { id: columnKindDraft, kind: columnKindDraft, title, taskIds: [] };
        nextOrder.push(columnKindDraft);
      }
      return { ...current, columns: nextColumns, columnOrder: withDoneLast(nextOrder) };
    });
    setColumnError("");
    setColumnTitleDraft("");
    setIsColumnModalOpen(false);
  };

  const addTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    if (newDueDate && !isValidDate(newDueDate)) {
      setCreateError("Gecersiz tarih girdiniz.");
      return;
    }
    setBoard((current) => {
      if (!current) return current;
      const column = current.columns[newColumnId];
      if (!column) return current;
      const id = `task-${Date.now()}`;
      return {
        ...current,
        tasks: {
          ...current.tasks,
          [id]: {
            id,
            title,
            description: newDescription.trim(),
            createdBy: currentUserName,
            dueDate: newDueDate || null,
            completedAt: newColumnId === "done" ? new Date().toISOString().slice(0, 10) : null,
          },
        },
        columns: {
          ...current.columns,
          [newColumnId]: { ...column, taskIds: [...column.taskIds, id] },
        },
      };
    });
    setNewTitle("");
    setNewDescription("");
    setNewDueDate("");
    setCreateError("");
    setIsCreateTaskOpen(false);
  };

    const openTaskEditor = (taskId: string) => {
    if (!board) return;
    
    // EKLENEN KISIM: Eğer task 'done' kolonundaysa düzenlemeyi engelle
    const columnId = findTaskColumn(taskId);
    if (columnId === "done") return; 

    const task = board.tasks[taskId];
    if (!task) return;
    setEditingTaskId(taskId);
    setTaskTitle(task.title);
    setTaskDescription(task.description);
    setTaskDueDate(task.dueDate ?? "");
    setTaskError("");
  };

  const saveTask = () => {
    if (!board || !editingTaskId) return;
    const columnId = findTaskColumn(editingTaskId);
    if (columnId === "done") {
      setTaskError("Done kolonundaki task duzenlenemez.");
      return;
    }
    if (taskDueDate && !isValidDate(taskDueDate)) {
      setTaskError("Gecersiz tarih girdiniz.");
      return;
    }
    setBoard({
      ...board,
      tasks: {
        ...board.tasks,
        [editingTaskId]: {
          ...board.tasks[editingTaskId],
          title: taskTitle.trim() || board.tasks[editingTaskId].title,
          description: taskDescription.trim(),
          dueDate: taskDueDate || null,
          completedAt: board.tasks[editingTaskId].completedAt ?? null,
        },
      },
    });
    setEditingTaskId(null);
  };

  const deleteTask = () => {
    if (!board || !editingTaskId) return;
    const columnId = findTaskColumn(editingTaskId);
    if (!columnId) return;
    const tasks = { ...board.tasks };
    delete tasks[editingTaskId];
    setBoard({
      ...board,
      tasks,
      columns: {
        ...board.columns,
        [columnId]: {
          ...board.columns[columnId]!,
          taskIds: board.columns[columnId]!.taskIds.filter((id) => id !== editingTaskId),
        },
      },
    });
    setEditingTaskId(null);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveTaskId(String(event.active.id));

  const handleDragOver = (event: DragOverEvent) => {
    if (!board) return;
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) return;
    const sourceColumnId = findTaskColumn(activeId);
    if (!sourceColumnId) return;
    const overData = event.over?.data.current;
    const targetColumnId: string | undefined =
      overData?.type === "column" ? overData.columnId : overData?.type === "task" ? overData.columnId : undefined;
    if (!targetColumnId || !board.columns[targetColumnId]) return;
    if (sourceColumnId === targetColumnId) return;

    // Do not move into Done on hover: passing the pointer over Done was stealing the card.
    // Dropping on Done is handled in onDragEnd only.
    if (targetColumnId === "done") return;

    // Leaving Done (or any other cross-column move except into Done) — live update OK.
    moveTask(activeId, targetColumnId);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const overData = over.data.current as
      | { type?: string; columnId?: string }
      | undefined;
    const targetColumnId: string | undefined =
      overData?.type === "column"
        ? overData.columnId
        : overData?.type === "task"
          ? overData.columnId
          : undefined;

    if (!targetColumnId) return;

    setBoard((current) => {
      if (!current) return current;
      const colOrder = withDoneLast(current.columnOrder);
      const findCol = (taskId: string) =>
        colOrder.find((cid) => current.columns[cid]?.taskIds.includes(taskId));
      const sourceColumnId = findCol(activeId);
      if (!sourceColumnId) return { ...current, columnOrder: colOrder };
      if (!current.columns[targetColumnId]) return { ...current, columnOrder: colOrder };

      const applyCrossColumnMove = (from: string, to: string) => {
        const source = current.columns[from];
        const target = current.columns[to];
        if (!source || !target) return null;
        const toDone = to === "done";
        return {
          ...current,
          columnOrder: colOrder,
          tasks: {
            ...current.tasks,
            [activeId]: {
              ...current.tasks[activeId],
              completedAt: toDone
                ? current.tasks[activeId].completedAt ?? new Date().toISOString().slice(0, 10)
                : null,
            },
          },
          columns: {
            ...current.columns,
            [from]: { ...source, taskIds: source.taskIds.filter((id) => id !== activeId) },
            [to]: { ...target, taskIds: [...target.taskIds, activeId] },
          },
        } as BoardData;
      };

      if (sourceColumnId !== targetColumnId) {
        const next = applyCrossColumnMove(sourceColumnId, targetColumnId);
        return next ?? { ...current, columnOrder: colOrder };
      }

      // Same column: reorder
      const col = current.columns[sourceColumnId];
      if (!col) return { ...current, columnOrder: colOrder };
      const oldIndex = col.taskIds.indexOf(activeId);
      const newIndex = col.taskIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        return { ...current, columnOrder: colOrder };
      }
      return {
        ...current,
        columnOrder: colOrder,
        columns: {
          ...current.columns,
          [sourceColumnId]: { ...col, taskIds: arrayMove(col.taskIds, oldIndex, newIndex) },
        },
      };
    });
  };

  const activeTask = useMemo(() => (activeTaskId && board ? board.tasks[activeTaskId] : null), [activeTaskId, board]);
  const editingTask = editingTaskId && board ? board.tasks[editingTaskId] : null;
  const isEditingDoneTask = editingTaskId ? findTaskColumn(editingTaskId) === "done" : false;

  if (!isReady || !board || !project) {
    return <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950" />;
  }

  const addableKinds: ColumnKind[] = ["custom"];
  if (!board.columns.todo) addableKinds.push("todo");
  if (!board.columns["in-progress"]) addableKinds.push("in-progress");
  if (!board.columns.done) addableKinds.push("done");

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200 px-4 py-8 dark:from-zinc-950 dark:to-black dark:text-zinc-50">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <p className="text-xs text-zinc-500">Owner: {project.ownerName}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsCreateTaskOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Plus className="h-4 w-4" />
              Task Ekle
            </button>
            <button
              type="button"
              onClick={() => {
                setColumnKindDraft(addableKinds[0]);
                setColumnTitleDraft("");
                setColumnError("");
                setIsColumnModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-900"
            >
              <Plus className="h-4 w-4" />
              Kolon Ekle
            </button>
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-4">
            <div className="flex min-w-max gap-4">
              {board.columnOrder.map((columnId) => {
                const column = board.columns[columnId];
                if (!column) return null;
                const tasks = column.taskIds.map((id) => board.tasks[id]).filter(Boolean);
                return (
                  <BoardColumn
                    key={column.id}
                    column={column}
                    tasks={tasks}
                    onOpenTask={openTaskEditor}
                    onDeleteColumn={deleteColumn}
                  />
                );
              })}
            </div>
          </div>
          <DragOverlay>
            {activeTask ? (
              <article className="w-[300px] rotate-2 rounded-xl border border-zinc-300 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
                <h3 className="text-sm font-semibold">{activeTask.title}</h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{activeTask.description}</p>
              </article>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {isCreateTaskOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Yeni Task</h2>
            <div className="mt-4 space-y-3">
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Baslik" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
              <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={3} placeholder="Aciklama" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
                <select value={newColumnId} onChange={(e) => setNewColumnId(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                  {board.columnOrder.map((columnId) => (
                    <option key={columnId} value={columnId}>
                      {board.columns[columnId]?.title}
                    </option>
                  ))}
                </select>
              </div>
              {createError ? <p className="text-xs text-red-600">{createError}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreateTaskOpen(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
                Vazgec
              </button>
              <button type="button" onClick={addTask} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">{editingTask.title}</h2>
            <div className="mt-4 space-y-3">
              <input disabled={isEditingDoneTask} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950" />
              <textarea disabled={isEditingDoneTask} value={taskDescription} onChange={(e) => setTaskDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950" />
              <input disabled={isEditingDoneTask} type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950" />
              {isEditingDoneTask ? <p className="text-xs text-zinc-500">Done kolonundaki task metin/tarih duzenlemesi kilitlidir.</p> : null}
              {taskError ? <p className="text-xs text-red-600">{taskError}</p> : null}
            </div>
            <div className="mt-5 flex justify-between gap-2">
              <button type="button" onClick={deleteTask} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 dark:border-red-700 dark:text-red-400">
                Sil
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingTaskId(null)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
                  Vazgec
                </button>
                <button type="button" disabled={isEditingDoneTask} onClick={saveTask} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900">
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isColumnModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Kolon Ekle</h2>
            <div className="mt-4 space-y-3">
              <select
                value={columnKindDraft}
                onChange={(event) => setColumnKindDraft(event.target.value as ColumnKind)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {addableKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind === "todo" ? "To Do" : kind === "in-progress" ? "In Progress" : kind === "done" ? "Done" : "Custom"}
                  </option>
                ))}
              </select>
              {columnKindDraft === "custom" ? (
                <input
                  value={columnTitleDraft}
                  onChange={(event) => setColumnTitleDraft(event.target.value)}
                  placeholder="Custom kolon etiketi"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              ) : null}
              {columnError ? <p className="text-xs text-red-600">{columnError}</p> : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setIsColumnModalOpen(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
                Vazgec
              </button>
              <button type="button" onClick={saveColumn} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                Kaydet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
