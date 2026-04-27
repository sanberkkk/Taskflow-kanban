"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type KeyboardEvent } from "react";

type MockUser = {
  fullName: string;
  email: string;
  password: string;
};

const USERS_KEY = "taskflow-users-v1";
const CURRENT_USER_KEY = "taskflow-current-user-v1";
const AUTH_COOKIE = "taskflow_auth=1; path=/; max-age=604800; SameSite=Lax";
const INPUT_BASE_CLASS =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none ring-blue-500/30 transition focus:ring-2 sm:text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

const isMockUser = (value: unknown): value is MockUser => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.fullName === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.password === "string"
  );
};

export default function LoginPage() {
  const router = useRouter();
  const [hasAuthCookie, setHasAuthCookie] = useState(false);
  const [email, setEmail] = useState("candidate@taskflow.dev");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [registerError, setRegisterError] = useState("");
  /** Portals / overlay yerine ayni kartta; mobilde gosterme sorunlarini onler */
  const [showRegister, setShowRegister] = useState(false);
  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  useEffect(() => {
    // Cerez okunmasi sadece istemcide; ilk paint sonrasi banner icin
    // eslint-disable-next-line react-hooks/set-state-in-effect -- document.cookie yalnizca mount'ta
    setHasAuthCookie(typeof document !== "undefined" && document.cookie.includes("taskflow_auth=1"));
  }, []);

  const getUsers = () => {
    if (typeof window === "undefined") return [] as MockUser[];
    try {
      const raw = window.localStorage.getItem(USERS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isMockUser).map((user) => ({
        ...user,
        email: normalizeEmail(user.email),
      }));
    } catch {
      return [];
    }
  };

  const runLogin = () => {
    if (!email.trim() || !password.trim()) {
      setError("E-posta ve sifre gerekli.");
      return;
    }
    setError("");
    const users = getUsers();
    const emailTrim = normalizeEmail(email);
    const byEmail = users.find((user) => user.email === emailTrim);

    if (!byEmail) {
      setError("Bu e-postaya ait kayit bulunmuyor. Hesap olusturun.");
      return;
    }
    if (byEmail.password !== password) {
      setError("Sifre hatali.");
      return;
    }
    try {
      window.localStorage.setItem(
        CURRENT_USER_KEY,
        JSON.stringify({ email: byEmail.email, fullName: byEmail.fullName }),
      );
    } catch {
      setError("Oturum kaydedilemedi (depolama kapali olabilir).");
      return;
    }
    setError("");
    document.cookie = AUTH_COOKIE;
    router.replace("/");
  };

  const goLoginOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runLogin();
    }
  };

  const handleRegister = () => {
    if (!registerName.trim() || !registerEmail.trim() || !registerPassword.trim()) {
      setRegisterError("Tum alanlari doldurun.");
      return;
    }
    if (registerPassword !== registerConfirm) {
      setRegisterError("Sifreler eslesmiyor.");
      return;
    }
    const users = getUsers();
    const normalizedRegisterEmail = normalizeEmail(registerEmail);
    if (users.some((user) => user.email === normalizedRegisterEmail)) {
      setRegisterError("Bu email ile zaten hesap var.");
      return;
    }
    const next = [
      ...users,
      {
        fullName: registerName.trim(),
        email: normalizedRegisterEmail,
        password: registerPassword,
      },
    ];
    try {
      window.localStorage.setItem(USERS_KEY, JSON.stringify(next));
    } catch {
      setRegisterError("Bu tarayicida depolama kapali. Normal sekmede deneyin.");
      return;
    }
    setEmail(normalizedRegisterEmail);
    setPassword(registerPassword);
    setRegisterName("");
    setRegisterEmail("");
    setRegisterPassword("");
    setRegisterConfirm("");
    setRegisterError("");
    setShowRegister(false);
  };


  return (
    <main
      className="relative z-0 flex w-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-x-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:from-zinc-950 dark:to-black"
    >
      <div className="pointer-events-auto relative z-10 isolate w-full min-w-0 max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-100">TaskFlow Giris</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Once <strong className="font-medium text-zinc-700 dark:text-zinc-300">Hesap olustur</strong>, ardindan ayni e-posta ve sifreyle girin.
        </p>
        {hasAuthCookie ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Oturum acik.{" "}
            <Link href="/" className="font-medium underline">
              Ana sayfa
            </Link>
          </p>
        ) : null}
        {showRegister ? null : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300" htmlFor="tf-email">
                Email
              </label>
              <input
                id="tf-email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={goLoginOnEnter}
                className={INPUT_BASE_CLASS}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300" htmlFor="tf-password">
                Sifre
              </label>
              <input
                id="tf-password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={goLoginOnEnter}
                className={INPUT_BASE_CLASS}
                placeholder="******"
              />
            </div>
            <button
              type="button"
              onClick={runLogin}
              className="w-full min-h-11 touch-manipulation rounded-lg bg-zinc-900 px-4 py-2.5 text-base font-semibold text-white transition active:bg-zinc-800 sm:text-sm dark:bg-zinc-100 dark:text-zinc-900 dark:active:bg-zinc-200"
            >
              Giris
            </button>
            {error ? <p className="text-sm font-medium text-red-600" role="alert" aria-live="polite">{error}</p> : null}
          </div>
        )}
        {showRegister ? null : (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                setError("");
                setShowRegister(true);
              }}
              className="flex w-full min-h-11 touch-manipulation items-center justify-center rounded-lg border border-zinc-300 px-4 py-2.5 text-base font-semibold text-zinc-700 transition active:bg-zinc-200 sm:text-sm dark:border-zinc-700 dark:text-zinc-200 dark:active:bg-zinc-700"
            >
              Hesap Olustur
            </button>
          </div>
        )}
        {showRegister ? (
          <div className="mt-6 space-y-3" role="group" aria-label="Hesap olustur">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Yeni hesap</h2>
            <input
              value={registerName}
              onChange={(event) => setRegisterName(event.target.value)}
              placeholder="Ad Soyad"
              autoComplete="name"
              className={INPUT_BASE_CLASS}
            />
            <input
              type="email"
              value={registerEmail}
              onChange={(event) => setRegisterEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              className={INPUT_BASE_CLASS}
            />
            <input
              type="password"
              value={registerPassword}
              onChange={(event) => setRegisterPassword(event.target.value)}
              placeholder="Sifre"
              autoComplete="new-password"
              className={INPUT_BASE_CLASS}
            />
            <input
              type="password"
              value={registerConfirm}
              onChange={(event) => setRegisterConfirm(event.target.value)}
              placeholder="Sifre tekrar"
              autoComplete="new-password"
              className={INPUT_BASE_CLASS}
            />
            {registerError ? <p className="text-sm font-medium text-red-600" role="alert">{registerError}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setRegisterError("");
                  setShowRegister(false);
                }}
                className="min-h-11 w-full touch-manipulation rounded-lg border border-zinc-300 px-4 py-2.5 text-base font-medium text-zinc-700 active:bg-zinc-100 sm:min-w-[8rem] sm:w-auto sm:text-sm dark:border-zinc-700 dark:text-zinc-200 dark:active:bg-zinc-800"
              >
                Girişe don
              </button>
              <button
                type="button"
                onClick={handleRegister}
                className="min-h-11 w-full touch-manipulation rounded-lg bg-zinc-900 px-4 py-2.5 text-base font-semibold text-white active:bg-zinc-800 sm:w-auto sm:text-sm dark:bg-zinc-100 dark:text-zinc-900 dark:active:bg-zinc-200"
              >
                Hesap Ac
              </button>
            </div>
          </div>
        ) : null}
        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Source code:{" "}
          <a
            href="https://github.com/sanberkkk/Taskflow-kanban.git"
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            GitHub Repository
          </a>
        </p>
      </div>

    </main>
  );
}
