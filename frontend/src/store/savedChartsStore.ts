import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uuidv4 } from "../lib/uuid";
import type { ChartConfig } from "../shared/components/charts/chart-config-types";

export interface SavedChart {
  id: string;
  name: string;
  description?: string;
  /** ChartTypeId (numeric) */
  chartType: number;
  config: ChartConfig;
  published?: boolean;
  owner_id?: string;
  createdAt: string;
}

interface SavedChartsState {
  charts: SavedChart[];
  saveChart: (
    data: Omit<SavedChart, "id" | "createdAt"> & { id?: string },
  ) => SavedChart;
  publishChart: (id: string, published: boolean) => void;
  deleteChart: (id: string) => void;
}

export const useSavedChartsStore = create<SavedChartsState>()(
  persist(
    (set, get) => ({
      charts: [],

      saveChart: (data) => {
        const existing = data.id
          ? get().charts.find((c) => c.id === data.id)
          : null;
        const chart: SavedChart = {
          ...data,
          id: data.id ?? uuidv4(),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        set((state) => ({
          charts: existing
            ? state.charts.map((c) => (c.id === chart.id ? chart : c))
            : [...state.charts, chart],
        }));
        return chart;
      },

      publishChart: (id, published) => {
        set((state) => ({
          charts: state.charts.map((c) =>
            c.id === id ? { ...c, published } : c,
          ),
        }));
      },

      deleteChart: (id) => {
        set((state) => ({ charts: state.charts.filter((c) => c.id !== id) }));
      },
    }),
    { name: "io_saved_charts" },
  ),
);
