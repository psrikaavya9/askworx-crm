// ---------------------------------------------------------------------------
// Customer 360 — Timeline event types
// ---------------------------------------------------------------------------

/**
 * Every timeline event category. The frontend maps these to Lucide icon names
 * and colour schemes — keeping icon selection out of the service layer.
 */
export type TimelineEventType =
  // CustomerInteraction
  | "CALL"
  | "VISIT"
  | "NOTE"
  | "EMAIL"
  | "WHATSAPP"
  // Projects
  | "PROJECT_CREATED"
  | "PROJECT_COMPLETED"
  | "PROJECT_ON_HOLD"
  // Invoices
  | "INVOICE_ISSUED"
  | "INVOICE_PAID"
  | "INVOICE_OVERDUE"
  // Payments
  | "PAYMENT_RECEIVED"
  // Complaints
  | "COMPLAINT_RAISED"
  | "COMPLAINT_RESOLVED";

/**
 * Opaque metadata bag — each event type carries its own relevant fields.
 * The frontend narrows the type based on `type` before accessing metadata.
 */
export type TimelineMetadata =
  | InteractionMeta
  | ProjectMeta
  | InvoiceMeta
  | PaymentMeta
  | ComplaintMeta;

export interface InteractionMeta {
  kind:              "interaction";
  interactionId:     string;
  staffName:         string;
  duration:          number | null;   // minutes
  outcome:           string | null;
  approved:          boolean;
  rejected:          boolean;
  gpsLat:            number | null;
  gpsLng:            number | null;
  photoCount:        number;
  nextFollowUp:      Date | null;
  // EMAIL / WHATSAPP fields (null for CALL / VISIT / NOTE)
  messagePreview:    string | null;   // first ~300 chars of body
  messageSubject:    string | null;   // email subject
  direction:         "INBOUND" | "OUTBOUND" | null;
  counterpartyEmail: string | null;
  counterpartyPhone: string | null;
  externalId:        string | null;   // Twilio SID / email Message-ID
}

export interface ProjectMeta {
  kind:        "project";
  projectId:   string;
  projectName: string;
  status:      string;
  taskCount:   number;
  deadline:    Date | null;
}

export interface InvoiceMeta {
  kind:          "invoice";
  invoiceId:     string;
  invoiceNumber: string;
  totalAmount:   number;           // serialised Decimal → number
  status:        string;
  dueDate:       Date;
}

export interface PaymentMeta {
  kind:            "payment";
  paymentId:       string;
  invoiceId:       string;
  invoiceNumber:   string;
  amount:          number;         // serialised Decimal → number
  paymentMethod:   string;
  referenceNumber: string | null;
}

export interface ComplaintMeta {
  kind:        "complaint";
  complaintId: string;
  priority:    string;
  status:      string;
  assignedTo:  string | null;
  resolution:  string | null;
}

// ---------------------------------------------------------------------------
// Canonical event shape returned by getCustomerTimeline()
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  /** Unique key safe to use as React key — deterministic per event. */
  id:          string;
  type:        TimelineEventType;
  /** Human-readable event title, e.g. "Call logged", "Invoice #INV-0042 issued" */
  title:       string;
  /** ISO-8601 string — already serialised so the service is usable by both
   *  server components and JSON API routes without extra transformation. */
  date:        string;
  /** Lucide icon name — the frontend imports the matching icon by name. */
  icon:        string;
  /** Short sentence describing what happened. */
  description: string;
  metadata:    TimelineMetadata;
}
