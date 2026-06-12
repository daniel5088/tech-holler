import type { Metadata } from "next";
import { Activity, Database, KeyRound, Radio, ShieldAlert } from "lucide-react";
import { env, publishingEnabled, supabaseConfigured } from "@/lib/env";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Operations dashboard", robots: { index: false } };

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return (
      <main className="admin-login shell">
        <form action="/api/admin/session" method="post">
          <KeyRound size={28} />
          <h1>Operations dashboard</h1>
          <p>Enter the dashboard token configured for this deployment.</p>
          <input type="password" name="token" required aria-label="Dashboard token" />
          <button type="submit">Unlock dashboard</button>
        </form>
      </main>
    );
  }

  const checks = [
    { label: "Supabase database", ok: supabaseConfigured, detail: supabaseConfigured ? "Connected" : "Demo fallback" },
    { label: "OpenAI generation", ok: Boolean(env.OPENAI_API_KEY), detail: env.OPENAI_API_KEY ? "Configured" : "Key missing" },
    { label: "Automatic publishing", ok: publishingEnabled, detail: publishingEnabled ? "Enabled" : "Kill switch active" },
    { label: "YouTube signal", ok: Boolean(env.YOUTUBE_API_KEY), detail: env.YOUTUBE_API_KEY ? "Configured" : "Optional key missing" },
  ];

  return (
    <main className="admin-page shell page-section">
      <header className="admin-header">
        <div>
          <span className="eyebrow">PRIVATE OPERATIONS</span>
          <h1>Holler control</h1>
        </div>
        <span className={`status-pill ${publishingEnabled ? "live" : "paused"}`}>
          <Radio size={13} />
          {publishingEnabled ? "Publishing live" : "Publishing paused"}
        </span>
      </header>

      <div className="admin-stats">
        <section>
          <Activity />
          <span>Trend sweep</span>
          <strong>Every 30 min</strong>
          <small>Conservative two-channel spike gate</small>
        </section>
        <section>
          <Database />
          <span>Daily schedule</span>
          <strong>3 stories</strong>
          <small>7 AM, 1 PM, and 7 PM Eastern</small>
        </section>
        <section>
          <ShieldAlert />
          <span>Emergency control</span>
          <strong>{publishingEnabled ? "Armed" : "Stopped"}</strong>
          <small>Set PUBLISHING_ENABLED to control writes</small>
        </section>
      </div>

      <section className="admin-panel">
        <div className="panel-heading">
          <h2>System readiness</h2>
          <span>{checks.filter((check) => check.ok).length}/{checks.length} ready</span>
        </div>
        <div className="readiness-list">
          {checks.map((check) => (
            <div key={check.label}>
              <i className={check.ok ? "ok" : "warn"} />
              <span>{check.label}</span>
              <strong>{check.detail}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Protected automation endpoints</h2>
          <span>Bearer CRON_SECRET required</span>
        </div>
        <code>POST /api/cron/trends</code>
        <code>POST /api/cron/daily</code>
        <code>POST /api/cron/breaking</code>
        <code>GET /api/health</code>
      </section>
    </main>
  );
}
