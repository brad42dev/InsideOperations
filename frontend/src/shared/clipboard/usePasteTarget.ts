import { useEffect } from "react";
import type { PasteTarget } from "./types";
import { registerPasteTarget } from "./pasteTargetRegistry";

export function usePasteTarget(target: PasteTarget | null) {
  useEffect(() => {
    if (!target) return;
    return registerPasteTarget(target);
  }, [target]);
}
