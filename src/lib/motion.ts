export const easeOut = "cubic-bezier(0.22, 1, 0.36, 1)";
export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function dialogFrames(
  dialog: HTMLDialogElement,
  origin?: HTMLElement | null,
) {
  const target = dialog.getBoundingClientRect();
  const from = origin?.isConnected ? origin.getBoundingClientRect() : null;
  const visible =
    from &&
    from.bottom > 0 &&
    from.top < innerHeight &&
    from.right > 0 &&
    from.left < innerWidth;
  const transform = visible
    ? `translate(${from.left + from.width / 2 - target.left - target.width / 2}px, ${from.top + from.height / 2 - target.top - target.height / 2}px) scale(${from.width / target.width}, ${from.height / target.height})`
    : "translateY(14px) scale(0.96)";
  return [
    { transform, opacity: 0, filter: "blur(3px)" },
    { transform: "translate(0, 0) scale(1)", opacity: 1, filter: "blur(0px)" },
  ];
}
