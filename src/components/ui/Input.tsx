import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function Input({ label, error, icon, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          {...props}
          className={cn(
            "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
            "placeholder:text-gray-400",
            "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
            "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
            "transition-colors",
            icon && "pl-9",
            error && "border-red-400 focus:border-red-500 focus:ring-red-500/30",
            className
          )}
        />
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <textarea
        id={inputId}
        rows={3}
        {...props}
        className={cn(
          "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
          "placeholder:text-gray-400 resize-none",
          "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
          "disabled:bg-gray-50 transition-colors",
          error && "border-red-400",
          className
        )}
      />
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder, className, id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <select
        id={inputId}
        {...props}
        className={cn(
          "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
          "focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
          "disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors",
          error && "border-red-400",
          className
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
