import type { PasteTarget } from "@/shared/clipboard";

export function createTextFieldTarget(): PasteTarget {
  return {
    id: "global-text-field",
    zoneId: "designer",
    priority: -100,
    accepts(payload) {
      if (!payload) return [];
      if (!payload.contents.textRepresentation) return [];
      return ["text"];
    },
    async applyPaste(payload) {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const text = payload.contents.textRepresentation;
      if ((el as HTMLInputElement).value !== undefined) {
        const input = el as HTMLInputElement | HTMLTextAreaElement;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.value =
          input.value.slice(0, start) + text + input.value.slice(end);
        input.setSelectionRange(start + text.length, start + text.length);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (el.isContentEditable) {
        document.execCommand("insertText", false, text);
      }
    },
    describeRejection() {
      return "No text content on clipboard";
    },
  };
}
