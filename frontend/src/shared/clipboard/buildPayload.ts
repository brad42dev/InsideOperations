import type {
  IOClipboardPayload,
  IOClipboardContents,
  OriginContext,
} from "./types";

export interface BuildPayloadInput {
  originContext: OriginContext;
  originGraphicId?: string;
  originPaneId?: string;
  contents: Omit<IOClipboardContents, "textRepresentation"> & {
    textRepresentation?: string;
  };
}

export function buildIOClipboardPayload(
  input: BuildPayloadInput,
): IOClipboardPayload {
  const textRepresentation = input.contents.textRepresentation ?? "";
  return {
    source: "io-clipboard",
    version: "2.0",
    createdAt: new Date().toISOString(),
    originContext: input.originContext,
    originGraphicId: input.originGraphicId,
    originPaneId: input.originPaneId,
    contents: { ...input.contents, textRepresentation },
  };
}
