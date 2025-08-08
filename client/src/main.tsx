import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

const root = createRoot(container);

try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Failed to render app:", error);
  root.render(
    <div style={{ padding: "20px", color: "red" }}>
      <h1>Loading Error</h1>
      <p>Failed to load the application. Check console for details.</p>
    </div>
  );
}