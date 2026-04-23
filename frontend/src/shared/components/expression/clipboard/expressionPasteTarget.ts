import type { PasteTarget, PasteMode } from "@/shared/clipboard/types";
import { extractPoints } from "@/shared/clipboard/extract";
import type { ExpressionTile } from "@/shared/types/expression";

export interface ExpressionHooks {
  getActiveDropTargetId(): string | null;
  getTileById(id: string): {
    kind: "function" | "paren" | "operator" | "point_ref" | "literal";
  } | null;
  addPointsAsLooseTiles(points: Array<{ tagname: string }>): void;
  addPointsToFunctionTile(
    tileId: string,
    points: Array<{ tagname: string }>,
  ): void;
  addPointsToParenTile(
    tileId: string,
    points: Array<{ tagname: string }>,
  ): void;
  pasteNativeTiles(tiles: ExpressionTile[]): void;
}

export function createExpressionPasteTarget(
  hooks: ExpressionHooks,
): PasteTarget {
  return {
    id: "expression-builder",
    zoneId: "expression-builder",
    priority: 10,
    accepts(payload) {
      if (!payload) return [];
      const modes: PasteMode[] = [];
      if (extractPoints(payload).length) modes.push("points");
      if (payload.contents.expressionTiles?.length) modes.push("native");
      return modes;
    },
    async applyPaste(payload, mode) {
      if (mode === "native" && payload.contents.expressionTiles) {
        for (const clip of payload.contents.expressionTiles) {
          hooks.pasteNativeTiles(clip.tiles);
        }
        return;
      }
      if (mode === "points") {
        const points = extractPoints(payload);
        const tgtId = hooks.getActiveDropTargetId();
        if (!tgtId) {
          hooks.addPointsAsLooseTiles(points);
          return;
        }
        const tile = hooks.getTileById(tgtId);
        if (!tile) {
          hooks.addPointsAsLooseTiles(points);
          return;
        }
        if (tile.kind === "function") {
          hooks.addPointsToFunctionTile(tgtId, points);
        } else if (tile.kind === "paren") {
          hooks.addPointsToParenTile(tgtId, points);
        } else {
          hooks.addPointsAsLooseTiles(points);
        }
        return;
      }
    },
    describeRejection(payload) {
      if (!payload) return "Clipboard is empty";
      return "Expression builder accepts points or expression tiles";
    },
  };
}
