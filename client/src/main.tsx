import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { AppProviders } from "./app/providers";
import { initPwa } from "./shared/lib/pwa";
import "./shared/i18n";
import "./styles/index.css";

initPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
