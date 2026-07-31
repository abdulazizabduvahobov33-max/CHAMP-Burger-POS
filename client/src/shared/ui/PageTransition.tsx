import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="h-full animate-fade-in">
      {children}
    </div>
  );
}
