import { create } from "zustand";
import { savedChartsApi, type SavedChartResponse } from "../api/savedCharts";
import type { ChartConfig } from "../shared/components/charts/chart-config-types";

export interface SavedChart {
  id: string;
  name: string;
  description?: string;
  chartType: number;
  config: ChartConfig;
  published: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

interface SavedChartsState {
  charts: SavedChart[];
  loading: boolean;
  initialized: boolean;
  migrationPending: boolean;

  fetchCharts: (params?: { allUsers?: boolean }) => Promise<void>;
  saveChart: (
    data: Omit<SavedChart, "id" | "createdAt" | "updatedAt" | "createdBy"> & {
      id?: string;
    },
  ) => Promise<SavedChart | null>;
  publishChart: (id: string, published: boolean) => Promise<void>;
  deleteChart: (id: string) => Promise<void>;
  migrateFromLocalStorage: () => Promise<void>;
  dismissMigration: () => void;
}

function mapApiToLocal(r: SavedChartResponse): SavedChart {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    chartType: r.chart_type,
    config: r.config,
    published: r.published,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const useSavedChartsStore = create<SavedChartsState>()((set, get) => ({
  charts: [],
  loading: false,
  initialized: false,
  migrationPending: false,

  fetchCharts: async (params?: { allUsers?: boolean }) => {
    set({ loading: true });
    const result = await savedChartsApi.list({ allUsers: params?.allUsers });
    if (result.success) {
      const items = Array.isArray(result.data.data) ? result.data.data : [];
      const charts = items.map(mapApiToLocal);

      let migrationPending = false;
      if (charts.length === 0) {
        try {
          const localRaw = localStorage.getItem("io_saved_charts");
          if (localRaw) {
            const parsed = JSON.parse(localRaw) as {
              state?: { charts?: unknown[] };
            };
            if ((parsed?.state?.charts?.length ?? 0) > 0) {
              migrationPending = true;
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      set({ charts, loading: false, initialized: true, migrationPending });
    } else {
      set({ loading: false, initialized: true });
    }
  },

  saveChart: async (data) => {
    if (data.id) {
      // UpdateSavedChartRequest has no published field — use publishChart to change publish state
      const updateBody = {
        name: data.name,
        description: data.description,
        chart_type: data.chartType,
        config: data.config,
      };
      const result = await savedChartsApi.update(data.id, updateBody);
      if (result.success) {
        const chart = mapApiToLocal(result.data);
        set((s) => ({
          charts: s.charts.map((c) => (c.id === chart.id ? chart : c)),
        }));
        return chart;
      }
    } else {
      const createBody = {
        name: data.name,
        description: data.description,
        chart_type: data.chartType,
        config: data.config,
        published: data.published,
      };
      const result = await savedChartsApi.create(createBody);
      if (result.success) {
        const chart = mapApiToLocal(result.data);
        set((s) => ({ charts: [...s.charts, chart] }));
        return chart;
      }
    }
    return null;
  },

  publishChart: async (id, published) => {
    const result = published
      ? await savedChartsApi.publish(id)
      : await savedChartsApi.unpublish(id);
    if (result.success) {
      set((s) => ({
        charts: s.charts.map((c) => (c.id === id ? { ...c, published } : c)),
      }));
    }
  },

  deleteChart: async (id) => {
    const result = await savedChartsApi.remove(id);
    if (result.success) {
      set((s) => ({ charts: s.charts.filter((c) => c.id !== id) }));
    }
  },

  migrateFromLocalStorage: async () => {
    const localRaw = localStorage.getItem("io_saved_charts");
    if (!localRaw) return;
    try {
      const parsed = JSON.parse(localRaw) as {
        state?: { charts?: Array<SavedChart> };
      };
      const localCharts = parsed?.state?.charts ?? [];
      let allSucceeded = true;
      for (const lc of localCharts) {
        const result = await savedChartsApi.create({
          name: lc.name,
          description: lc.description,
          chart_type: lc.chartType,
          config: lc.config,
          published: lc.published ?? false,
        });
        if (!result.success) allSucceeded = false;
      }
      // Only clear localStorage when every chart was successfully migrated;
      // leave it intact on partial failure so the user can retry.
      if (allSucceeded) localStorage.removeItem("io_saved_charts");
      await get().fetchCharts();
    } catch (e) {
      console.error("Failed to migrate saved charts from localStorage:", e);
    }
    set({ migrationPending: false });
  },

  dismissMigration: () => {
    localStorage.removeItem("io_saved_charts");
    set({ migrationPending: false });
  },
}));
