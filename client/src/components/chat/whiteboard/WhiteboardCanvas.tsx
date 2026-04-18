import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export function WhiteboardCanvas({ children }: { children: React.ReactNode }) {
  return (
    <TransformWrapper
      minScale={0.25}
      maxScale={3}
      initialScale={0.8}
      centerOnInit
      wheel={{ step: 0.1 }}
      doubleClick={{ disabled: true }}
    >
      <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-[2600px] !min-h-[1200px]">
        <div className="relative w-full h-full" data-testid="whiteboard-canvas-inner">{children}</div>
      </TransformComponent>
    </TransformWrapper>
  );
}
