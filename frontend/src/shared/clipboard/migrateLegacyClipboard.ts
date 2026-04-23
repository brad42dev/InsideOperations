import type { ClipboardData } from "../types/graphics";
import type { IOClipboardPayload } from "./types";
import { computeTextRepresentation } from "./extract";

export function migrateLegacyClipboard(v1: ClipboardData): IOClipboardPayload {
  return {
    source: "io-clipboard",
    version: "2.0",
    createdAt: new Date().toISOString(),
    originContext: "designer",
    originGraphicId: v1.sourceGraphicId,
    contents: {
      nodes: v1.nodes,
      expressions: v1.expressions,
      originalBounds: v1.originalBounds,
      textRepresentation: computeTextRepresentation({ nodes: v1.nodes }),
    },
  };
}
