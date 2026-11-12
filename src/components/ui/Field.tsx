import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ id, label, hint, error, children }: FieldProps) {
  const messageId = `${id}-${error ? "error" : "hint"}`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p className="field__error" id={messageId} role="alert">{error}</p> : null}
      {!error && hint ? <p className="field__hint" id={messageId}>{hint}</p> : null}
    </div>
  );
}

function controlClass(className = "") {
  return ["form-control", className].filter(Boolean).join(" ");
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input {...props} ref={ref} className={controlClass(className)} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select {...props} ref={ref} className={controlClass(className)} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea {...props} ref={ref} className={controlClass(className)} />;
  },
);
