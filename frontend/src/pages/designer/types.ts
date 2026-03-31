export type DesignerMode = "graphic" | "dashboard" | "report";
export type DrawingTool =
  | "select"
  | "rect"
  | "ellipse"
  | "path"
  | "text"
  | "line"
  | "pipe"
  | "pencil"
  | "image"
  | "pan";

export type AutoSaveStatus = "saved" | "saving" | "failed" | "dirty";

export interface DesignerLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface DesignerState {
  mode: DesignerMode;
  activeTool: DrawingTool;
  selectedElementIds: string[];
  zoom: number;
  panX: number;
  panY: number;
  isDirty: boolean; // unsaved changes
  documentId: string | null;
  documentName: string;
  gridEnabled: boolean;
  gridSize: number; // pixels
  snapEnabled: boolean;
  undoStack: string[]; // serialized SVG snapshots, max 20
  redoStack: string[];
  focusMode: boolean; // hides sidebar and top nav
  layers: DesignerLayer[];
  testMode: boolean;
  autoSaveStatus: AutoSaveStatus;
  autoSaveAge: number; // seconds since last save
}

export const DEFAULT_LAYERS: DesignerLayer[] = [
  { id: "layer-bg", name: "Background", visible: true, locked: false },
  { id: "layer-equip", name: "Equipment", visible: true, locked: false },
  { id: "layer-pipes", name: "Pipes", visible: true, locked: false },
  { id: "layer-values", name: "Values", visible: true, locked: false },
  { id: "layer-annot", name: "Annotations", visible: true, locked: false },
];
