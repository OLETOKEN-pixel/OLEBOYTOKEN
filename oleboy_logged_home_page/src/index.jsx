import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LoggedHomePage } from "./screens/LoggedHomePage";

createRoot(document.getElementById("app")).render(
  <StrictMode>
    <LoggedHomePage />
  </StrictMode>,
);
