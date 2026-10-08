import { useCallback, useEffect, useState } from "react";
import { api, Unauthorized } from "./api";
import { Celebration, WalkCelebration } from "./components/Celebration";
import { MicIcon, PlusIcon } from "./components/Icons";
import { VoiceSheet } from "./components/VoiceSheet";
import type { Journey } from "./pushups";
import type { Walk } from "./steps";
import { useStore, type Store } from "./store";
import { useJourney } from "./useJourney";
import { useWalk } from "./useWalk";
import { LogbookView, TodayView, UpcomingView } from "./views/ListViews";
import { PlansView } from "./views/PlansView";
import { ProgressView } from "./views/ProgressView";
import { PushupsView } from "./views/PushupsView";
import { StepsView } from "./views/StepsView";

type View = "today" | "steps" | "pushups" | "upcoming" | "logbook" | "progress" | "plans";

const NAV: Array<{ id: View; label: string }> = [
  { id: "today", label: "Today" },
  { id: "steps", label: "Steps" },
  { id: "pushups", label: "Push-ups" },
  { id: "upcoming", label: "Upcoming" },
  { id: "logbook", label: "History" },
  { id: "progress", label: "Progress" },
  { id: "plans", label: "Plans" },
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
  const [menu, setMenu] = useState(false);
  const { journey, moment, dismiss } = useJourney(store);
  const walkGame = useWalk(store);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (v: View) => {
    setAdding(false);
    setMenu(false);
    location.hash = v;
    setView(v);
    window.scrollTo({ top: 0 });
  };

  const onPlus = () => {
    if (view !== "today" && view !== "upcoming") go("today");
    setAdding(true);
  };

  const link = (n: (typeof NAV)[number]) => (
    <button type="button" key={n.id} className={`nav-link ${view === n.id ? "active" : ""}`} aria-current={view === n.id ? "page" : undefined} onClick={() => go(n.id)}>
      {n.label}
    </button>
  );

  return (
    <div className="app">
      {/* Same nav as jackgisel.com: a small fixed text list on wide screens, a title bar with a menu on narrow ones. */}
      <nav className="side-nav" aria-label="Sections">
        <button type="button" className="nav-title" onClick={() => go("today")}>
          Sets
        </button>
        <div className="nav-links">{NAV.map(link)}</div>
        <a className="nav-home" href="https://jackgisel.com">
          jackgisel.com ↗
        </a>
      </nav>
      <nav className={`mobile-nav ${menu ? "open" : ""}`} aria-label="Sections">
        <div className="mobile-bar">
          <button type="button" className="nav-title" onClick={() => go("today")}>
            Sets
          </button>
          <button type="button" className="menu-btn" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <span className="menu-icon" aria-hidden="true">
              <span />
              <span />
            </span>
          </button>
        </div>
        <div className="mobile-links">
          <div>
            {NAV.map(link)}
            <a className="nav-home" href="https://jackgisel.com">
              jackgisel.com ↗
            </a>
          </div>
        </div>
      </nav>

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
            <ViewSwitch view={view} store={store} journey={journey} walk={walkGame.walk} adding={adding} setAdding={setAdding} go={go} />
          )}
          <footer className="site-footer">&copy; {new Date().getFullYear()} Jack Gisel</footer>
        </div>
      </main>

      <div className="fabs">
        <button type="button" className="fab fab-mic" aria-label="Log by voice" onClick={() => setVoice(true)}>
          <MicIcon size={20} />
        </button>
        <button type="button" className="fab" aria-label="Add workout" onClick={onPlus}>
          <PlusIcon size={22} />
        </button>
      </div>

      <datalist id="exercise-names">
        {store.exercises.map((e) => (
          <option key={e.exercise} value={e.exercise} />
        ))}
      </datalist>

      {moment ? (
        <Celebration key={moment.key} moment={moment} onClose={dismiss} />
      ) : (
        walkGame.moment && <WalkCelebration key={walkGame.moment.key} moment={walkGame.moment} onClose={walkGame.dismiss} />
      )}

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

function ViewSwitch({
  view,
  store,
  journey,
  walk,
  adding,
  setAdding,
  go,
}: {
  view: View;
  store: Store;
  journey: Journey | null;
  walk: Walk;
  adding: boolean;
  setAdding(v: boolean): void;
  go(v: View): void;
}) {
  switch (view) {
    case "today":
      return (
        <TodayView store={store} adding={adding} setAdding={setAdding} journey={journey} walk={walk} onPushups={() => go("pushups")} onSteps={() => go("steps")} />
      );
    case "steps":
      return <StepsView store={store} walk={walk} />;
    case "pushups":
      return <PushupsView store={store} journey={journey} />;
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
        <h1 className="login-title">Sets</h1>
        <p className="login-tag">Do the work. Check it off.</p>
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
        <a className="login-home" href="https://jackgisel.com">
          jackgisel.com ↗
        </a>
      </form>
    </div>
  );
}
