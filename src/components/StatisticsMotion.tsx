import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { format } from "../lib/domain";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia(query).matches;

/** Start once when the data enters the viewport, including below the fold. */
export function useStatisticsBuild<T extends HTMLElement>(enabled = true) {
  const reduced = useSyncExternalStore(subscribe, snapshot, () => true);
  const ref = useRef<T>(null);
  const [entered, setEntered] = useState(false);
  const supported = typeof IntersectionObserver !== "undefined";
  useEffect(() => {
    if (!enabled || reduced || !supported || entered) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -24px 0px", threshold: 0.05 },
    );
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, [enabled, reduced, supported, entered]);
  return {
    ref,
    ready: !enabled || reduced || !supported || entered,
    motion: enabled && !reduced,
  };
}

/** Only the decorative copy counts up; assistive technology gets the real value. */
export function StatisticsNumber({
  value,
  ready,
  motion,
  digits = 0,
  suffix = "",
  delay = 0,
}: {
  value: number | null;
  ready: boolean;
  motion: boolean;
  digits?: number;
  suffix?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const displayed = useRef(0);
  const completed = useRef(false);
  const label = format(value, digits) + (value === null ? "" : suffix);
  useLayoutEffect(() => {
    const element = ref.current!;
    if (value === null || !motion) {
      element.textContent = label;
      displayed.current = value ?? 0;
      return;
    }
    if (!ready) {
      element.textContent = format(0, digits) + suffix;
      displayed.current = 0;
      return;
    }
    const from = displayed.current;
    const duration = completed.current ? 380 : 880;
    const start = performance.now() + (completed.current ? 0 : delay);
    const formatter = new Intl.NumberFormat("sv-SE", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - (1 - progress) ** 3;
      displayed.current = from + (value - from) * eased;
      element.textContent = formatter.format(displayed.current) + suffix;
      if (progress < 1) frame = requestAnimationFrame(tick);
      else {
        element.textContent = label;
        completed.current = true;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, ready, motion, digits, suffix, label, delay]);
  return (
    <span className="stats-count" data-display={label}>
      <span className="sr-only">{label}</span>
      <span className="stats-count-visual" aria-hidden="true" ref={ref}>
        {label}
      </span>
    </span>
  );
}
