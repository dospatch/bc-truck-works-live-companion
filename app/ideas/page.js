"use client";

import { useState } from "react";

const categories = [
  "Feature request",
  "Website idea",
  "Desktop companion",
  "ATS / ETS2",
  "Discord / community",
  "Bug report",
  "Other",
];

export default function IdeasPage() {
  const [form, setForm] = useState({ name: "", title: "", category: "Feature request", description: "", website: "" });
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  function update(key, value) {
    setForm(old => ({ ...old, [key]: value }));
    if (status) setStatus("");
    if (success) setSuccess(false);
  }

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setStatus("");
    setSuccess(false);
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Your idea could not be sent.");
      setSuccess(true);
      setStatus(result.message || "Your idea was sent to Discord. Thanks for helping us improve!");
      setForm({ name: "", title: "", category: "Feature request", description: "", website: "" });
    } catch (error) {
      setStatus(error.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="ideas-page">
      <header className="ideas-topbar">
        <a className="ideas-brand" href="/" aria-label="Back to BC Truck Works Live Companion">
          <span className="ideas-mark">BC</span>
          <span><strong>BC TRUCK WORKS</strong><small>LIVE COMPANION</small></span>
        </a>
        <a className="ideas-back" href="/">← Back to dashboard</a>
      </header>

      <section className="ideas-hero">
        <span className="ideas-eyebrow">COMMUNITY BUILDS THE ROAD AHEAD</span>
        <h1>Got an <span>idea?</span></h1>
        <p>Help shape BC Truck Works. Send feature requests, improvements, or feedback straight to our Discord ideas channel for the community and staff to review.</p>
      </section>

      <section className="ideas-layout">
        <form className="ideas-form" onSubmit={submit}>
          <div className="ideas-form-heading"><span>💡</span><div><h2>Submit an idea</h2><p>Tell us what would make your trucking experience better.</p></div></div>

          <label className="ideas-label">YOUR NAME <span>OPTIONAL</span>
            <input maxLength={60} value={form.name} onChange={e => update("name", e.target.value)} placeholder="Discord display name" autoComplete="nickname" />
          </label>

          <label className="ideas-label">IDEA TITLE
            <input required minLength={5} maxLength={100} value={form.title} onChange={e => update("title", e.target.value)} placeholder="Example: Add a trip earnings tracker" />
          </label>

          <label className="ideas-label">CATEGORY
            <select value={form.category} onChange={e => update("category", e.target.value)}>
              {categories.map(category => <option key={category}>{category}</option>)}
            </select>
          </label>

          <label className="ideas-label">DESCRIBE YOUR IDEA
            <textarea required minLength={15} maxLength={1500} rows={6} value={form.description} onChange={e => update("description", e.target.value)} placeholder="What should it do? How would it help drivers or the community?" />
            <small>{form.description.length}/1500 characters</small>
          </label>

          <label className="ideas-honeypot" aria-hidden="true">Leave this field empty
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => update("website", e.target.value)} />
          </label>

          <button className="ideas-submit" type="submit" disabled={sending}>{sending ? "Sending to Discord…" : "Send idea to Discord →"}</button>
          {status && <p className={"ideas-status " + (success ? "is-success" : "is-error")} role="status">{status}</p>}
          <p className="ideas-privacy">Please do not include passwords, private information, pairing codes, or access tokens.</p>
        </form>

        <aside className="ideas-side">
          <article className="ideas-info-card"><span>🛣️</span><h3>Shape what comes next</h3><p>Ideas can cover the website, desktop companion, convoy features, ATS/ETS2 support, Discord, and more.</p></article>
          <article className="ideas-info-card"><span>🗳️</span><h3>Community-first feedback</h3><p>Your submission is posted to Discord so staff can review it and the community can discuss it.</p></article>
          <article className="ideas-info-card"><span>🔧</span><h3>Not every idea is guaranteed</h3><p>We’ll consider usefulness, technical limits, and development time before deciding what to build.</p></article>
          <a className="ideas-dashboard-link" href="/">← Return to Live Companion</a>
        </aside>
      </section>

      <footer className="ideas-footer">BC TRUCK WORKS · DRIVE · BUILD · SUCCEED</footer>
    </main>
  );
}
