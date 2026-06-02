import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./firebase"; // Firebase初期化（app/analytics/auth/firestore）

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
