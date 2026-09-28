import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, Unauthorized } from "./api";
import { CalendarIcon, ChartIcon, LogbookIcon, MicIcon, PlanIcon, PlusIcon, StarIcon } from "./components/Icons";
import { VoiceSheet } from "./components/VoiceSheet";
import { today } from "./dates";
import { useStore, type Store } from "./store";
import { LogbookView, TodayView, UpcomingView } from "./views/ListViews";
import { PlansView } from "./views/PlansView";
import { ProgressView } from "./views/ProgressView";

type View = "today" | "upcoming" | "logbook" | "progress" | "plans";

const NAV: Array<{ id: View; label: string; icon: ReactNode; color: string }> = [
  { id: "today", label: "Today", icon: <StarIcon />, color: "yellow" },
  { id: "upcoming", label: "Upcoming", icon: <CalendarIcon />, color: "red" },
  { id: "logbook", label: "Logbook", icon: <LogbookIcon />, color: "green" },
  { id: "progress", label: "Progress", icon: <ChartIcon />, color: "blue" },
  { id: "plans", label: "Plans", icon: <PlanIcon />, color: "blue" },
];

function viewFromHash(): View {
  const h = location.hash.slice(1) as View;
  return NAV.some((n) => n.id === h) ? h : "today";
}

export function App() {
  const [auth, setAuth] = useState<"checking" | "in" | "out">("checking");

  useEffect(() => {
    api
      .me()
      .then(() => setAuth("in"))
      .catch((err) => setAuth(err instanceof Unauthorized ? "out" : "in"));
  }, []);

  if (auth === "checking") return <div className="splash" />;
  if (auth === "out") return <Login onDone={() => setAuth("in")} />;
  return <Shell onSignedOut={() => setAuth("out")} />;
}

function Shell({ onSignedOut }: { onSignedOut(): void }) {
  const store = useStore(useCallback(onSignedOut, [onSignedOut]));
  const [view, setView] = useState<View>(viewFromHash);
  const [adding, setAdding] = useState(false);
  const [voice, setVoice] = useState(false);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (v: View) => {
    setAdding(false);
    location.hash = v;
    setView(v);
    window.scrollTo({ top: 0 });
  };

  const onPlus = () => {
    if (view !== "today" && view !== "upcoming") go("today");
    setAdding(true);
  };

  const t = today();
  const todayOpen = store.entries.filter((e) => e.date === t && e.status === "planned").length;
  const upcomingCount = store.entries.filter((e) => e.date > t && e.status === "planned").length;
  const counts: Partial<Record<View, number>> = { today: todayOpen, upcoming: upcomingCount };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icon.svg" alt="" width={22} height={22} />
          Sets
        </div>
        <nav>
          {NAV.slice(0, 4).map((n) => (
            <NavItem key={n.id} item={n} active={view === n.id} count={counts[n.id]} onClick={() => go(n.id)} />
          ))}
          <div className="nav-sep" />
          <NavItem item={NAV[4]} active={view === "plans"} onClick={() => go("plans")} />
          {store.plans.slice(0, 8).map((p) => (
            <button type="button" key={p.id} className="nav-item sub" onClick={() => go("plans")}>
              <span className="mini-ring" style={{ ["--pct" as string]: p.total ? Math.round((p.done / p.total) * 100) : 0 }} />
              <span className="nav-label">{p.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        <div className="content">
          {store.error && (
            <div className="toast" role="alert">
              {store.error}
            </div>
          )}
          {store.loading ? (
            <div className="loading">
              <div className="spinner" />
            </div>
          ) : (
            <ViewSwitch view={view} store={store} adding={adding} setAdding={setAdding} />
          )}
        </div>
      </main>

      <div className="fabs">
        <button type="button" className="fab fab-mic" aria-label="Log by voice" onClick={() => setVoice(true)}>
          <MicIcon size={24} />
        </button>
        <button type="button" className="fab" aria-label="Add workout" onClick={onPlus}>
          <PlusIcon size={26} />
        </button>
      </div>

      <nav className="tabbar">
        {NAV.map((n) => (
          <button type="button" key={n.id} className={`tab ${view === n.id ? "active" : ""} t-${n.color}`} onClick={() => go(n.id)}>
            <span className="tab-icon">{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <datalist id="exercise-names">
        {store.exercises.map((e) => (
          <option key={e.exercise} value={e.exercise} />
        ))}
      </datalist>

      {voice && (
        <VoiceSheet
          store={store}
          onClose={() => {
            setVoice(false);
            if (view !== "today") go("today");
          }}
        />
      )}
    </div>
  );
}

function ViewSwitch({ view, store, adding, setAdding }: { view: View; store: Store; adding: boolean; setAdding(v: boolean): void }) {
  switch (view) {
    case "today":
      return <TodayView store={store} adding={adding} setAdding={setAdding} />;
    case "upcoming":
      return <UpcomingView store={store} adding={adding} setAdding={setAdding} />;
    case "logbook":
      return <LogbookView store={store} adding={adding} setAdding={setAdding} />;
    case "progress":
      return <ProgressView store={store} />;
    case "plans":
      return <PlansView store={store} />;
  }
}

function NavItem({ item, active, count, onClick }: { item: (typeof NAV)[number]; active: boolean; count?: number; onClick(): void }) {
  return (
    <button type="button" className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className={`nav-icon c-${item.color}`}>{item.icon}</span>
      <span className="nav-label">{item.label}</span>
      {!!count && <span className="nav-count">{count}</span>}
    </button>
  );
}

function Login({ onDone }: { onDone(): void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr("");
          try {
            await api.login(pw);
            onDone();
          } catch (error) {
            setErr(error instanceof Error ? error.message : "Couldn't sign in");
          } finally {
            setBusy(false);
          }
        }}
      >
        <img src="/icon.svg" alt="" width={64} height={64} />
        <h1>Sets</h1>
        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
        {err && <p className="login-err">{err}</p>}
        <button type="submit" className="btn primary wide" disabled={!pw || busy}>
          {busy ? "…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
