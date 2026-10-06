import { Footer, Header } from "../components/Layout";

const features = [
  ["01 / DIRECTION", "Start with a clear goal", "Describe the task in plain language. Launch a run from the dashboard without writing a script."],
  ["02 / OBSERVABILITY", "Follow the activity", "Inspect recorded proposals, observations, retries, and errors. Revisit recent runs through locally stored traces."],
  ["03 / OVERSIGHT", "Keep the final say", "Actions marked for approval pause for your review. Approve the proposal or reject it so the agent can choose a different approach."],
];

const steps = [
  ["STEP 01", "Open your workspace", "Configure an OpenAI key with available API credits, then open the dashboard and enter your goal."],
  ["STEP 02", "Observe the run", "The agent uses the model and configured tools. The dashboard refreshes activity and shows failures explicitly."],
  ["STEP 03", "Review when needed", "Inspect pending action details and choose approve or reject. Keep the server running while an approval is waiting."],
];

const questions = [
  ["Do I need an OpenAI subscription?", "You need an OpenAI API key with available API usage. A ChatGPT subscription does not include API credits. The homepage and dashboard can load without credits, but model-powered tasks cannot run."],
  ["Does it search the web or send real emails?", "Not yet. Web search currently returns placeholder results. Email drafts are stored in memory and sending is simulated. Live providers still need to be connected."],
  ["Is my workspace available to everyone online?", "The homepage is public when deployed. The Render setup protects the dashboard and API with one shared password, but there are no individual accounts or roles. Do not deploy without setting both dashboard credentials."],
  ["What happens when I restart the server?", "Recorded traces remain in the local SQLite database. In-memory drafts and pending approvals do not survive a restart, and unfinished runs do not automatically resume."],
];

export function Home() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main className="wrap" id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div>
            <p className="eyebrow">AI agents. Human judgment.</p>
            <h1 id="hero-title">Let your agent work.<br /><span>Stay in control.</span></h1>
            <p className="lead">A workspace for AI that keeps you in the loop. Set a goal, follow the activity, and review important actions before they move forward.</p>
            <div className="hero-actions">
              <a className="button" href="/dashboard">Enter your workspace <span aria-hidden="true">&rarr;</span></a>
              <a className="button secondary" href="#how-it-works">See how it works</a>
            </div>
            <p className="fine-print">Self-hosted workspace &middot; Bring your own OpenAI API key</p>
          </div>
          <figure className="preview" aria-label="Illustrative agent workflow, not live activity">
            <div className="preview-head"><strong>Agent workspace</strong><span className="badge preview-badge">Illustrative preview</span></div>
            <div className="preview-body">
              <span className="eyebrow">Your goal</span>
              <p className="preview-goal">Prepare an outreach email about renewable energy initiatives.</p>
              <div className="preview-step"><span aria-hidden="true">1</span><div><strong>Goal received</strong>A new run begins with your instructions.</div></div>
              <div className="preview-step"><span aria-hidden="true">2</span><div><strong>Draft prepared</strong>Review the agent's recorded activity.</div></div>
              <div className="preview-review"><strong>Human decision required</strong><p>The send action pauses for approval. In this preview, email sending is simulated.</p></div>
            </div>
            <figcaption>Example workflow only. Live run status appears in your dashboard.</figcaption>
          </figure>
        </section>
        <div className="principles"><span>Goal-driven workflows</span><span>Step-by-step visibility</span><span>Human approval gates</span><span>Local trace history</span></div>
        <section className="site-section" id="features" aria-labelledby="features-title">
          <p className="eyebrow">Clarity over black boxes</p>
          <h2 id="features-title">A better view of what your AI is doing.</h2>
          <p className="section-description">One place to direct your agent, inspect its progress, and make the decisions that shouldn't be left to automation.</p>
          <div className="feature-grid">{features.map(([label, title, description]) => (
            <article className="feature-card" key={label}><p className="number">{label}</p><h3>{title}</h3><p>{description}</p></article>
          ))}</div>
        </section>
        <section className="site-section workflow" id="how-it-works" aria-labelledby="workflow-title">
          <p className="eyebrow">From goal to oversight</p><h2 id="workflow-title">A simple loop. A human in the middle.</h2>
          <p className="section-description">React powers your workspace. The Node.js server handles agent runs and keeps your API key out of the browser.</p>
          <div className="feature-grid">{steps.map(([label, title, description]) => (
            <article className="workflow-step" key={label}><p className="number">{label}</p><h3>{title}</h3><p>{description}</p></article>
          ))}</div>
        </section>
        <section className="site-section faq" id="faq" aria-labelledby="faq-title">
          <div><p className="eyebrow">Know before you start</p><h2 id="faq-title">Built to explore.<br />Honest about its limits.</h2><p className="section-description">Overseer is a development prototype, not a production-ready hosted service.</p></div>
          <div>{questions.map(([question, answer], index) => (
            <details key={question} open={index === 0}><summary>{question}</summary><p>{answer}</p></details>
          ))}
            <details><summary>Where can I read the project documentation?</summary><p>Read the <a href="https://github.com/dross7278-star/overseer">Overseer GitHub repository</a> for the published README. This React migration has not been published there yet.</p></details>
          </div>
        </section>
        <section className="call-to-action" aria-labelledby="cta-title">
          <div><h2 id="cta-title">Put human judgment back in the loop.</h2><p>Your agent workspace is one click away.</p></div>
          <a className="button" href="/dashboard">Open dashboard <span aria-hidden="true">&rarr;</span></a>
        </section>
      </main>
      <Footer />
    </>
  );
}
