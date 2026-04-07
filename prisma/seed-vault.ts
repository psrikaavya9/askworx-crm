/**
 * seed-vault.ts
 *
 * Idempotent seed script for the HR Vault module:
 *   1. 20 company documents (all categories, varied expiry/access)
 *   2. 15 personal documents (employeeId set → "My Documents")
 *   3. DocAcknowledgements for mandatory docs
 *   4. 10 training videos (status = READY)
 *   5. 12 compliance items (GST, Audit, Licences, POSH, etc.)
 *
 * Run: npx tsx prisma/seed-vault.ts
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { randomUUID } from "crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)({ adapter }) as PrismaClient;

// ─── helpers ───────────────────────────────────────────────────────────────

const daysAgo   = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── DOCUMENT DEFINITIONS ──────────────────────────────────────────────────

const COMPANY_DOCS = [
  // POLICY
  {
    title: "Employee Code of Conduct",
    category: "POLICY" as const,
    accessLevel: "ALL" as const,
    requiresAck: true,
    expiresAt: daysAhead(180),
    warningLevel: "none",
    tags: ["policy","conduct","mandatory"],
    description: "All employees must read and acknowledge the code of conduct before joining.",
    fileType: "application/pdf",
    fileSize: 245760,
  },
  {
    title: "Work From Home Policy 2026",
    category: "POLICY" as const,
    accessLevel: "ALL" as const,
    requiresAck: true,
    expiresAt: daysAhead(365),
    warningLevel: "none",
    tags: ["policy","wfh","remote"],
    description: "Updated WFH policy covering eligibility, expectations, and equipment.",
    fileType: "application/pdf",
    fileSize: 184320,
  },
  {
    title: "Data Privacy & Security Policy",
    category: "POLICY" as const,
    accessLevel: "ALL" as const,
    requiresAck: true,
    expiresAt: daysAhead(5),
    warningLevel: "high",
    tags: ["security","gdpr","mandatory"],
    description: "GDPR-aligned data privacy policy for all staff handling customer data.",
    fileType: "application/pdf",
    fileSize: 327680,
  },
  {
    title: "Travel & Expense Policy",
    category: "POLICY" as const,
    accessLevel: "ALL" as const,
    requiresAck: false,
    expiresAt: daysAhead(90),
    warningLevel: "low",
    tags: ["expense","travel","reimbursement"],
    description: "Reimbursement limits, approval workflow, and submission timelines.",
    fileType: "application/pdf",
    fileSize: 196608,
  },
  // CONTRACT
  {
    title: "Standard Employment Agreement Template",
    category: "CONTRACT" as const,
    accessLevel: "HR_ONLY" as const,
    requiresAck: false,
    expiresAt: null,
    warningLevel: "none",
    tags: ["contract","template","hr"],
    description: "Master employment contract template used for all new hires.",
    fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    fileSize: 102400,
  },
  {
    title: "Non-Disclosure Agreement (NDA)",
    category: "CONTRACT" as const,
    accessLevel: "ALL" as const,
    requiresAck: true,
    expiresAt: null,
    warningLevel: "none",
    tags: ["nda","confidentiality","legal"],
    description: "Mutual NDA to be signed by all staff and contractors.",
    fileType: "application/pdf",
    fileSize: 81920,
  },
  {
    title: "Vendor Service Agreement — IT",
    category: "CONTRACT" as const,
    accessLevel: "MANAGER_ONLY" as const,
    requiresAck: false,
    expiresAt: daysAhead(25),
    warningLevel: "medium",
    tags: ["vendor","it","contract"],
    description: "Annual IT support services contract with SLA terms.",
    fileType: "application/pdf",
    fileSize: 163840,
  },
  // HANDBOOK
  {
    title: "Employee Handbook 2026",
    category: "HANDBOOK" as const,
    accessLevel: "ALL" as const,
    requiresAck: true,
    expiresAt: daysAhead(300),
    warningLevel: "none",
    tags: ["handbook","onboarding","mandatory"],
    description: "Complete guide to company culture, benefits, and HR processes.",
    fileType: "application/pdf",
    fileSize: 614400,
  },
  {
    title: "Manager's Handbook",
    category: "HANDBOOK" as const,
    accessLevel: "MANAGER_ONLY" as const,
    requiresAck: false,
    expiresAt: null,
    warningLevel: "none",
    tags: ["manager","leadership","handbook"],
    description: "Performance management, team building, and escalation procedures.",
    fileType: "application/pdf",
    fileSize: 409600,
  },
  // FORM
  {
    title: "Leave Application Form",
    category: "FORM" as const,
    accessLevel: "ALL" as const,
    requiresAck: false,
    expiresAt: null,
    warningLevel: "none",
    tags: ["leave","hr","form"],
    description: "Standard leave request form for all types of leave.",
    fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileSize: 40960,
  },
  {
    title: "Expense Claim Form",
    category: "FORM" as const,
    accessLevel: "ALL" as const,
    requiresAck: false,
    expiresAt: null,
    warningLevel: "none",
    tags: ["expense","finance","form"],
    description: "Submit expense reimbursement requests using this form.",
    fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileSize: 38912,
  },
  {
    title: "IT Asset Request Form",
    category: "FORM" as const,
    accessLevel: "ALL" as const,
    requiresAck: false,
    expiresAt: null,
    warningLevel: "none",
    tags: ["it","assets","form"],
    description: "Request laptops, peripherals, or software licenses.",
    fileType: "application/pdf",
    fileSize: 45056,
  },
  // SOP
  {
    title: "Customer Onboarding SOP",
    category: "SOP" as const,
    accessLevel: "ALL" as const,
    requiresAck: false,
    expiresAt: daysAhead(180),
    warningLevel: "none",
    tags: ["sop","crm","onboarding"],
    description: "Step-by-step process for onboarding a new client from WON to ACTIVE.",
    fileType: "application/pdf",
    fileSize: 204800,
  },
  {
    title: "Invoice & Payment Processing SOP",
    category: "SOP" as const,
    accessLevel: "ALL" as const,
    requiresAck: false,
    expiresAt: null,
    warningLevel: "none",
    tags: ["finance","invoicing","sop"],
    description: "End-to-end procedure for raising, sending, and reconciling invoices.",
    fileType: "application/pdf",
    fileSize: 163840,
  },
  {
    title: "Incident Escalation SOP",
    category: "SOP" as const,
    accessLevel: "ALL" as const,
    requiresAck: true,
    expiresAt: daysAhead(20),
    warningLevel: "medium",
    tags: ["sop","security","escalation"],
    description: "How to report and escalate security incidents or data breaches.",
    fileType: "application/pdf",
    fileSize: 122880,
  },
  // COMPLIANCE
  {
    title: "POSH Policy 2026",
    category: "COMPLIANCE" as const,
    accessLevel: "ALL" as const,
    requiresAck: true,
    expiresAt: daysAhead(270),
    warningLevel: "none",
    tags: ["posh","hr","compliance","mandatory"],
    description: "Prevention of Sexual Harassment at Workplace policy and ICC details.",
    fileType: "application/pdf",
    fileSize: 286720,
  },
  {
    title: "GST Compliance Manual",
    category: "COMPLIANCE" as const,
    accessLevel: "MANAGER_ONLY" as const,
    requiresAck: false,
    expiresAt: daysAhead(60),
    warningLevel: "low",
    tags: ["gst","tax","compliance"],
    description: "GST registration, filing schedule, and input tax credit guidelines.",
    fileType: "application/pdf",
    fileSize: 245760,
  },
  {
    title: "ISO 27001 Information Security Manual",
    category: "COMPLIANCE" as const,
    accessLevel: "MANAGER_ONLY" as const,
    requiresAck: false,
    expiresAt: daysAhead(3),
    warningLevel: "high",
    tags: ["iso","security","compliance"],
    description: "Internal ISMS documentation for ISO 27001 certification maintenance.",
    fileType: "application/pdf",
    fileSize: 573440,
  },
  // OTHER
  {
    title: "Office Floor Plan & Emergency Exits",
    category: "OTHER" as const,
    accessLevel: "ALL" as const,
    requiresAck: false,
    expiresAt: null,
    warningLevel: "none",
    tags: ["safety","office","emergency"],
    description: "Floor plan with fire exit routes and emergency assembly point locations.",
    fileType: "image/png",
    fileSize: 819200,
  },
  {
    title: "Annual CSR Report 2025",
    category: "OTHER" as const,
    accessLevel: "ALL" as const,
    requiresAck: false,
    expiresAt: null,
    warningLevel: "none",
    tags: ["csr","report","2025"],
    description: "Corporate Social Responsibility initiatives and impact summary for FY25.",
    fileType: "application/pdf",
    fileSize: 1048576,
  },
];

// ─── PERSONAL DOC TEMPLATES (employeeId will be set per staff) ─────────────

const PERSONAL_DOC_TEMPLATES = [
  {
    title: "Offer Letter",
    category: "CONTRACT" as const,
    accessLevel: "HR_ONLY" as const,
    requiresAck: true,
    fileType: "application/pdf",
    fileSize: 65536,
    tags: ["offer","employment"],
  },
  {
    title: "PAN Card Copy",
    category: "FORM" as const,
    accessLevel: "HR_ONLY" as const,
    requiresAck: false,
    fileType: "image/jpeg",
    fileSize: 204800,
    tags: ["kyc","tax","personal"],
  },
  {
    title: "Appointment Letter",
    category: "CONTRACT" as const,
    accessLevel: "HR_ONLY" as const,
    requiresAck: true,
    fileType: "application/pdf",
    fileSize: 73728,
    tags: ["appointment","hr"],
  },
  {
    title: "Experience Certificate",
    category: "OTHER" as const,
    accessLevel: "HR_ONLY" as const,
    requiresAck: false,
    fileType: "application/pdf",
    fileSize: 57344,
    tags: ["certificate","experience"],
  },
  {
    title: "Annual Performance Review",
    category: "FORM" as const,
    accessLevel: "HR_ONLY" as const,
    requiresAck: true,
    fileType: "application/pdf",
    fileSize: 122880,
    tags: ["review","performance","hr"],
  },
  {
    title: "Aadhaar Card Copy",
    category: "FORM" as const,
    accessLevel: "HR_ONLY" as const,
    requiresAck: false,
    fileType: "image/jpeg",
    fileSize: 307200,
    tags: ["kyc","identity","personal"],
  },
];

// ─── VIDEO DEFINITIONS ─────────────────────────────────────────────────────

const TRAINING_VIDEOS = [
  {
    title: "CRM Basics: Managing Your Leads",
    description: "Learn how to add leads, track stages, set reminders, and move deals through the pipeline.",
    category: "TRAINING" as const,
    duration: 900,
    isRequired: true,
    tags: ["crm","leads","pipeline"],
  },
  {
    title: "New Employee Orientation",
    description: "Welcome to ASKworX! Company values, team structure, tools, and first-week checklist.",
    category: "ONBOARDING" as const,
    duration: 1800,
    isRequired: true,
    tags: ["onboarding","orientation","new-hire"],
  },
  {
    title: "Data Security Awareness Training",
    description: "Phishing, password hygiene, device security, and how to report incidents.",
    category: "SAFETY" as const,
    duration: 1200,
    isRequired: true,
    tags: ["security","phishing","mandatory"],
  },
  {
    title: "POSH Act — Awareness & Compliance",
    description: "Understanding the Prevention of Sexual Harassment Act, ICC procedures, and reporting.",
    category: "COMPLIANCE" as const,
    duration: 1500,
    isRequired: true,
    tags: ["posh","compliance","mandatory"],
  },
  {
    title: "Using the Finance & Invoice Module",
    description: "Create invoices, log payments, track expenses, and interpret finance KPIs.",
    category: "TRAINING" as const,
    duration: 720,
    isRequired: false,
    tags: ["finance","invoices","training"],
  },
  {
    title: "Field Visit & Attendance Guide",
    description: "How to log field visits, GPS check-in, expense submission from the field.",
    category: "TRAINING" as const,
    duration: 840,
    isRequired: false,
    tags: ["attendance","field-visit","mobile"],
  },
  {
    title: "Fire Safety & Emergency Procedures",
    description: "Fire extinguisher usage, evacuation routes, assembly points, and escalation contacts.",
    category: "SAFETY" as const,
    duration: 600,
    isRequired: true,
    tags: ["fire","safety","emergency"],
  },
  {
    title: "GST Basics for Finance Team",
    description: "GST registration, CGST/SGST/IGST breakdown, invoice compliance, and filing deadlines.",
    category: "COMPLIANCE" as const,
    duration: 1080,
    isRequired: false,
    tags: ["gst","tax","finance"],
  },
  {
    title: "Project Management Best Practices",
    description: "Managing tasks, setting milestones, tracking hours, and delivering projects on time.",
    category: "TRAINING" as const,
    duration: 960,
    isRequired: false,
    tags: ["projects","tasks","management"],
  },
  {
    title: "Customer 360 & Health Score Guide",
    description: "Understanding the customer timeline, logging interactions, and interpreting health scores.",
    category: "GENERAL" as const,
    duration: 780,
    isRequired: false,
    tags: ["customer360","crm","health-score"],
  },
];

// ─── COMPLIANCE ITEMS ──────────────────────────────────────────────────────

const COMPLIANCE_ITEMS = [
  { title: "GST Monthly Return (GSTR-1)",       type: "STATUTORY" as const, frequency: "MONTHLY" as const,    nextDueDate: daysAhead(8),   status: "UPCOMING" as const,   notes: "File GSTR-1 by 11th of every month." },
  { title: "GST Monthly Return (GSTR-3B)",      type: "STATUTORY" as const, frequency: "MONTHLY" as const,    nextDueDate: daysAhead(15),  status: "UPCOMING" as const,   notes: "File GSTR-3B by 20th of every month." },
  { title: "TDS Return — Q4",                   type: "STATUTORY" as const, frequency: "QUARTERLY" as const,  nextDueDate: daysAhead(3),   status: "UPCOMING" as const,   notes: "Form 24Q/26Q due by 31st of month after quarter end." },
  { title: "Professional Tax Payment",          type: "STATUTORY" as const, frequency: "MONTHLY" as const,    nextDueDate: daysAgo(5),     status: "OVERDUE" as const,    notes: "Payable on or before the last day of the month." },
  { title: "Provident Fund (PF) Remittance",   type: "STATUTORY" as const, frequency: "MONTHLY" as const,    nextDueDate: daysAgo(3),     status: "OVERDUE" as const,    notes: "PF due by 15th of following month." },
  { title: "ESI Contribution",                  type: "STATUTORY" as const, frequency: "MONTHLY" as const,    nextDueDate: daysAhead(12),  status: "UPCOMING" as const,   notes: "ESIC contribution due by 15th of following month." },
  { title: "Annual ROC Filing",                 type: "STATUTORY" as const, frequency: "YEARLY" as const,     nextDueDate: daysAhead(60),  status: "PENDING" as const,    notes: "Annual return and financial statements due to MCA." },
  { title: "Statutory Audit — FY2025-26",       type: "STATUTORY" as const, frequency: "YEARLY" as const,     nextDueDate: daysAhead(90),  status: "PENDING" as const,    notes: "Independent CA audit before tax filing." },
  { title: "ISO 27001 Internal Audit",          type: "INTERNAL" as const,  frequency: "YEARLY" as const,     nextDueDate: daysAhead(30),  status: "UPCOMING" as const,   notes: "Scheduled internal audit before surveillance visit." },
  { title: "POSH Committee Meeting Q2",         type: "INTERNAL" as const,  frequency: "QUARTERLY" as const,  nextDueDate: daysAhead(22),  status: "PENDING" as const,    notes: "Quarterly ICC meeting with minutes to be filed." },
  { title: "Fire Safety Equipment Check",       type: "INTERNAL" as const,  frequency: "QUARTERLY" as const,  nextDueDate: daysAgo(8),     status: "OVERDUE" as const,    notes: "Fire extinguisher inspection and log update." },
  { title: "Employee Handbook Policy Review",   type: "INTERNAL" as const,  frequency: "YEARLY" as const,     nextDueDate: daysAhead(150), status: "PENDING" as const,    notes: "Annual review and update of all HR policies." },
  { title: "Data Privacy Impact Assessment",    type: "INTERNAL" as const,  frequency: "YEARLY" as const,     nextDueDate: daysAhead(45),  status: "PENDING" as const,    notes: "Annual DPIA per company data privacy policy." },
  { title: "Q1 Internal Financial Audit",       type: "INTERNAL" as const,  frequency: "QUARTERLY" as const,  nextDueDate: daysAgo(1),     status: "OVERDUE" as const,    notes: "Internal review of expense claims and approvals." },
];

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 seed-vault: starting...\n");

  // ── Get real staff IDs ────────────────────────────────────────────────────
  const allStaff = await prisma.staff.findMany({
    select: { id: true, role: true, firstName: true, lastName: true },
    orderBy: { createdAt: "asc" },
  });

  if (allStaff.length === 0) {
    console.error("❌ No staff found. Run the main seed first: npx tsx prisma/seed.ts");
    process.exit(1);
  }

  const adminStaff = allStaff.find((s) => s.role === "OWNER" || s.role === "ADMIN") ?? allStaff[0];
  console.log(`   Using "${adminStaff.firstName} ${adminStaff.lastName}" as uploader`);

  // ── STEP 1: Company Documents (20) ────────────────────────────────────────
  console.log("\n📄 Step 1: Seeding 20 company documents...");

  let docsCreated = 0;
  const docIdMap: Record<string, string> = {}; // title → id

  for (let i = 0; i < COMPANY_DOCS.length; i++) {
    const def = COMPANY_DOCS[i];

    const existing = await prisma.hrDocument.findFirst({
      where: { title: def.title, isDeleted: false },
      select: { id: true },
    });

    if (existing) {
      console.log(`   ⏭  "${def.title}" — already exists`);
      docIdMap[def.title] = existing.id;
      continue;
    }

    const id = randomUUID();
    const slug = def.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

    await prisma.hrDocument.create({
      data: {
        id,
        title:        def.title,
        description:  def.description,
        category:     def.category,
        fileUrl:      `https://storage.askworx.app/vault/docs/${slug}.${def.fileType.includes("pdf") ? "pdf" : def.fileType.includes("word") ? "docx" : def.fileType.includes("sheet") ? "xlsx" : def.fileType.includes("image") ? "jpg" : "pdf"}`,
        fileKey:      `vault/docs/${slug}-${id.slice(0, 8)}`,
        fileType:     def.fileType,
        fileSize:     def.fileSize,
        version:      1,
        isLatest:     true,
        accessLevel:  def.accessLevel,
        allowedRoles: [],
        allowedStaff: [],
        tags:         def.tags,
        metadata:     {},
        requiresAck:  def.requiresAck,
        expiresAt:    def.expiresAt ?? null,
        status:       "ACTIVE",
        warningLevel: def.warningLevel,
        uploadedBy:   adminStaff.id,
        isDeleted:    false,
        createdAt:    daysAgo(rand(5, 60)),
      },
    });

    docIdMap[def.title] = id;
    docsCreated++;
    console.log(`   ✅ "${def.title}" [${def.category}] ${def.expiresAt ? `expires ${def.warningLevel === "high" ? "⚠️ SOON" : "later"}` : "no expiry"}`);
  }
  console.log(`   → ${docsCreated} documents created`);

  // ── STEP 2: Personal Documents (2–3 per staff, up to 8 staff) ────────────
  console.log("\n👤 Step 2: Seeding personal documents for staff...");

  const staffToDoc = allStaff.slice(0, Math.min(8, allStaff.length));
  let personalDocsCreated = 0;

  for (const staff of staffToDoc) {
    const docsForThisStaff = rand(2, 3);
    const templates = PERSONAL_DOC_TEMPLATES.slice(0, docsForThisStaff);

    for (const tpl of templates) {
      const docTitle = `${tpl.title} — ${staff.firstName} ${staff.lastName}`;

      const existing = await prisma.hrDocument.findFirst({
        where: { title: docTitle, employeeId: staff.id, isDeleted: false },
        select: { id: true },
      });
      if (existing) continue;

      const id = randomUUID();
      const slug = tpl.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      await prisma.hrDocument.create({
        data: {
          id,
          title:        docTitle,
          description:  `Personal document for ${staff.firstName} ${staff.lastName}`,
          category:     tpl.category,
          fileUrl:      `https://storage.askworx.app/vault/personal/${staff.id}/${slug}.${tpl.fileType.includes("pdf") ? "pdf" : "jpg"}`,
          fileKey:      `vault/personal/${staff.id}/${slug}-${id.slice(0, 8)}`,
          fileType:     tpl.fileType,
          fileSize:     tpl.fileSize,
          version:      1,
          isLatest:     true,
          accessLevel:  tpl.accessLevel,
          allowedRoles: [],
          allowedStaff: [staff.id],
          tags:         tpl.tags,
          metadata:     {},
          requiresAck:  tpl.requiresAck,
          expiresAt:    null,
          status:       "ACTIVE",
          warningLevel: "none",
          employeeId:   staff.id,
          uploadedBy:   adminStaff.id,
          isDeleted:    false,
          createdAt:    daysAgo(rand(10, 90)),
        },
      });
      personalDocsCreated++;
    }
  }
  console.log(`   ✅ ${personalDocsCreated} personal documents created for ${staffToDoc.length} staff`);

  // ── STEP 3: DocAcknowledgements for mandatory docs ─────────────────────────
  console.log("\n✍️  Step 3: Adding acknowledgements for mandatory documents...");

  const mandatoryTitles = [
    "Employee Code of Conduct",
    "Employee Handbook 2026",
    "NDA",
    "POSH Policy 2026",
  ];

  // Find docs that require acknowledgement
  const ackableDocs = await prisma.hrDocument.findMany({
    where: { requiresAck: true, isDeleted: false, accessLevel: "ALL" },
    select: { id: true, title: true },
    take: 10,
  });

  let acksCreated = 0;
  const staffToAck = allStaff.slice(0, Math.min(6, allStaff.length));

  for (const doc of ackableDocs) {
    // 60–80% of staff will have acknowledged
    const ackers = staffToAck.filter(() => Math.random() < 0.7);
    for (const staff of ackers) {
      try {
        await prisma.docAcknowledgement.create({
          data: {
            id:             randomUUID(),
            documentId:     doc.id,
            staffId:        staff.id,
            acknowledgedAt: daysAgo(rand(1, 30)),
            ipAddress:      `192.168.${rand(1, 10)}.${rand(1, 254)}`,
            userAgent:      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            notes:          mandatoryTitles.some((t) => doc.title.startsWith(t))
              ? "Read and understood."
              : null,
          },
        });
        acksCreated++;
      } catch {
        // ignore duplicate constraint violations (idempotent)
      }
    }
  }
  console.log(`   ✅ ${acksCreated} acknowledgements created`);

  // ── STEP 4: Training Videos ────────────────────────────────────────────────
  console.log("\n🎬 Step 4: Seeding 10 training videos...");

  // YouTube public domain / sample video URLs
  const SAMPLE_VIDEO_URLS = [
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/9bZkp7q19f0",
    "https://www.youtube.com/embed/3tmd-ClpJxA",
    "https://www.youtube.com/embed/kJQP7kiw5Fk",
    "https://www.youtube.com/embed/JGwWNGJdvx8",
    "https://www.youtube.com/embed/JRfuAukYTKg",
    "https://www.youtube.com/embed/2Vv-BfVoq4g",
    "https://www.youtube.com/embed/nfWlot6h_JM",
    "https://www.youtube.com/embed/PT2_F-1esPk",
    "https://www.youtube.com/embed/YQHsXMglC9A",
  ];

  const THUMBNAILS = [
    "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    "https://img.youtube.com/vi/9bZkp7q19f0/hqdefault.jpg",
    "https://img.youtube.com/vi/3tmd-ClpJxA/hqdefault.jpg",
    "https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
    "https://img.youtube.com/vi/JGwWNGJdvx8/hqdefault.jpg",
    "https://img.youtube.com/vi/JRfuAukYTKg/hqdefault.jpg",
    "https://img.youtube.com/vi/2Vv-BfVoq4g/hqdefault.jpg",
    "https://img.youtube.com/vi/nfWlot6h_JM/hqdefault.jpg",
    "https://img.youtube.com/vi/PT2_F-1esPk/hqdefault.jpg",
    "https://img.youtube.com/vi/YQHsXMglC9A/hqdefault.jpg",
  ];

  let videosCreated = 0;

  for (let i = 0; i < TRAINING_VIDEOS.length; i++) {
    const def = TRAINING_VIDEOS[i];

    const existing = await prisma.hrVideo.findFirst({
      where: { title: def.title, isDeleted: false },
      select: { id: true },
    });
    if (existing) {
      console.log(`   ⏭  "${def.title}" — already exists`);
      continue;
    }

    const id   = randomUUID();
    const slug = def.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

    await prisma.hrVideo.create({
      data: {
        id,
        title:        def.title,
        description:  def.description,
        category:     def.category,
        originalUrl:  SAMPLE_VIDEO_URLS[i],
        processedUrl: SAMPLE_VIDEO_URLS[i],
        thumbnailUrl: THUMBNAILS[i],
        fileKey:      `vault/videos/${slug}-${id.slice(0, 8)}`,
        fileSize:     BigInt(rand(50_000_000, 500_000_000)),
        duration:     def.duration,
        status:       "READY",
        accessLevel:  def.isRequired ? "ALL" : pick(["ALL", "ALL", "MANAGER_ONLY"]),
        allowedRoles: [],
        allowedStaff: [],
        tags:         def.tags,
        metadata:     {},
        isRequired:   def.isRequired,
        expiresAt:    null,
        uploadedBy:   adminStaff.id,
        isDeleted:    false,
        createdAt:    daysAgo(rand(5, 120)),
      },
    });

    videosCreated++;
    console.log(`   ✅ "${def.title}" [${def.category}]${def.isRequired ? " ⭐ required" : ""}`);
  }
  console.log(`   → ${videosCreated} videos created`);

  // ── STEP 5: Add watch logs for some staff on required videos ──────────────
  console.log("\n📊 Step 5: Adding video watch logs...");

  const readyVideos = await prisma.hrVideo.findMany({
    where: { status: "READY", isDeleted: false },
    select: { id: true, duration: true, isRequired: true },
    take: 10,
  });

  let logsCreated = 0;
  const staffToWatch = allStaff.slice(0, Math.min(5, allStaff.length));

  for (const video of readyVideos) {
    const totalSeconds = video.duration ?? 600;
    for (const staff of staffToWatch) {
      const watched    = rand(Math.floor(totalSeconds * 0.1), totalSeconds);
      const pct        = Math.min(100, (watched / totalSeconds) * 100);
      const completed  = pct >= 95;
      try {
        await prisma.videoWatchLog.create({
          data: {
            id:             randomUUID(),
            videoId:        video.id,
            staffId:        staff.id,
            watchedSeconds: watched,
            totalSeconds:   totalSeconds,
            percentage:     Math.round(pct * 100) / 100,
            completed,
            lastPosition:   watched,
            sessionData:    {},
          },
        });
        logsCreated++;
      } catch {
        // ignore duplicates
      }
    }
  }
  console.log(`   ✅ ${logsCreated} watch logs added`);

  // ── STEP 6: Compliance Items ───────────────────────────────────────────────
  console.log("\n📋 Step 6: Seeding 14 compliance items...");

  let complianceCreated = 0;

  for (const def of COMPLIANCE_ITEMS) {
    const existing = await prisma.complianceItem.findFirst({
      where: { title: def.title },
      select: { id: true },
    });
    if (existing) {
      console.log(`   ⏭  "${def.title}" — already exists`);
      continue;
    }

    await prisma.complianceItem.create({
      data: {
        title:        def.title,
        type:         def.type,
        frequency:    def.frequency,
        nextDueDate:  def.nextDueDate,
        status:       def.status,
        notes:        def.notes,
        lastDoneDate: def.status === "COMPLETED" ? daysAgo(rand(5, 30)) : null,
      },
    });

    complianceCreated++;
    const icon = def.status === "OVERDUE" ? "🔴" : def.status === "UPCOMING" ? "🟡" : "🔵";
    console.log(`   ${icon} "${def.title}" [${def.status}]`);
  }
  console.log(`   → ${complianceCreated} compliance items created`);

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  const [totalDocs, totalVideos, totalCompliance, totalAcks] = await Promise.all([
    prisma.hrDocument.count({ where: { isDeleted: false } }),
    prisma.hrVideo.count({ where: { isDeleted: false } }),
    prisma.complianceItem.count(),
    prisma.docAcknowledgement.count({ where: { isDeleted: false } }),
  ]);

  console.log("\n─────────────────────────────────────");
  console.log("📊 Database totals:");
  console.log(`   HR Documents     : ${totalDocs}`);
  console.log(`   Training Videos  : ${totalVideos}`);
  console.log(`   Compliance Items : ${totalCompliance}`);
  console.log(`   Acknowledgements : ${totalAcks}`);
  console.log("\n🎉 seed-vault done!\n");
}

main()
  .catch((e) => {
    console.error("❌ seed-vault failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
