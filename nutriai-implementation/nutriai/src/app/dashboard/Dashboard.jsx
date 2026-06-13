"use client";
import { useState } from "react";

const TABS = [
  { id: "scan",      label: "Snap & Scan" },
  { id: "plan",      label: "Meal Plan" },
  { id: "chat",      label: "Nourish Chat" },
  { id: "swap",      label: "Substitute" },
];

export default function Dashboard({ defaultName }) {
  const [tab, setTab] = useState("scan");
  return (
    <>
      <div className="dash-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`dash-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "scan" && <ScanPanel />}
      {tab === "plan" && <PlanPanel />}
      {tab === "chat" && <ChatPanel defaultName={defaultName} />}
      {tab === "swap" && <SwapPanel />}
    </>
  );
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function ScanPanel() {
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState("scanning"); setError(null); setResult(null);
    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType: file.type,
          userContext: { conditions: [], cyclePhase: null },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setResult(data); setState("done");
    } catch (err) {
      setError(err.message); setState("idle");
    }
  }

  return (
    <div className="dash-panel">
      <h2>Snap &amp; Scan</h2>
      <p className="hint">Upload a photo of a Nigerian meal. Gemini Vision identifies the dish and returns macros + clinical flags.</p>
      <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={state === "scanning"} />
      {state === "scanning" && <p style={{ marginTop: 12, color: "var(--muted)" }}>Identifying dish…</p>}
      {error && <div className="error">{error}</div>}
      {result && <div className="result">{JSON.stringify(result, null, 2)}</div>}
    </div>
  );
}

function PlanPanel() {
  const [profile, setProfile] = useState({
    age: 28, sex: "F", weight_kg: 65,
    conditions: [], cyclePhase: "",
    weeklyBudget_NGN: 12000, dailyCalorieTarget: 2000,
    excludedFoods: [], goal: "maintain",
  });
  const [state, setState] = useState("idle");
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);

  async function generate() {
    setState("loading"); setError(null); setPlan(null);
    try {
      const res = await fetch("/api/meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Plan failed");
      setPlan(data); setState("done");
    } catch (err) {
      setError(err.message); setState("idle");
    }
  }

  const toggleCond = c => setProfile(p => ({
    ...p, conditions: p.conditions.includes(c) ? p.conditions.filter(x => x !== c) : [...p.conditions, c]
  }));

  return (
    <div className="dash-panel">
      <h2>Meal Plan Generator</h2>
      <p className="hint">7-day Nigerian meal plan honoring your budget and clinical needs.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <div className="field"><label>Age</label><input className="input" type="number" value={profile.age} onChange={e => setProfile({ ...profile, age: +e.target.value })} /></div>
        <div className="field"><label>Sex</label><select className="input" value={profile.sex} onChange={e => setProfile({ ...profile, sex: e.target.value })}><option>F</option><option>M</option></select></div>
        <div className="field"><label>Weight (kg)</label><input className="input" type="number" value={profile.weight_kg} onChange={e => setProfile({ ...profile, weight_kg: +e.target.value })} /></div>
        <div className="field"><label>Weekly budget (₦)</label><input className="input" type="number" value={profile.weeklyBudget_NGN} onChange={e => setProfile({ ...profile, weeklyBudget_NGN: +e.target.value })} /></div>
        <div className="field"><label>Daily kcal target</label><input className="input" type="number" value={profile.dailyCalorieTarget} onChange={e => setProfile({ ...profile, dailyCalorieTarget: +e.target.value })} /></div>
        <div className="field"><label>Goal</label><select className="input" value={profile.goal} onChange={e => setProfile({ ...profile, goal: e.target.value })}><option>maintain</option><option>weight loss</option><option>muscle gain</option></select></div>
      </div>

      <div className="field">
        <label>Conditions</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["hypertension", "diabetes", "pcos", "pregnancy", "anemia"].map(c => (
            <button key={c} type="button" className={`dash-tab${profile.conditions.includes(c) ? " active" : ""}`} onClick={() => toggleCond(c)}>{c}</button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" onClick={generate} disabled={state === "loading"}>
        {state === "loading" ? "Generating…" : "Generate 7-day plan"}
      </button>

      {error && <div className="error">{error}</div>}
      {plan && <div className="result">{JSON.stringify(plan, null, 2)}</div>}
    </div>
  );
}

function ChatPanel({ defaultName }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: `Hi ${defaultName}! I'm Nourish, your AI nutritionist. Ask me anything about Nigerian food, your goals, or a condition.` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const next = [...messages, userMsg];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, userProfile: { name: defaultName, conditions: [], cyclePhase: null, weeklyBudget_NGN: 12000, goal: "general wellness" } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chat failed");
      setMessages(m => [...m, { role: "assistant", content: data.message }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dash-panel">
      <h2>Nourish Chat</h2>
      <p className="hint">Stateless chat with tool-use over the Nigerian food DB + clinical protocols.</p>
      <div className="chat-log">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>
        ))}
        {loading && <div className="chat-msg assistant">…</div>}
      </div>
      <div className="chat-row">
        <input className="input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask about jollof rice, PCOS, anything…" />
        <button className="btn btn-primary" onClick={send} disabled={loading}>Send</button>
      </div>
    </div>
  );
}

function SwapPanel() {
  const [dish, setDish] = useState("Titus fish");
  const [reason, setReason] = useState("It's too expensive this week");
  const [state, setState] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function swap() {
    setState("loading"); setError(null); setResult(null);
    try {
      const res = await fetch("/api/substitute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: `I want to replace ${dish}. ${reason}`,
          currentMeal: { dishName: dish, cost_NGN: 800 },
          userProfile: { conditions: [], weeklyBudget_NGN: 12000 },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Substitute failed");
      setResult(data.substitute); setState("done");
    } catch (err) {
      setError(err.message); setState("idle");
    }
  }

  return (
    <div className="dash-panel">
      <h2>Smart Substitute</h2>
      <p className="hint">Gemini calls tools to find a clinically equivalent, budget-friendly swap.</p>
      <div className="field"><label>Dish to replace</label><input className="input" value={dish} onChange={e => setDish(e.target.value)} /></div>
      <div className="field"><label>Reason</label><input className="input" value={reason} onChange={e => setReason(e.target.value)} /></div>
      <button className="btn btn-primary" onClick={swap} disabled={state === "loading"}>{state === "loading" ? "Finding…" : "Find substitute"}</button>
      {error && <div className="error">{error}</div>}
      {result && <div className="result">{result}</div>}
    </div>
  );
}
