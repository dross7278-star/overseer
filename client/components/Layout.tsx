import type { ReactNode } from "react";
import { publicReadOnly } from "../config";

export function Header({ dashboard, children }: { dashboard?: boolean; children?: ReactNode }) {
  return (
    <header className="site-header">
      <nav className="wrap navigation" aria-label="Main navigation">
        <a className="brand" href="/" aria-label="Overseer home">
          <span className="brand-mark" aria-hidden="true">O</span>Overseer
        </a>
        <div className="nav-links">
          {dashboard ? <a href="/">Home</a> : <>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
            <a className="button small" href="/dashboard">Open dashboard <span aria-hidden="true">&rarr;</span></a>
          </>}
          {children}
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="wrap site-footer">
      <span>Overseer &middot; AI agents. Human judgment.</span>
      <span>{publicReadOnly ? "Public read-only preview" : "Self-hosted development prototype"} &middot; <a href="https://github.com/dross7278-star/overseer/tree/render-live">GitHub</a></span>
    </footer>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
