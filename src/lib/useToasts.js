import { useContext } from "react";
import { ToastContext } from "./toast";

export function useToasts() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToasts must be used within ToastProvider");
  return context;
}
