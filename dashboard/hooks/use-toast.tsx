"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 5000;

type ToastVariant = "default" | "success" | "warning" | "error" | "info";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

type Action =
  | { type: "ADD_TOAST"; toast: Omit<Toast, "id"> }
  | { type: "DISMISS_TOAST"; toastId: string }
  | { type: "REMOVE_TOAST"; toastId: string };

interface State {
  toasts: Toast[];
}

const toastListeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = toastReducer(memoryState, action);
  toastListeners.forEach((listener) => {
    listener(memoryState);
  });
}

function toast({
  title,
  description,
  variant = "default",
  duration = 5000,
}: Omit<Toast, "id">) {
  const id = crypto.randomUUID().slice(0, 8);
  const newToast = { id, title, description, variant, duration };

  dispatch({ type: "ADD_TOAST", toast: newToast });

  setTimeout(() => {
    dispatch({ type: "REMOVE_TOAST", toastId: id });
  }, duration);

  return id;
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    toastListeners.push(setState);
    return () => {
      const index = toastListeners.indexOf(setState);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  };
}

function toastReducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [{ ...action.toast, id: crypto.randomUUID().slice(0, 8) }, ...state.toasts].slice(TOAST_LIMIT),
      };
    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toastId ? { ...t } : t
        ),
      };
    case "REMOVE_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };
  }
}

const variantStyles: Record<ToastVariant, { border: string; icon: React.ReactNode }> = {
  default: {
    border: "border-l-[3px] border-[hsl(var(--neutral-200))]",
    icon: null,
  },
  success: {
    border: "border-l-[3px] border-l-[hsl(var(--success))]",
    icon: <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />,
  },
  warning: {
    border: "border-l-[3px] border-l-[hsl(var(--warning))]",
    icon: <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />,
  },
  error: {
    border: "border-l-[3px] border-l-[hsl(var(--error))]",
    icon: <XCircle className="h-4 w-4 text-[hsl(var(--error))]" />,
  },
  info: {
    border: "border-l-[3px] border-l-[hsl(var(--info))]",
    icon: <Info className="h-4 w-4 text-[hsl(var(--info))]" />,
  },
};

function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 sm:max-w-[420px]">
      <AnimatePresence mode="popLayout" >
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className={cn(
              "pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 shadow-lg",
              variantStyles[t.variant || "default"].border
            )}
          >
            {variantStyles[t.variant || "default"].icon && (
              <span className="mt-0.5 flex-shrink-0">
                {variantStyles[t.variant || "default"].icon}
              </span>
            )}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              {t.title && (
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                  {t.title}
                </p>
              )}
              {t.description && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {t.description}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 rounded-md p-1 text-[hsl(var(--muted-foreground))] opacity-70 transition-opacity duration-150 ease-out hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export { useToast, toast, Toaster };