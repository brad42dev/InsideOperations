export interface VersionSummary {
  id: string;
  version_number: number;
  version_type: "save" | "publish";
  label: string | null;
  parent_version_number: number | null;
  metadata: {
    element_count?: number;
    binding_count?: number;
    [key: string]: unknown;
  } | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface GraphicVersionContent {
  id: string;
  version_number: number;
  version_type: "save" | "publish";
  label: string | null;
  parent_version_number: number | null;
  scene_data: unknown;
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
}

export interface WorkspaceVersionContent {
  id: string;
  version_number: number;
  version_type: "save" | "publish";
  label: string | null;
  parent_version_number: number | null;
  layout: unknown;
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
}

export interface ChartVersionContent {
  id: string;
  version_number: number;
  version_type: "save" | "publish";
  label: string | null;
  parent_version_number: number | null;
  config: unknown;
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
}

export type ObjectType = "graphic" | "workspace" | "chart";

export interface VersionRecoveryDialogProps {
  open: boolean;
  onClose: () => void;
  objectType: ObjectType;
  objectId: string;
  objectName?: string;
  onLoadVersion: (
    content:
      | GraphicVersionContent
      | WorkspaceVersionContent
      | ChartVersionContent,
  ) => void;
}

export interface UseVersionListResult {
  versions: VersionSummary[];
  allVersions: VersionSummary[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  filterType: "all" | "save" | "publish";
  setFilterType: (t: "all" | "save" | "publish") => void;
  searchText: string;
  setSearchText: (s: string) => void;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  showDeleted: boolean;
  setShowDeleted: (v: boolean) => void;
}

export interface UseVersionActionsResult {
  loadVersion: (
    versionNumber: number,
  ) => Promise<
    GraphicVersionContent | WorkspaceVersionContent | ChartVersionContent | null
  >;
  softDeleteVersion: (versionNumber: number) => Promise<boolean>;
  restoreVersion: (versionNumber: number) => Promise<boolean>;
  recoverVersion: (versionNumber: number) => Promise<boolean>;
  permanentDeleteVersion: (versionNumber: number) => Promise<boolean>;
  updateLabel: (
    versionNumber: number,
    label: string | null,
  ) => Promise<boolean>;
  isLoading: boolean;
  actionVersionNumber: number | null;
  error: string | null;
}
