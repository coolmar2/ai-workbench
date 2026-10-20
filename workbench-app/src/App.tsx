import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { AppShell } from "./components/shell/AppShell";
import { Spinner, Toaster, TooltipProvider } from "./components/ui";

// Pages are split into their own chunks.
const EditorPage = lazy(() => import("./pages/editor/EditorPage"));
const AgentPage = lazy(() => import("./pages/agent/AgentPage"));
const MissionPage = lazy(() => import("./pages/mission/MissionPage"));
const SessionPage = lazy(() => import("./pages/session/SessionPage"));
const IdentityPage = lazy(() => import("./pages/identity/IdentityPage"));

function PageFallback() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <AppShell>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Navigate to="/editor" replace />} />
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/agent" element={<AgentPage />} />
              <Route path="/mission" element={<MissionPage />} />
              <Route
                path="/mission/session/:id"
                element={<SessionPage initialView="chat" />}
              />
              <Route
                path="/mission/session/:id/cloud"
                element={<SessionPage initialView="cloud" />}
              />
              <Route path="/identity" element={<IdentityPage />} />
              <Route path="*" element={<Navigate to="/editor" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
        <Toaster />
      </TooltipProvider>
    </MotionConfig>
  );
}
