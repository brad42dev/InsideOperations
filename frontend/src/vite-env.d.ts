/// <reference types="vite/client" />

// react-resizable has no @types package; minimal declaration for prototype patching
declare module "react-resizable" {
  import type { PureComponent } from "react";
  export class Resizable extends PureComponent<Record<string, unknown>> {
    resizeHandler(
      handlerName: string,
      axis: string,
    ): (e: Event, ref: object) => void;
    lastHandleRect: DOMRect | null;
  }
  export class ResizableBox extends PureComponent<Record<string, unknown>> {}
}
