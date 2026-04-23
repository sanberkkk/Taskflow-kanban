"use client";

import { KanbanSquare, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  createdAt: string;
};

const PROJECTS_KEY = "taskflow-projects-v1";
const CURRENT_USER_KEY = "taskflow-current-user-v1";

export default function Home() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");

  useEffect(() => {
    const rawUser = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!rawUser) {
      document.cookie = "taskflow_auth=; Max-Age=0; path=/; SameSite=Lax";
      router.replace("/login");
      return;
    }
    try {
      const parsed = JSON.parse(rawUser) as { email: string; fullName: string };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentUserEmail(parsed.email);
      setCurrentUserName(parsed.fullName);
      const rawProjects = window.localStorage.getItem(PROJECTS_KEY);
      const allProjects = rawProjects ? (JSON.parse(rawProjects) as Project[]) : [];
      setProjects(allProjects);
    } catch {
      document.cookie = "taskflow_auth=; Max-Age=0; path=/; SameSite=Lax";
      router.replace("/login");
      return;
    }
    setIsReady(true);
  }, [router]);

  const userProjects = useMemo(
    () => projects.filter((project) => project.ownerEmail === currentUserEmail),
    [projects, currentUserEmail],
  );

  const createProject = () => {
    const cleanName = projectName.trim();
    if (!cleanName || !currentUserEmail) return;
    const next: Project = {
      id: `project-${Date.now()}`,
      name: cleanName,
      ownerEmail: currentUserEmail,
      ownerName: currentUserName,
      createdAt: new Date().toISOString(),
    };
    const updated = [...projects, next];
    setProjects(updated);
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
    setProjectName("");
    router.push(`/boards/${next.id}`);
  };

  const logout = () => {
    document.cookie = "taskflow_auth=; Max-Age=0; path=/; SameSite=Lax";
    window.localStorage.removeItem(CURRENT_USER_KEY);
    router.replace("/login");
  };

  if (!isReady) {
    return <main className="min-h-screen bg-zinc-100 dark:bg-zinc-950" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200 px-4 py-8 text-zinc-900 dark:from-zinc-950 dark:to-black dark:text-zinc-50">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">TaskFlow Projelerim</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentUserName}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </header>

        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Yeni proje tablosu adi"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-blue-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={createProject}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              <Plus className="h-4 w-4" />
              Proje Olustur
            </button>
          </div>
        </div>

        {userProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Henuz proje tablon yok. Yukaridan ilk tablonu olustur.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userProjects.map((project) => (
              <Link
                key={project.id}
                href={`/boards/${project.id}`}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-3 inline-flex rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
                  <KanbanSquare className="h-5 w-5" />
                </div>
                <h2 className="text-base font-semibold">{project.name}</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(project.createdAt).toLocaleDateString("tr-TR")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
