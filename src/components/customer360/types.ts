// ---------------------------------------------------------------------------
// Customer 360 — serialised data types
//
// All dates are ISO strings (post-serializePrisma), Decimals are numbers.
// These types represent what the server component passes to the client tree.
// ---------------------------------------------------------------------------

export interface C360Client {
  id:         string;
  firstName:  string;
  lastName:   string;
  email:      string;
  phone:      string | null;
  company:    string;
  jobTitle:   string | null;
  website:    string | null;
  address:    string | null;
  city:       string | null;
  state:      string | null;
  country:    string | null;
  postalCode: string | null;
  assignedTo: string | null;
  notes:      string | null;
  tags:       string[];
  createdAt:  string;
  updatedAt:  string;
  leads: Array<{
    id:         string;
    source:     string;
    stage:      string;
    dealValue:  number | null;
    createdAt:  string;
  }>;
}

export interface C360Interaction {
  id:          string;
  type:        "CALL" | "VISIT" | "NOTE";
  date:        string;
  duration:    number | null;
  outcome:     string | null;
  notes:       string | null;
  gpsLat:      number | null;
  gpsLng:      number | null;
  photos:      unknown;
  nextFollowUp: string | null;
  approved:    boolean;
  rejected:    boolean;
  ownerNote:   string | null;
  createdAt:   string;
  staff: {
    firstName:  string;
    lastName:   string;
    department: string | null;
  } | null;
}

export interface C360Project {
  id:          string;
  name:        string;
  description: string | null;
  status:      "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  startDate:   string | null;
  deadline:    string | null;
  createdAt:   string;
  _count: { tasks: number };
}

export interface C360Invoice {
  id:            string;
  invoiceNumber: string;
  status:        "DRAFT" | "SENT" | "PAID" | "OVERDUE";
  issueDate:     string;
  dueDate:       string;
  totalAmount:   number;
  createdAt:     string;
  payments: Array<{ amount: number }>;
}

export interface C360Complaint {
  id:          string;
  description: string;
  priority:    "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status:      "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  resolvedAt:  string | null;
  createdAt:   string;
  raisedBy:    string | null;
  assignedTo:  string | null;
  resolution:  string | null;
}

export interface C360HealthScore {
  id:              string;
  score:           number;
  paymentScore:    number;
  engagementScore: number;
  interactionScore: number;
  complaintScore:  number;
  revenueScore:    number;
  calculatedAt:    string;
}
