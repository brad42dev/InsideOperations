import { useState, useEffect, useCallback, useMemo } from "react";
import { graphicsApi } from "../../../api/graphics";
import { consoleApi } from "../../../api/console";
import { savedChartsApi } from "../../../api/savedCharts";
import type {
  VersionSummary,
  ObjectType,
  UseVersionListResult,
} from "../../../shared/types/versioning";

export function useVersionList(
  objectType: ObjectType,
  objectId: string,
): UseVersionListResult {
  const [allVersions, setAllVersions] = useState<VersionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterType, setFilterType] = useState<"all" | "save" | "publish">(
    "all",
  );
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!objectId) return;
    setIsLoading(true);
    setError(null);
    try {
      let result;
      if (objectType === "graphic") {
        result = await graphicsApi.getVersions(objectId, {
          includeDeleted: showDeleted,
        });
      } else if (objectType === "chart") {
        result = await savedChartsApi.listVersions(objectId, {
          includeDeleted: showDeleted,
        });
      } else {
        result = await consoleApi.listWorkspaceVersions(objectId, {
          includeDeleted: showDeleted,
        });
      }
      if (result.success) {
        setAllVersions(result.data);
      } else {
        setError(result.error?.message ?? "Failed to load versions");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load versions");
    } finally {
      setIsLoading(false);
    }
  }, [objectId, objectType, showDeleted]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions]);

  const versions = useMemo(() => {
    let list = allVersions;
    if (filterType !== "all")
      list = list.filter((v) => v.version_type === filterType);
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      list = list.filter((v) => v.label?.toLowerCase().includes(q) ?? false);
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((v) => new Date(v.created_at).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59Z").getTime();
      list = list.filter((v) => new Date(v.created_at).getTime() <= to);
    }
    return list;
  }, [allVersions, filterType, searchText, dateFrom, dateTo]);

  return {
    versions,
    allVersions,
    isLoading,
    error,
    refetch: fetchVersions,
    filterType,
    setFilterType,
    searchText,
    setSearchText,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showDeleted,
    setShowDeleted,
  };
}
