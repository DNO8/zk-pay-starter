import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import "./index.css";
import { DebugPage } from "./pages/DebugPage";
import { AppPage } from "./pages/AppPage";

function Shell() {
  const location = useLocation();
  const [paymentOpened, setPaymentOpened] = useState(
    location.pathname === "/app",
  );
  useEffect(() => {
    if (location.pathname === "/app") setPaymentOpened(true);
  }, [location.pathname]);
  useEffect(() => {
    if (location.pathname === "/app" && paymentOpened && location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  }, [location.pathname, location.hash, paymentOpened]);
  return (
    <div className="min-h-screen">
      <nav className="flex gap-4 border-b border-graphite px-4 py-3 text-sm">
        <span className="text-amber">zk-pay-starter</span>
        <NavLink to="/debug" className="underline">
          /debug
        </NavLink>
        <NavLink to="/app" className="underline">
          /app
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<DebugPage />} />
        <Route path="/debug" element={<DebugPage />} />
        <Route path="/app" element={null} />
      </Routes>
      {/* Keep an opened payment session in memory when visiting diagnostics. */}
      {paymentOpened && (
        <div hidden={location.pathname !== "/app"}>
          <AppPage />
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  </React.StrictMode>,
);
