import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { LoginView } from "./views/LoginView.tsx";
import { SettingsView } from "./views/SettingsView.tsx";
import { OnboardingView } from "./views/OnboardingView.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<LoginView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="/onboarding" element={<OnboardingView />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
