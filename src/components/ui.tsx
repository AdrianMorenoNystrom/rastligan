import { useLayoutEffect, useRef, useId } from "react";
import type { ReactNode } from "react";
import { X, Inbox, AlertCircle, RotateCw, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useBreaks } from "./providers";
import { dialogFrames, easeOut, reducedMotion } from "../lib/motion";
export function Modal({
  title,
  onClose,
  children,
  origin,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  origin?: HTMLElement | null;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const animation = useRef<Animation | null>(null);
  const closing = useRef(false);
  useLayoutEffect(() => {
    const d = ref.current!;
    d.showModal();
    if (!reducedMotion() && typeof d.animate === "function") {
      animation.current = d.animate(dialogFrames(d, origin), {
        duration: origin ? 460 : 280,
        easing: easeOut,
      });
    }
    return () => {
      animation.current?.cancel();
      d.close();
      if (origin?.isConnected) origin.focus({ preventScroll: true });
    };
  }, [origin]);
  async function requestClose() {
    const d = ref.current;
    if (!d || closing.current) return;
    closing.current = true;
    const current = getComputedStyle(d);
    const start = {
      transform: current.transform,
      opacity: current.opacity,
      filter: current.filter,
    };
    animation.current?.cancel();
    d.dataset.closing = "true";
    if (!reducedMotion() && typeof d.animate === "function") {
      const frames = [start, dialogFrames(d, origin)[0]];
      animation.current = d.animate(frames, {
        duration: origin ? 280 : 180,
        easing: "cubic-bezier(0.4, 0, 0.6, 1)",
        fill: "forwards",
      });
      await animation.current.finished.catch(() => undefined);
    }
    if (!d.isConnected) return;
    onClose();
    animation.current?.cancel();
    delete d.dataset.closing;
    closing.current = false;
  }
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        void requestClose();
      }}
      className={`modal ${className}`}
      aria-labelledby={headingId}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const box = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          void requestClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={headingId}>{title}</h2>
        <button
          className="icon-button"
          onClick={() => void requestClose()}
          aria-label="Stäng"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Empty({
  title = "Inga raster registrerade",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={28} strokeWidth={1.4} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function PageHeading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function SectionHeading({
  title,
  to,
  link,
}: {
  title: string;
  to?: string;
  link?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {to && (
        <Link to={to} className="text-link">
          {link}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function DataBoundary({ children }: { children: ReactNode }) {
  const q = useBreaks();
  if (q.isPending)
    return (
      <div className="loading" role="status">
        <RotateCw className="spin" size={24} />
        <p>Hämtar ligan…</p>
      </div>
    );
  if (q.isError && !q.data)
    return (
      <section className="card connection-error">
        <AlertCircle size={30} />
        <h1>Ligan kunde inte hämtas</h1>
        <p>{q.error.message}</p>
        <button onClick={() => void q.refetch()} className="button secondary">
          <RotateCw size={17} />
          Försök igen
        </button>
      </section>
    );
  return (
    <>
      {q.isError && (
        <p className="notice error" role="alert">
          Kunde inte uppdatera. Tidigare hämtade raster visas.{" "}
          <button onClick={() => void q.refetch()}>Försök igen</button>
        </p>
      )}
      {children}
    </>
  );
}
export function Metrics({
  items,
}: {
  items: { label: string; value: ReactNode; hint?: string }[];
}) {
  return (
    <div className="metrics">
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint && <small>{item.hint}</small>}
        </div>
      ))}
    </div>
  );
}
export function ErrorText({ children }: { children: ReactNode }) {
  return children ? (
    <p className="notice error" role="alert">
      {children}
    </p>
  ) : null;
}
