import { Library, MonitorUp } from "lucide-react";
import { useState } from "react";

import { AssetLibrary } from "./AssetLibrary";
import { GlobalAssignmentPanel } from "./GlobalAssignmentPanel";
import type { AdminUser } from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

type ContentView = "all-screens" | "library";

interface AdminContentScreenProps {
  currentUser: AdminUser;
  onUnauthorized: () => void;
}

export function AdminContentScreen({ currentUser, onUnauthorized }: AdminContentScreenProps) {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState<ContentView>("library");

  return (
    <section className="content single-column content-workspace">
      <div className="workspace-tabs" role="tablist" aria-label={t.content.views}>
        <button
          aria-controls="content-library-panel"
          aria-selected={activeView === "library"}
          className={activeView === "library" ? "active" : ""}
          id="content-library-tab"
          onClick={() => setActiveView("library")}
          role="tab"
          type="button"
        >
          <Library aria-hidden="true" size={17} />
          {t.content.library}
        </button>
        <button
          aria-controls="all-screens-panel"
          aria-selected={activeView === "all-screens"}
          className={activeView === "all-screens" ? "active" : ""}
          id="all-screens-tab"
          onClick={() => setActiveView("all-screens")}
          role="tab"
          type="button"
        >
          <MonitorUp aria-hidden="true" size={17} />
          {t.content.allScreens}
        </button>
      </div>

      {activeView === "library" ? (
        <div aria-labelledby="content-library-tab" id="content-library-panel" role="tabpanel">
          <AssetLibrary currentUser={currentUser} onUnauthorized={onUnauthorized} />
        </div>
      ) : (
        <div
          aria-labelledby="all-screens-tab"
          className="all-screens-layout"
          id="all-screens-panel"
          role="tabpanel"
        >
          <GlobalAssignmentPanel onUnauthorized={onUnauthorized} />
        </div>
      )}
    </section>
  );
}
