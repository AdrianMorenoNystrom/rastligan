import { useEffect, useRef, useId } from "react";
import type { ReactNode } from "react";
import { X, Inbox, AlertCircle, RotateCw, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useBreaks } from "./providers";
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="modal"
      aria-labelledby={headingId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={headingId}>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Stäng">
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
