import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AIConfigProvider } from "@/context/AIConfigContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
        <AIConfigProvider>
            <App />
        </AIConfigProvider>
    </ErrorBoundary>
);
