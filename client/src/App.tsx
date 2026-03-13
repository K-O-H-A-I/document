import { useEffect, useState } from "react";
import { Router as WouterRouter, Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import { getBasePath } from "@/lib/base-path";

// Import styles
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/ui.css";

function AppRouter() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [location, setLocation] = useLocation();
  const basePath = getBasePath();
  const routerBase = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

  useEffect(() => {
    const syncAuth = () => {
      const token = window.localStorage.getItem("docRiskToken");
      setIsAuthed(Boolean(token && token.trim()));
    };

    syncAuth();
    window.addEventListener("docRisk:auth", syncAuth);

    return () => {
      window.removeEventListener("docRisk:auth", syncAuth);
    };
  }, []);

  useEffect(() => {
    if (!isAuthed && location !== "/login") {
      setLocation("/login");
    }
    if (isAuthed && location === "/login") {
      setLocation("/");
    }
  }, [isAuthed, location, setLocation]);

  return (
    <WouterRouter base={routerBase}>
      <Switch>
        <Route path="/">{isAuthed ? <Home /> : <Login />}</Route>
        <Route path="/login">
          {isAuthed ? <Home /> : <Login />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

function App() {
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    try {
      setIsEmbedded(window.top !== window.self);
    } catch {
      setIsEmbedded(true);
    }
  }, []);

  useEffect(() => {
    const search = window.location.search || "";
    if (search.startsWith("?/")) {
      const target = search.slice(2);
      const basePath = getBasePath();
      const newUrl = `${basePath}${target}${window.location.hash || ""}`;
      window.history.replaceState(null, "", newUrl);
    }
    if (!import.meta.env.DEV && window.location.pathname === "/login") {
      window.location.replace("/document/login");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {isEmbedded && (
          <div className="sticky top-0 z-[200] border-b border-[var(--border)] bg-[var(--panel)]/95 px-4 py-2 text-center text-xs text-[var(--muted)] backdrop-blur-md">
            This app is not intended to run inside an embedded frame.
          </div>
        )}
        <AppRouter />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
