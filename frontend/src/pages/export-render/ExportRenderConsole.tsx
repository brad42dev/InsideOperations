import { useEffect, useState } from "react";
import { useQuery, useIsFetching } from "@tanstack/react-query";
import { consoleApi } from "../../api/console";
import WorkspaceGrid from "../console/WorkspaceGrid";
import type { WorkspaceLayout } from "../console/types";
import { TimestampOverlay } from "../../shared/components/TimestampOverlay";

interface Props {
  graphicId: string;
  tsParam: number;
  width: number;
  height: number;
  overlayEnabled: boolean;
}

export function ExportRenderConsole({ graphicId, tsParam, width, height, overlayEnabled }: Props) {
  const snappedTs = Math.floor(tsParam / 1000) * 1000;

  const { data: workspace, isSuccess: workspaceLoaded } = useQuery<WorkspaceLayout | null>({
    queryKey: ["workspace", graphicId],
    queryFn: async () => {
      const result = await consoleApi.getWorkspace(graphicId);
      return result.success ? result.data ?? null : null;
    },
  });

  // useHistoricalValues inside GraphicPane uses useQueries with keys ["historical", id, ts].
  // useIsFetching counts all in-flight queries with that prefix, so this gate correctly
  // waits for point values to load before the capture worker screenshots the frame.
  const isFetching = useIsFetching({ queryKey: ["historical"] });
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    void document.fonts.ready.then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    if (workspaceLoaded && isFetching === 0 && fontsReady) {
      document.body.setAttribute("data-export-ready", "true");
    } else {
      document.body.removeAttribute("data-export-ready");
    }
  }, [workspaceLoaded, isFetching, fontsReady, snappedTs]);

  if (!workspace) {
    return null;
  }

  return (
    <div style={{ position: "relative", width, height, overflow: "hidden" }}>
      <WorkspaceGrid
        workspace={workspace}
        locked
        onConfigurePane={() => undefined}
        onRemovePane={() => undefined}
      />
      {overlayEnabled && (
        <TimestampOverlay timestamp={tsParam} />
      )}
    </div>
  );
}
