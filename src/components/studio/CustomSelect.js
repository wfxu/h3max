"use client";

import { useState } from "react";

export default function CustomSelect({ value, onChange, options, placeholder = "Select option", className = "", disabled = false }) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((opt) => opt.value === value) || { label: placeholder, value };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full bg-bg-page border border-divider/60 rounded py-2.5 px-3 text-xs outline-none focus:border-primary/60 transition-all font-semibold text-primary-text flex items-center justify-between cursor-pointer select-none active:scale-[0.99] min-h-[38px] disabled:opacity-50"
      >
        <span className="truncate">{selectedOption.label}</span>
        <span className={`text-[8px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 bg-bg-card border border-divider rounded shadow-2xl z-[150] py-1 max-h-56 overflow-y-auto scrollbar-subtle animate-scale-up">
            {options.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer ${
                  value === opt.value ? "text-primary font-bold bg-primary/5" : "text-primary-text"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
