// ---------------------------------------------------------------------------
// Module IDs — each maps to a specific Prisma model + fields
// ---------------------------------------------------------------------------

export type BuilderModuleId =
  | "CRM_LEADS"
  | "CRM_CLIENTS"
  | "PROJECTS"
  | "TASKS"
  | "STAFF"
  | "ATTENDANCE"
  | "INVOICES"
  | "EXPENSES"
  | "PRODUCTS"
  | "STOCK_MOVEMENTS";

// ---------------------------------------------------------------------------
// Field definitions
// ---------------------------------------------------------------------------

export type FieldType = "string" | "number" | "date" | "datetime" | "enum" | "decimal";

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  filterable: boolean;
  operators?: FilterOperator[];
  enumValues?: string[];
}

export interface ModuleDef {
  id: BuilderModuleId;
  label: string;
  category: string;
  description: string;
  fields: FieldDef[];
}

// ---------------------------------------------------------------------------
// Filter condition
// ---------------------------------------------------------------------------

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: string;
}

// ---------------------------------------------------------------------------
// Builder request / response
// ---------------------------------------------------------------------------

export interface BuilderRequest {
  module: BuilderModuleId;
  selectedFields: string[];
  filters: FilterCondition[];
  limit?: number;
}

export interface BuilderResult {
  module: BuilderModuleId;
  columns: { key: string; label: string; type: FieldType }[];
  data: Record<string, unknown>[];
  total: number;
  truncated: boolean;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Saved report shapes (DB-persisted)
// ---------------------------------------------------------------------------

export interface SavedReportConfig {
  module: BuilderModuleId;
  selectedFields: string[];
  filters: FilterCondition[];
}

export interface SavedReportRecord {
  id: string;
  name: string;
  module: BuilderModuleId;
  selectedFields: string[];
  filters: FilterCondition[];
  createdAt: string;
  updatedAt: string;
  executionCount: number;
  lastRun: string | null;
}

export interface SaveReportInput {
  name: string;
  module: BuilderModuleId;
  selectedFields: string[];
  filters: FilterCondition[];
}
