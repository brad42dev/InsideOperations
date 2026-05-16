import { useState, useCallback } from "react";
import { graphicsApi } from "../../../api/graphics";
import { consoleApi } from "../../../api/console";
import { savedChartsApi } from "../../../api/savedCharts";
import type {
  ObjectType,
  GraphicVersionContent,
  WorkspaceVersionContent,
  ChartVersionContent,
  UseVersionActionsResult,
} from "../../../shared/types/versioning";

export function useVersionActions(
  objectType: ObjectType,
  objectId: string,
): UseVersionActionsResult {
  const [isLoading, setIsLoading] = useState(false);
  const [actionVersionNumber, setActionVersionNumber] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function withLoading<T>(
    versionNumber: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    setActionVersionNumber(versionNumber);
    setIsLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
      return null;
    } finally {
      setIsLoading(false);
      setActionVersionNumber(null);
    }
  }

  const loadVersion = useCallback(
    async (
      versionNumber: number,
    ): Promise<
      | GraphicVersionContent
      | WorkspaceVersionContent
      | ChartVersionContent
      | null
    > => {
      return withLoading(versionNumber, async () => {
        let result;
        if (objectType === "graphic") {
          result = await graphicsApi.getVersionContent(objectId, versionNumber);
        } else if (objectType === "chart") {
          result = await savedChartsApi.getVersionContent(
            objectId,
            versionNumber,
          );
        } else {
          result = await consoleApi.getWorkspaceVersionContent(
            objectId,
            versionNumber,
          );
        }
        if (!result.success) {
          throw new Error(
            result.error?.message ?? "Failed to load version content",
          );
        }
        return result.data as
          | GraphicVersionContent
          | WorkspaceVersionContent
          | ChartVersionContent;
      });
    },
     
    [objectType, objectId],
  );

  const softDeleteVersion = useCallback(
    async (versionNumber: number): Promise<boolean> => {
      const result = await withLoading(versionNumber, () => {
        if (objectType === "graphic")
          return graphicsApi.softDeleteVersion(objectId, versionNumber);
        if (objectType === "chart")
          return savedChartsApi.softDeleteVersion(objectId, versionNumber);
        return consoleApi.softDeleteWorkspaceVersion(objectId, versionNumber);
      });
      return !!(result as { deleted?: boolean } | null)?.deleted;
    },
     
    [objectType, objectId],
  );

  const restoreVersion = useCallback(
    async (versionNumber: number): Promise<boolean> => {
      const result = await withLoading(versionNumber, () => {
        if (objectType === "graphic")
          return graphicsApi.restoreVersion(objectId, versionNumber);
        if (objectType === "chart")
          return savedChartsApi.restoreVersion(objectId, versionNumber);
        return consoleApi.restoreWorkspaceVersion(objectId, versionNumber);
      });
      return !!result;
    },
     
    [objectType, objectId],
  );

  const recoverVersion = useCallback(
    async (versionNumber: number): Promise<boolean> => {
      const result = await withLoading(versionNumber, () => {
        if (objectType === "graphic")
          return graphicsApi.recoverVersion(objectId, versionNumber);
        if (objectType === "chart")
          return savedChartsApi.recoverVersion(objectId, versionNumber);
        return consoleApi.recoverWorkspaceVersion(objectId, versionNumber);
      });
      return !!result;
    },
     
    [objectType, objectId],
  );

  const permanentDeleteVersion = useCallback(
    async (versionNumber: number): Promise<boolean> => {
      const result = await withLoading(versionNumber, () => {
        if (objectType === "graphic")
          return graphicsApi.permanentDeleteVersion(objectId, versionNumber);
        if (objectType === "chart")
          return savedChartsApi.permanentDeleteVersion(objectId, versionNumber);
        return consoleApi.permanentDeleteWorkspaceVersion(
          objectId,
          versionNumber,
        );
      });
      return !!result;
    },
     
    [objectType, objectId],
  );

  const updateLabel = useCallback(
    async (versionNumber: number, label: string | null): Promise<boolean> => {
      const result = await withLoading(versionNumber, () => {
        if (objectType === "graphic")
          return graphicsApi.updateVersionLabel(objectId, versionNumber, label);
        if (objectType === "chart")
          return savedChartsApi.updateVersionLabel(
            objectId,
            versionNumber,
            label,
          );
        return consoleApi.updateWorkspaceVersionLabel(
          objectId,
          versionNumber,
          label,
        );
      });
      return !!result;
    },
     
    [objectType, objectId],
  );

  return {
    loadVersion,
    softDeleteVersion,
    restoreVersion,
    recoverVersion,
    permanentDeleteVersion,
    updateLabel,
    isLoading,
    actionVersionNumber,
    error,
  };
}
