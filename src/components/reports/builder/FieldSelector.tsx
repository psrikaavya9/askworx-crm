"use client";

import type { FieldDef } from "@/modules/reports/types/builder";

interface Props {
  fields: FieldDef[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function FieldSelector({ fields, selected, onChange }: Props) {
  const allSelected = selected.length === fields.length;

  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(fields.map((f) => f.key));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">
          {selected.length} of {fields.length} fields selected
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {fields.map((field) => {
          const checked = selected.includes(field.key);
          return (
            <label
              key={field.key}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                checked
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(field.key)}
                className="accent-blue-600"
              />
              <span className="text-sm font-medium truncate">{field.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
