import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/index.css";
import App from "./App.jsx";
import { AuthProvider } from "./controllers/AuthContext.jsx";
import { SessionProvider } from "./controllers/SessionContext.jsx";
import { OfflineProvider } from "./controllers/OfflineContext.jsx";
import ErrorBoundary from "./views/components/ErrorBoundary.jsx";
import "./models/loggerService.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <SessionProvider>
            <OfflineProvider>
              <App />
            </OfflineProvider>
          </SessionProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);