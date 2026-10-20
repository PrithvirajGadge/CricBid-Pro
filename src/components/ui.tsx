import { Component, type ButtonHTMLAttributes, type ErrorInfo, type ReactNode } from "react";

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = { primary: "bg-gold text-black hover:brightness-110", ghost: "border border-slate-600 hover:bg-slate-800", danger: "bg-red-600 hover:bg-red-500" }[variant];
  return <button {...p} className={`min-h-11 rounded-lg px-4 py-2 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`} />;
}

export function Field({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-300">{label}</span>
      <input {...p} className="min-h-11 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-gold" />
    </label>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return <p role="alert" className="rounded-lg border border-red-500 bg-red-950 px-3 py-2 text-sm text-red-100">{children}</p>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <p role="status" className="p-6 text-center text-slate-300 motion-safe:animate-pulse">{label}</p>;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error, info: ErrorInfo) { console.error("UI error:", err.message, info.componentStack); }
  render() {
    return this.state.err ? <div className="p-6"><Alert>Something broke: {this.state.err.message}. Reload the page.</Alert></div> : this.props.children;
  }
}
