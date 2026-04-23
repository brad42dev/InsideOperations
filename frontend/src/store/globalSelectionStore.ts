import { create } from "zustand";
import type {
  SelectionZoneId,
  SelectableEntity,
  SelectionZoneConfig,
} from "../shared/clipboard";

interface ZoneState {
  config: SelectionZoneConfig;
  selected: Map<string, SelectableEntity>;
  anchor: string | null;
}

interface GlobalSelectionState {
  zones: Map<SelectionZoneId, ZoneState>;
  activeZone: SelectionZoneId | null;

  registerZone(config: SelectionZoneConfig): void;
  unregisterZone(zoneId: SelectionZoneId): void;
  setActiveZone(zoneId: SelectionZoneId | null): void;

  select(
    zoneId: SelectionZoneId,
    entity: SelectableEntity,
    mode?: "replace" | "add" | "toggle" | "remove",
  ): void;
  selectMany(
    zoneId: SelectionZoneId,
    entities: SelectableEntity[],
    mode?: "replace" | "add" | "toggle" | "remove",
  ): void;
  selectAll(zoneId: SelectionZoneId, entities: SelectableEntity[]): void;
  clearZone(zoneId: SelectionZoneId): void;
  clearAll(): void;

  getSelection(zoneId: SelectionZoneId): SelectableEntity[];
  getActiveSelection(): {
    zoneId: SelectionZoneId;
    entities: SelectableEntity[];
  } | null;
  isSelected(zoneId: SelectionZoneId, entityId: string): boolean;
  selectionCount(zoneId: SelectionZoneId): number;
}

export const useGlobalSelectionStore = create<GlobalSelectionState>(
  (set, get) => ({
    zones: new Map(),
    activeZone: null,

    registerZone(config) {
      set((s) => {
        const next = new Map(s.zones);
        if (!next.has(config.zoneId)) {
          next.set(config.zoneId, {
            config,
            selected: new Map(),
            anchor: null,
          });
        } else {
          const existing = next.get(config.zoneId)!;
          next.set(config.zoneId, { ...existing, config });
        }
        return { zones: next };
      });
    },

    unregisterZone(zoneId) {
      set((s) => {
        const next = new Map(s.zones);
        next.delete(zoneId);
        return {
          zones: next,
          activeZone: s.activeZone === zoneId ? null : s.activeZone,
        };
      });
    },

    setActiveZone(zoneId) {
      set({ activeZone: zoneId });
    },

    select(zoneId, entity, mode = "replace") {
      set((s) => {
        const zone = s.zones.get(zoneId);
        if (!zone) return {};
        const nextSelected = new Map(zone.selected);
        if (mode === "replace") {
          nextSelected.clear();
          nextSelected.set(entity.id, entity);
        } else if (mode === "add") {
          nextSelected.set(entity.id, entity);
        } else if (mode === "toggle") {
          if (nextSelected.has(entity.id)) nextSelected.delete(entity.id);
          else nextSelected.set(entity.id, entity);
        } else if (mode === "remove") {
          nextSelected.delete(entity.id);
        }
        const nextZones = new Map(s.zones);
        nextZones.set(zoneId, {
          ...zone,
          selected: nextSelected,
          anchor: entity.id,
        });
        return { zones: nextZones };
      });
    },

    selectMany(zoneId, entities, mode = "replace") {
      set((s) => {
        const zone = s.zones.get(zoneId);
        if (!zone) return {};
        const nextSelected = new Map(zone.selected);
        if (mode === "replace") nextSelected.clear();
        for (const e of entities) {
          if (mode === "remove") nextSelected.delete(e.id);
          else if (mode === "toggle") {
            if (nextSelected.has(e.id)) nextSelected.delete(e.id);
            else nextSelected.set(e.id, e);
          } else nextSelected.set(e.id, e);
        }
        const nextZones = new Map(s.zones);
        nextZones.set(zoneId, {
          ...zone,
          selected: nextSelected,
          anchor: entities.length
            ? entities[entities.length - 1].id
            : zone.anchor,
        });
        return { zones: nextZones };
      });
    },

    selectAll(zoneId, entities) {
      get().selectMany(zoneId, entities, "replace");
    },

    clearZone(zoneId) {
      set((s) => {
        const zone = s.zones.get(zoneId);
        if (!zone) return {};
        const nextZones = new Map(s.zones);
        nextZones.set(zoneId, { ...zone, selected: new Map(), anchor: null });
        return { zones: nextZones };
      });
    },

    clearAll() {
      set((s) => {
        const nextZones = new Map<SelectionZoneId, ZoneState>();
        for (const [id, zone] of s.zones) {
          nextZones.set(id, { ...zone, selected: new Map(), anchor: null });
        }
        return { zones: nextZones };
      });
    },

    getSelection(zoneId) {
      const zone = get().zones.get(zoneId);
      return zone ? Array.from(zone.selected.values()) : [];
    },

    getActiveSelection() {
      const { activeZone, zones } = get();
      if (!activeZone) return null;
      const zone = zones.get(activeZone);
      if (!zone) return null;
      return {
        zoneId: activeZone,
        entities: Array.from(zone.selected.values()),
      };
    },

    isSelected(zoneId, entityId) {
      const zone = get().zones.get(zoneId);
      return !!zone && zone.selected.has(entityId);
    },

    selectionCount(zoneId) {
      const zone = get().zones.get(zoneId);
      return zone ? zone.selected.size : 0;
    },
  }),
);
