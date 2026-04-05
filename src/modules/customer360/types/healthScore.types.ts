// ---------------------------------------------------------------------------
// Customer Health Score — type definitions
// ---------------------------------------------------------------------------

export type HealthStatus = "Healthy" | "Stable" | "At Risk" | "Critical";

/**
 * Raw inputs collected in a single parallel DB fetch.
 * Pure scorer functions operate on this shape — no Prisma dependency inside.
 */
export interface HealthScoreInputs {
  // --- Invoices ---
  invoices: Array<{
    status:      string;   // InvoiceStatus
    totalAmount: number;   // serialised Decimal
  }>;

  // --- Payments ---
  payments: Array<{
    amount:      number;   // serialised Decimal
    paymentDate: Date;
  }>;

  // --- Interactions ---
  interactions: Array<{
    date:     Date;
    type:     string;      // InteractionType
    approved: boolean;
  }>;

  // --- Complaints ---
  complaints: Array<{
    status:   string;      // ComplaintStatus
    priority: string;      // ComplaintPriority
  }>;
}

/** Individual 0–100 scores before weighting. */
export interface ComponentScores {
  payment:     number;
  engagement:  number;
  interaction: number;
  complaint:   number;
  revenue:     number;
}

/** Final result returned by calculateHealthScore(). */
export interface HealthScoreResult {
  score:      number;
  status:     HealthStatus;
  components: ComponentScores;
}
