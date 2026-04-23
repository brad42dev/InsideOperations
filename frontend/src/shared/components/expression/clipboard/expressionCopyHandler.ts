import {
  buildIOClipboardPayload,
  useIOClipboardStore,
} from "@/shared/clipboard";
import type { ExpressionTile } from "@/shared/types/expression";
import { expressionToString } from "../preview";

interface ExprBuilderAccessor {
  tiles: ExpressionTile[];
  selectedIds: string[];
  dispatchCopySelection: () => void;
}

let _accessor: (() => ExprBuilderAccessor) | null = null;

export function registerExprBuilderAccessor(
  fn: () => ExprBuilderAccessor,
): () => void {
  _accessor = fn;
  return () => {
    if (_accessor === fn) _accessor = null;
  };
}

export async function copyExpressionSelection(): Promise<void> {
  if (!_accessor) return;
  const { tiles, selectedIds, dispatchCopySelection } = _accessor();

  const selected = collectSelected(tiles, selectedIds);
  if (selected.length === 0) return;

  dispatchCopySelection();

  const payload = buildIOClipboardPayload({
    originContext: "expression-builder",
    contents: {
      expressionTiles: [{ tiles: selected }],
      textRepresentation: expressionToString(selected),
    },
  });

  await useIOClipboardStore.getState().writeToClipboard(payload);
}

function collectSelected(
  tiles: ExpressionTile[],
  selectedIds: string[],
): ExpressionTile[] {
  const result: ExpressionTile[] = [];
  for (const t of tiles) {
    if (selectedIds.includes(t.id)) {
      result.push(t);
    }
    for (const sub of [t.children, t.condition, t.thenBranch, t.elseBranch]) {
      if (sub) result.push(...collectSelected(sub, selectedIds));
    }
  }
  return result;
}
