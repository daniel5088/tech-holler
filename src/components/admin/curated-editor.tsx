"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ArticleDraft } from "@/lib/pipeline/schemas";
import type { ArticleSource, CategorySlug, Confidence, EditorialMode } from "@/types/content";

type SectionInput = {
  heading: string;
  body: string;
};

const categories: Array<{ value: CategorySlug; label: string }> = [
  { value: "ai-robotics", label: "AI & Robotics" },
  { value: "computing-gadgets", label: "Computing & Gadgets" },
  { value: "cyber-internet", label: "Cyber & Internet" },
  { value: "space-science", label: "Space & Science" },
  { value: "sci-fi-reality", label: "Sci-Fi Reality" },
  { value: "futurecasting", label: "Futurecasting" },
];

const emptySource = (): ArticleSource => ({
  title: "",
  publisher: "",
  url: "",
  publishedAt: "",
  sourceType: "top-tier",
});

const initialSections: SectionInput[] = [
  { heading: "What happened", body: "" },
  { heading: "What is known", body: "" },
  { heading: "Our analysis", body: "" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function paragraphs(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function CuratedEditor() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [dek, setDek] = useState("");
  const [editorialMode, setEditorialMode] = useState<EditorialMode>("reported");
  const [category, setCategory] = useState<CategorySlug>("ai-robotics");
  const [confidence, setConfidence] = useState<Confidence>("medium");
  const [uncertaintyNote, setUncertaintyNote] = useState("");
  const [forecastHorizon, setForecastHorizon] = useState("");
  const [heroImageAlt, setHeroImageAlt] = useState("");
  const [quickTake, setQuickTake] = useState(["", "", ""]);
  const [sections, setSections] = useState<SectionInput[]>(initialSections);
  const [sources, setSources] = useState<ArticleSource[]>([emptySource()]);
  const [sourceSnippets, setSourceSnippets] = useState("");
  const [status, setStatus] = useState<{
    state: "idle" | "submitting" | "completed" | "failed";
    message?: string;
  }>({ state: "idle" });

  const previewSections = useMemo(
    () => sections.map((section) => ({ ...section, paragraphs: paragraphs(section.body) })),
    [sections],
  );

  function updateTitle(value: string) {
    setTitle(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function updateMode(value: EditorialMode) {
    setEditorialMode(value);
    if (value === "talk-around-town") {
      setConfidence("low");
      if (title && !title.startsWith("Talk Around Town:")) {
        const nextTitle = `Talk Around Town: ${title}`;
        setTitle(nextTitle);
        if (!slugEdited) setSlug(slugify(nextTitle));
      }
    }
  }

  function updateQuickTake(index: number, value: string) {
    setQuickTake((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function updateSection(index: number, key: keyof SectionInput, value: string) {
    setSections((items) =>
      items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    );
  }

  function updateSource<K extends keyof ArticleSource>(
    index: number,
    key: K,
    value: ArticleSource[K],
  ) {
    setSources((items) =>
      items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ state: "submitting", message: "Running editorial safety checks..." });

    const draft: ArticleDraft = {
      slug,
      title,
      dek,
      editorialMode,
      uncertaintyNote,
      category,
      confidence,
      forecastHorizon: forecastHorizon || null,
      heroImageAlt,
      heroImagePrompt:
        `Editorial illustration for ${title || "this technology article"}, with no text, logos, or photorealistic news depiction.`,
      quickTake,
      sections: previewSections,
      sources,
    };

    try {
      const response = await fetch("/api/admin/editorial-drafts/curated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          sourceSnippets: sourceSnippets
            .split("\n")
            .map((snippet) => snippet.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json() as {
        error?: string;
        draft?: { title: string };
      };
      if (!response.ok) throw new Error(result.error ?? "Draft submission failed");

      setStatus({
        state: "completed",
        message: `${result.draft?.title ?? "Draft"} is private and ready for review.`,
      });
      router.refresh();
    } catch (error) {
      setStatus({
        state: "failed",
        message: error instanceof Error ? error.message : "Draft submission failed",
      });
    }
  }

  return (
    <div className="curated-editor">
      <form className="curated-form" onSubmit={submit}>
        <div className="editor-grid">
          <label className="field-wide">
            <span>Headline</span>
            <input
              value={title}
              onChange={(event) => updateTitle(event.target.value)}
              minLength={20}
              maxLength={130}
              required
            />
            <small>{title.length}/130 characters</small>
          </label>

          <label>
            <span>Slug</span>
            <input
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(slugify(event.target.value));
              }}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </label>

          <label>
            <span>Editorial mode</span>
            <select
              value={editorialMode}
              onChange={(event) => updateMode(event.target.value as EditorialMode)}
            >
              <option value="reported">Reported</option>
              <option value="talk-around-town">Talk Around Town</option>
            </select>
          </label>

          <label>
            <span>Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as CategorySlug)}
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Confidence</span>
            <select
              value={confidence}
              disabled={editorialMode === "talk-around-town"}
              onChange={(event) => setConfidence(event.target.value as Confidence)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label className="field-wide">
            <span>Dek</span>
            <textarea
              value={dek}
              onChange={(event) => setDek(event.target.value)}
              minLength={40}
              maxLength={260}
              rows={3}
              required
            />
            <small>{dek.length}/260 characters; use complete sentences.</small>
          </label>

          <label className="field-wide">
            <span>Uncertainty or editorial caution</span>
            <textarea
              value={uncertaintyNote}
              onChange={(event) => setUncertaintyNote(event.target.value)}
              minLength={30}
              maxLength={500}
              rows={3}
              required
            />
          </label>

          <label>
            <span>Forecast horizon</span>
            <input
              value={forecastHorizon}
              onChange={(event) => setForecastHorizon(event.target.value)}
              placeholder="Optional"
            />
          </label>

          <label>
            <span>Artwork description</span>
            <input
              value={heroImageAlt}
              onChange={(event) => setHeroImageAlt(event.target.value)}
              minLength={20}
              maxLength={180}
              required
            />
          </label>
        </div>

        <fieldset>
          <legend>Quick take</legend>
          {quickTake.map((item, index) => (
            <label key={index}>
              <span>Point {index + 1}</span>
              <input
                value={item}
                onChange={(event) => updateQuickTake(index, event.target.value)}
                minLength={12}
                maxLength={180}
                required
              />
            </label>
          ))}
        </fieldset>

        <fieldset>
          <div className="fieldset-heading">
            <legend>Article sections</legend>
            <button
              type="button"
              disabled={sections.length >= 7}
              onClick={() => setSections((items) => [...items, { heading: "", body: "" }])}
            >
              Add section
            </button>
          </div>
          {sections.map((section, index) => (
            <div className="repeatable-card" key={index}>
              <label>
                <span>Heading {index + 1}</span>
                <input
                  value={section.heading}
                  onChange={(event) => updateSection(index, "heading", event.target.value)}
                  minLength={4}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                <span>Paragraphs</span>
                <textarea
                  value={section.body}
                  onChange={(event) => updateSection(index, "body", event.target.value)}
                  rows={7}
                  required
                />
                <small>Separate paragraphs with a blank line. Each paragraph must be 80–1,600 characters.</small>
              </label>
              {sections.length > 3 && (
                <button
                  className="remove-button"
                  type="button"
                  onClick={() => setSections((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove section
                </button>
              )}
            </div>
          ))}
        </fieldset>

        <fieldset>
          <div className="fieldset-heading">
            <div>
              <legend>Sources</legend>
              <small>Reported stories require two independent trusted domains. Talk Around Town may use one.</small>
            </div>
            <button type="button" onClick={() => setSources((items) => [...items, emptySource()])}>
              Add source
            </button>
          </div>
          {sources.map((source, index) => (
            <div className="repeatable-card source-grid" key={index}>
              <label className="field-wide">
                <span>Source title</span>
                <input
                  value={source.title}
                  onChange={(event) => updateSource(index, "title", event.target.value)}
                  minLength={4}
                  required
                />
              </label>
              <label>
                <span>Publisher</span>
                <input
                  value={source.publisher}
                  onChange={(event) => updateSource(index, "publisher", event.target.value)}
                  minLength={2}
                  required
                />
              </label>
              <label>
                <span>Source type</span>
                <select
                  value={source.sourceType}
                  onChange={(event) =>
                    updateSource(index, "sourceType", event.target.value as ArticleSource["sourceType"])}
                >
                  <option value="primary">Primary</option>
                  <option value="top-tier">Top tier</option>
                  <option value="specialist">Specialist</option>
                  <option value="social-signal">Social signal</option>
                </select>
              </label>
              <label className="field-wide">
                <span>URL</span>
                <input
                  type="url"
                  value={source.url}
                  onChange={(event) => updateSource(index, "url", event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Published date</span>
                <input
                  type="date"
                  value={source.publishedAt.slice(0, 10)}
                  onChange={(event) => updateSource(index, "publishedAt", event.target.value)}
                  required
                />
              </label>
              {sources.length > 1 && (
                <button
                  className="remove-button"
                  type="button"
                  onClick={() => setSources((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove source
                </button>
              )}
            </div>
          ))}
        </fieldset>

        <label className="source-snippets">
          <span>Short source excerpts for phrase checking</span>
          <textarea
            value={sourceSnippets}
            onChange={(event) => setSourceSnippets(event.target.value)}
            rows={4}
            placeholder="One exact 12–24 word excerpt per line. These are checked for accidental copying and are never published."
          />
        </label>

        {status.message && (
          <p className={`editor-status ${status.state}`}>{status.message}</p>
        )}
        <button className="submit-curated" type="submit" disabled={status.state === "submitting"}>
          {status.state === "submitting" ? "Checking draft..." : "Save private draft"}
        </button>
      </form>

      <aside className="curated-preview">
        <span className="eyebrow">LIVE PREVIEW</span>
        <div className="story-meta">
          {editorialMode === "talk-around-town" && <span className="talk-chip">Talk Around Town</span>}
          <span>{category}</span>
          <span>{confidence} confidence</span>
        </div>
        <h2>{title || "Your headline appears here"}</h2>
        <p className="preview-dek">{dek || "The article dek will appear here as you write."}</p>
        {uncertaintyNote && <p className="draft-warning">{uncertaintyNote}</p>}
        <div className="draft-quick-take">
          <strong>Quick take</strong>
          <ul>
            {quickTake.filter(Boolean).map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
        {previewSections.map((section, index) => (
          <section key={index}>
            <h3>{section.heading || `Section ${index + 1}`}</h3>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={paragraphIndex}>{paragraph}</p>
            ))}
          </section>
        ))}
        {sources.some((source) => source.title) && (
          <section className="preview-sources">
            <h3>Sources</h3>
            <ul>
              {sources.filter((source) => source.title).map((source, index) => (
                <li key={index}>{source.publisher || "Publisher"}: {source.title}</li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
