import { useEffect, useRef } from "react";
import type { LiquidGlass } from "@ybouane/liquidglass";

/** A decorative, isolated scene: application text and form fields stay in the DOM. */
export function GlassMaterial({ mobile = false }: { mobile?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLCanvasElement>(null);
  const lens = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = root.current!;
    const canvas = source.current!;
    const glass = lens.current!;
    const screen = matchMedia(
      mobile ? "(max-width: 640px)" : "(min-width: 641px)",
    );
    const reduced = matchMedia(
      "(prefers-reduced-motion: reduce), (prefers-reduced-transparency: reduce)",
    );
    let instance: LiquidGlass | undefined;
    let generation = 0;
    const paint = () => {
      const width = Math.max(1, scene.clientWidth);
      const height = Math.max(1, scene.clientHeight);
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(2, 2);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#192c22");
      gradient.addColorStop(0.46, "#202c27");
      gradient.addColorStop(1, "#1e2c35");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(204,229,215,0.075)";
      ctx.beginPath();
      ctx.ellipse(
        width * 0.5,
        -height * 1.5,
        width * 0.65,
        height * 2,
        -0.1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    };
    async function sync() {
      const run = ++generation;
      instance?.destroy();
      instance = undefined;
      delete scene.dataset.ready;
      if (!screen.matches || reduced.matches) return;
      try {
        const { LiquidGlass } = await import("@ybouane/liquidglass");
        if (generation !== run) return;
        paint();
        const next = await LiquidGlass.init({
          root: scene,
          glassElements: [glass],
          defaults: {
            cornerRadius: mobile ? 32 : 28,
            zRadius: 12,
            refraction: 0.18,
            blurAmount: 0.1,
            chromAberration: 0.015,
            edgeHighlight: 0.08,
            fresnel: 0.15,
            shadowOpacity: 0,
            floating: false,
          },
        });
        if (generation !== run) {
          next.destroy();
          return;
        }
        instance = next;
        scene.dataset.ready = "true";
      } catch {
        // The CSS material remains usable when WebGL is unavailable.
        delete scene.dataset.ready;
      }
    }
    const resize = new ResizeObserver(() => {
      paint();
      instance?.markChanged(canvas);
    });
    resize.observe(scene);
    void sync();
    screen.addEventListener("change", sync);
    reduced.addEventListener("change", sync);
    return () => {
      generation++;
      resize.disconnect();
      screen.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
      instance?.destroy();
    };
  }, [mobile]);

  return (
    <div className="glass-material" ref={root} aria-hidden="true">
      <canvas ref={source} className="glass-material-source" />
      <div className="glass-material-lens" ref={lens} />
    </div>
  );
}
