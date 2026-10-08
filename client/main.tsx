import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import "./styles.css";

function App() {
  const dashboard = /^\/dashboard\/?$/.test(window.location.pathname);
  useEffect(() => {
    document.title = dashboard
      ? "Overseer | Agent control center"
      : "Overseer | AI agents. Human judgment.";
  }, [dashboard]);
  return dashboard ? <Dashboard /> : <Home />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Overseer could not find its application root.");
createRoot(root).render(<StrictMode><App /></StrictMode>);
