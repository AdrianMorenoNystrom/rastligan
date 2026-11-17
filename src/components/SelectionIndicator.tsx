import { useLayoutEffect, useRef } from "react";

/** A single moving surface, shared by the active items in a segmented control. */
export function SelectionIndicator({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const indicator = ref.current!;
    const parent = indicator.parentElement!;
    function measure() {
      const active = parent.querySelector<HTMLElement>(
        '[aria-current="page"], [aria-pressed="true"]',
      );
      if (!active || !parent.clientWidth) return;
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.transform = `translateX(${active.offsetLeft}px)`;
      indicator.dataset.ready = "true";
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    for (const item of parent.querySelectorAll("a, button"))
      observer.observe(item);
    return () => observer.disconnect();
  }, [value]);
  return <span ref={ref} className="selection-indicator" aria-hidden="true" />;
}
