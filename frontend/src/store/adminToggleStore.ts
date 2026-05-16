import { create } from "zustand";

interface AdminToggleState {
  showAllUsersObjects: boolean;
  setShowAllUsersObjects: (v: boolean) => void;
  showDeletedVersions: boolean;
  setShowDeletedVersions: (v: boolean) => void;
}

export const useAdminToggleStore = create<AdminToggleState>()((set) => ({
  showAllUsersObjects: false,
  setShowAllUsersObjects: (v) => set({ showAllUsersObjects: v }),
  showDeletedVersions: false,
  setShowDeletedVersions: (v) => set({ showDeletedVersions: v }),
}));
