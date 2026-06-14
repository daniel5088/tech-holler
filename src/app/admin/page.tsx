import type { Metadata } from "next";
import { Activity, Database, KeyRound, Radio, ShieldAlert } from "lucide-react";
import { env, publishingEnabled, supabaseConfigured } from "@/lib/env";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getEditorialDrafts, recentEditorialJobs } from "@/lib/pipeline/repository";
import { CuratedEditor } from "@/components/admin/curated-editor";
import { formatScheduleHours, parseScheduleHours } from "@/lib/pipeline/schedule";

export const metadata: Metadata = { title: "Operations dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ aiResult?: string }>;
}) {
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

  const [drafts, jobs] = await Promise.all([
    getEditorialDrafts(),
    recentEditorialJobs(5),
  ]);
  const aiResult = (await searchParams).aiResult;
  const scheduleHours = parseScheduleHours(env.EDITORIAL_SCHEDULE_HOURS);
  const scheduleLabel = formatScheduleHours(scheduleHours);
  const checks = [
    { label: "Supabase database", ok: supabaseConfigured, detail: supabaseConfigured ? "Connected" : "Demo fallback" },
    { label: "OpenAI generation", ok: Boolean(env.OPENAI_API_KEY), detail: env.OPENAI_API_KEY ? "Configured" : "Key missing" },
    { label: "AI publishing", ok: publishingEnabled, detail: publishingEnabled ? "Enabled" : "Kill switch active" },
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
          {publishingEnabled ? "AI publishing live" : "AI publishing paused"}
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
          <span>Curated review queue</span>
          <strong>{drafts.length} drafts</strong>
          <small>Manual approval required for editor-written articles</small>
        </section>
        <section>
          <ShieldAlert />
          <span>Scheduled AI publishing</span>
          <strong>{publishingEnabled ? "Enabled" : "Paused"}</strong>
          <small>{scheduleLabel || "No valid hours"} Eastern; one attempt per slot</small>
        </section>
      </div>

      <section className="admin-panel curated-editor-panel">
        <div className="panel-heading">
          <div>
            <h2>Write a curated article</h2>
            <p>Editor-written copy, zero generative calls, full safety checks, and private review before publication.</p>
          </div>
          <span>Preferred workflow</span>
        </div>
        <CuratedEditor />
      </section>

      <section className="admin-panel editorial-controls">
        <div className="panel-heading">
          <div>
            <h2>Run AI pipeline now</h2>
            <p>
              Researches, writes, verifies, moderates, checks duplicates, and publishes immediately.
              Each run can incur AI usage.
            </p>
          </div>
          <span>{publishingEnabled ? env.OPENAI_EDITORIAL_MODEL : "Disabled"}</span>
        </div>
        {aiResult && (
          <p className={`queue-result ${aiResult}`}>
            Latest AI run: {aiResult}
          </p>
        )}
        {publishingEnabled ? (
          <form action="/api/admin/editorial-drafts/generate" method="post">
            <button type="submit">Run AI pipeline and publish</button>
          </form>
        ) : (
          <button type="button" disabled>AI publishing paused</button>
        )}
      </section>

      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Curated drafts awaiting review</h2>
          <span>{drafts.length} private</span>
        </div>
        <div className="editorial-draft-list">
          {drafts.length === 0 && <p>No drafts are waiting for review.</p>}
          {drafts.map((draft) => (
            <article className="editorial-draft" key={draft.id}>
              <div className="story-meta">
                {draft.editorialMode === "talk-around-town" && (
                  <span className="talk-chip">Talk Around Town</span>
                )}
                <span>{draft.category}</span>
                <span>{draft.confidence} confidence</span>
                <span>{draft.sources.length} sources</span>
              </div>
              <h3>{draft.title}</h3>
              <p className="draft-dek">{draft.dek}</p>
              {draft.uncertaintyNote && (
                <p className="draft-warning">
                  <strong>Uncertainty:</strong> {draft.uncertaintyNote}
                </p>
              )}
              <div className="draft-quick-take">
                <strong>Quick take</strong>
                <ul>
                  {draft.quickTake.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <details>
                <summary>Review full draft and sources</summary>
                {draft.sections.map((section) => (
                  <section key={section.heading}>
                    <h4>{section.heading}</h4>
                    {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </section>
                ))}
                <h4>Sources</h4>
                <ul>
                  {draft.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.publisher}: {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
              <form action={`/api/admin/editorial-drafts/${draft.id}/publish`} method="post">
                <button type="submit">Publish approved draft</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="panel-heading">
          <h2>Recent editorial usage</h2>
          <span>Token counts, not price estimates</span>
        </div>
        <div className="editorial-job-list">
          {jobs.length === 0 && <p>No editorial draft jobs recorded yet.</p>}
          {jobs.map((job, index) => {
            const details = job.details as {
              reason?: string;
              model?: string;
              usage?: { calls?: number; totalTokens?: number; webSearchCalls?: number };
            };
            return (
              <div key={`${job.finished_at}-${index}`}>
                <strong>{job.status}</strong>
                <span>{job.job_type === "curated-draft" ? "Human curated" : details.model ?? "unknown model"}</span>
                <span>{details.usage?.calls ?? 0} text calls</span>
                <span>{details.usage?.webSearchCalls ?? 0} web searches</span>
                <span>{details.usage?.totalTokens ?? 0} tokens</span>
                {details.reason && <small>{details.reason}</small>}
              </div>
            );
          })}
        </div>
      </section>

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
        <code>POST /api/cron/breaking (paused)</code>
        <code>GET /api/health</code>
      </section>
    </main>
  );
}
