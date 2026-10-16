import { createContext, useCallback, useState } from "react";
import "../components/Toasts.css";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (toast) => {
      const id = Date.now() + Math.random();
      const t = { id, duration: 5000, type: "info", ...toast };
      setToasts((cur) => [t, ...cur]);
      if (t.duration > 0) setTimeout(() => remove(id), t.duration);
      return id;
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ add, remove }}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.type || "info"}`}
            onClick={() => remove(t.id)}
          >
            {t.title && <strong className="toast-title">{t.title}</strong>}
            {t.message && <div className="toast-message">{t.message}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export { ToastContext };
