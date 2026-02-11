import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProvider } from "./context/AppProvider";
import "./index.css"; // 👈 REQUIRED
import { InteractionProvider } from "./context/InteractionContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AppProvider>
    <InteractionProvider>
      <App />
    </InteractionProvider>
  </AppProvider>
);
