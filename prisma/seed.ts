import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)({ adapter }) as PrismaClient;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function indianFirstName() {
  const names = [
    "Aarav","Arjun","Rohan","Vikram","Karan","Rahul","Amit","Suresh","Priya",
    "Neha","Pooja","Ananya","Divya","Kavya","Meera","Shreya","Riya","Sanya",
    "Aditya","Nikhil","Siddharth","Varun","Gaurav","Rajesh","Sandeep","Deepak",
    "Manoj","Vijay","Sunita","Rekha","Geeta","Lakshmi","Padma","Usha","Shweta",
    "Tanvi","Ishaan","Pranav","Yash","Harsh","Akash","Vishal","Sachin","Ravi",
    "Sanjay","Ramesh","Sunil","Pankaj","Ankit","Manish"
  ];
  return faker.helpers.arrayElement(names);
}

function indianLastName() {
  const names = [
    "Sharma","Verma","Patel","Singh","Kumar","Gupta","Joshi","Mehta","Shah",
    "Agarwal","Yadav","Mishra","Tiwari","Pandey","Chauhan","Rajput","Nair",
    "Pillai","Menon","Iyer","Rao","Reddy","Naidu","Choudhury","Banerjee",
    "Chatterjee","Mukherjee","Das","Bose","Sen","Malhotra","Kapoor","Khanna",
    "Sethi","Arora","Bhatia","Chopra","Dhawan","Gill","Anand","Bhatt",
    "Dixit","Saxena","Srivastava","Tripathi","Dubey","Shukla","Awasthi","Bajpai"
  ];
  return faker.helpers.arrayElement(names);
}

function indianPhone() {
  const prefixes = ["98","97","96","95","94","93","92","91","90","89","88","87","86","85","84","83","82","81","80","79","78","77","76","75","74","73","70"];
  return `+91 ${faker.helpers.arrayElement(prefixes)}${faker.string.numeric(8)}`;
}

function indianCity() {
  return faker.helpers.arrayElement([
    "Mumbai","Delhi","Bangalore","Hyderabad","Chennai","Kolkata","Pune","Ahmedabad",
    "Jaipur","Surat","Lucknow","Kanpur","Nagpur","Indore","Thane","Bhopal",
    "Visakhapatnam","Pimpri","Patna","Vadodara","Coimbatore","Ludhiana","Agra",
    "Nashik","Faridabad","Meerut","Rajkot","Varanasi","Srinagar","Aurangabad"
  ]);
}

function indianState() {
  return faker.helpers.arrayElement([
    "Maharashtra","Delhi","Karnataka","Telangana","Tamil Nadu","West Bengal",
    "Gujarat","Rajasthan","Uttar Pradesh","Madhya Pradesh","Punjab","Haryana"
  ]);
}

function randomPastDate(daysAgo: number) {
  return faker.date.recent({ days: daysAgo });
}

function randomFutureDate(daysAhead: number) {
  return faker.date.soon({ days: daysAhead });
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Starting database seed...");

  // ─── 1. Staff ────────────────────────────────────────────────────────────

  const adminHash = await bcrypt.hash("admin123456", 12);

  const admin = await prisma.staff.upsert({
    where: { email: "admin@askworx.com" },
    update: {},
    create: {
      firstName: "Admin",
      lastName: "User",
      email: "admin@askworx.com",
      phone: "+91 9800000001",
      role: "ADMIN",
      department: "Management",
      status: "ACTIVE",
      passwordHash: adminHash,
    },
  });

  console.log(`✅ Admin upserted: ${admin.email}`);

  const managerData = [
    { firstName: "Rajesh", lastName: "Mehta", email: "rajesh.mehta@askworx.com", department: "Sales" },
    { firstName: "Priya", lastName: "Sharma", email: "priya.sharma@askworx.com", department: "Operations" },
  ];

  const managerHash = await bcrypt.hash("manager@123", 12);
  const managers: { id: string }[] = [];

  for (const m of managerData) {
    const mgr = await prisma.staff.upsert({
      where: { email: m.email },
      update: {},
      create: {
        ...m,
        phone: indianPhone(),
        role: "MANAGER",
        status: "ACTIVE",
        passwordHash: managerHash,
      },
    });
    managers.push({ id: mgr.id });
    console.log(`✅ Manager upserted: ${mgr.email}`);
  }

  const staffEmails = [
    "ankit.verma@askworx.com",
    "neha.patel@askworx.com",
    "suresh.yadav@askworx.com",
    "divya.nair@askworx.com",
    "karan.gupta@askworx.com",
  ];

  const staffHash = await bcrypt.hash("staff@123", 12);
  const staffMembers: { id: string }[] = [];

  const staffData = [
    { firstName: "Ankit", lastName: "Verma", email: staffEmails[0], department: "Sales" },
    { firstName: "Neha", lastName: "Patel", email: staffEmails[1], department: "Support" },
    { firstName: "Suresh", lastName: "Yadav", email: staffEmails[2], department: "Field" },
    { firstName: "Divya", lastName: "Nair", email: staffEmails[3], department: "Finance" },
    { firstName: "Karan", lastName: "Gupta", email: staffEmails[4], department: "Sales" },
  ];

  for (const s of staffData) {
    const st = await prisma.staff.upsert({
      where: { email: s.email },
      update: {},
      create: {
        ...s,
        phone: indianPhone(),
        role: "STAFF",
        status: "ACTIVE",
        passwordHash: staffHash,
      },
    });
    staffMembers.push({ id: st.id });
    console.log(`✅ Staff upserted: ${st.email}`);
  }

  const allStaff = [{ id: admin.id }, ...managers, ...staffMembers];

  // ─── 2. Clients (50) ─────────────────────────────────────────────────────

  console.log("🏢 Seeding 50 clients...");

  const companies = [
    "TechSphere Solutions","BlueSky Innovations","Greenfield Enterprises","Nexus Systems",
    "Pinnacle Technologies","Horizon Consulting","Apex Digital","Catalyst IT","Vertex Corp",
    "Orion Networks","Phoenix Dynamics","Stellar Software","Quantum Labs","Nimbus Cloud",
    "Vortex Analytics","Meridian Group","Zenith Global","Luminary Tech","Axiom Solutions",
    "Prism Infotech","Vega Systems","Comet Digital","Solaris Enterprises","Helix Software",
    "Fusion Dynamics","Orbit Consulting","Nova IT Solutions","Summit Technologies","Rapid Systems",
    "Matrix Infotech","Radiant Solutions","Eclipse Technologies","Cosmo Digital","Spectrum IT",
    "Velocity Corp","Ignite Solutions","Pulse Technologies","Synapse IT","Vertex Digital",
    "Catalyst Systems","Nimbus Technologies","Vortex Solutions","Pinnacle IT","BlueSky Systems",
    "TechStar Enterprises","DataBridge Solutions","CloudNine IT","SmartEdge Technologies",
    "InfoPulse Systems","ByteCraft Solutions"
  ];

  const clientIds: string[] = [];

  for (let i = 0; i < 50; i++) {
    const firstName = indianFirstName();
    const lastName = indianLastName();
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${faker.internet.domainName()}`;

    const client = await prisma.client.create({
      data: {
        firstName,
        lastName,
        email,
        phone: indianPhone(),
        company: companies[i] || faker.company.name(),
        jobTitle: faker.helpers.arrayElement(["CEO","CTO","Manager","Director","Founder","VP Sales","Head of IT","Operations Manager"]),
        city: indianCity(),
        state: indianState(),
        country: "India",
        address: `${faker.number.int({ min: 1, max: 999 })}, ${faker.helpers.arrayElement(["MG Road","Park Street","Brigade Road","Commercial Street","Linking Road","FC Road","SG Highway"])}`,
        postalCode: faker.string.numeric(6),
        assignedTo: allStaff[i % allStaff.length].id,
        tags: faker.helpers.arrayElements(["premium","enterprise","startup","referral","cold","warm","hot"], faker.number.int({ min: 1, max: 3 })),
        notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
        createdAt: randomPastDate(180),
      },
    });
    clientIds.push(client.id);
  }

  console.log(`✅ Created 50 clients`);

  // ─── 3. Leads (50) ───────────────────────────────────────────────────────

  console.log("🎯 Seeding 50 leads...");

  const stages = ["NEW","CONTACTED","QUALIFIED","PROPOSAL","WON","LOST"] as const;
  const sources = ["WEBSITE","REFERRAL","SOCIAL_MEDIA","EMAIL_CAMPAIGN","COLD_CALL","TRADE_SHOW","PARTNER","OTHER"] as const;
  const priorities = ["LOW","MEDIUM","HIGH"] as const;

  for (let i = 0; i < 50; i++) {
    const firstName = indianFirstName();
    const lastName = indianLastName();
    const stage = faker.helpers.arrayElement(stages);
    const createdAt = randomPastDate(120);

    await prisma.lead.create({
      data: {
        firstName,
        lastName,
        email: `lead.${firstName.toLowerCase()}${lastName.toLowerCase()}${i}@${faker.internet.domainName()}`,
        phone: indianPhone(),
        company: faker.helpers.arrayElement(companies),
        jobTitle: faker.helpers.arrayElement(["CEO","Procurement Head","IT Manager","Purchase Manager","Director"]),
        source: faker.helpers.arrayElement(sources),
        stage,
        priority: faker.helpers.arrayElement(priorities),
        dealValue: faker.number.int({ min: 10000, max: 500000 }),
        currency: "INR",
        assignedTo: allStaff[i % allStaff.length].id,
        industry: faker.helpers.arrayElement(["Technology","Healthcare","Finance","Retail","Manufacturing","Education","Real Estate","Logistics"]),
        companySize: faker.helpers.arrayElement(["SMALL","MEDIUM","LARGE","ENTERPRISE"]),
        clientId: clientIds[i] || null,
        isCold: stage === "LOST" || faker.datatype.boolean({ probability: 0.1 }),
        lastActivityAt: randomPastDate(30),
        convertedAt: stage === "WON" ? randomPastDate(30) : null,
        lostAt: stage === "LOST" ? randomPastDate(20) : null,
        lostReason: stage === "LOST" ? faker.helpers.arrayElement(["Price too high","Went with competitor","No budget","Not interested","Unresponsive"]) : null,
        winReason: stage === "WON" ? faker.helpers.arrayElement(["Best price","Strong relationship","Product fit","Referral trust"]) : null,
        createdAt,
        tags: faker.helpers.arrayElements(["hot","cold","follow-up","demo-done","proposal-sent"], faker.number.int({ min: 0, max: 2 })),
      },
    });
  }

  console.log(`✅ Created 50 leads`);

  // ─── 4. Expenses (30) ────────────────────────────────────────────────────

  console.log("💰 Seeding 30 expenses...");

  const expenseCategories = ["Travel","Food","Office Supplies","Marketing","Utilities","Maintenance","Software","Communication","Training","Miscellaneous"];
  const expenseStatuses = ["PENDING","APPROVED","REJECTED","REIMBURSED"] as const;

  for (let i = 0; i < 30; i++) {
    const staff = staffMembers[i % staffMembers.length];
    const client = faker.helpers.maybe(() => clientIds[faker.number.int({ min: 0, max: 49 })], { probability: 0.4 });

    await prisma.expense.create({
      data: {
        staffId: staff.id,
        category: faker.helpers.arrayElement(expenseCategories),
        amount: faker.number.float({ min: 100, max: 5000, fractionDigits: 2 }),
        description: faker.lorem.sentence(),
        date: randomPastDate(90),
        status: faker.helpers.arrayElement(expenseStatuses),
        paymentMode: faker.helpers.arrayElement(["CASH","UPI","CARD","COMPANY_ACCOUNT"]),
        clientId: client ?? null,
      },
    });
  }

  console.log(`✅ Created 30 expenses`);

  // ─── 5. Attendance (last 30 days for each staff) ─────────────────────────

  console.log("🕐 Seeding attendance records...");

  let attendanceCount = 0;
  const seededAttendance = new Set<string>();

  for (const s of [...staffMembers, ...managers]) {
    for (let d = 1; d <= 30; d++) {
      const dateObj = new Date();
      dateObj.setUTCDate(dateObj.getUTCDate() - d);
      dateObj.setUTCHours(0, 0, 0, 0);

      const key = `${s.id}-${dateObj.toISOString()}`;
      if (seededAttendance.has(key)) continue;
      seededAttendance.add(key);

      // Skip ~20% of days (weekends/absent)
      if (faker.datatype.boolean({ probability: 0.2 })) continue;

      const checkInHour = faker.number.int({ min: 8, max: 10 });
      const checkInMin = faker.number.int({ min: 0, max: 59 });
      const checkInTime = new Date(dateObj);
      checkInTime.setUTCHours(checkInHour, checkInMin, 0, 0);

      const hoursWorked = faker.number.float({ min: 4, max: 9.5, fractionDigits: 2 });
      const checkOutTime = new Date(checkInTime.getTime() + hoursWorked * 3600 * 1000);

      const isLate = checkInHour >= 9 && checkInMin > 30;
      const isEarlyExit = checkOutTime.getUTCHours() < 17 || (checkOutTime.getUTCHours() === 17 && checkOutTime.getUTCMinutes() < 30);

      let status: string;
      if (hoursWorked >= 8 && !isLate) status = "FULL_DAY";
      else if (hoursWorked >= 4 && hoursWorked < 8) status = "HALF_DAY";
      else if (isEarlyExit) status = "EARLY_EXIT";
      else status = "PRESENT";

      await prisma.attendance.upsert({
        where: { staffId_date: { staffId: s.id, date: dateObj } },
        update: {},
        create: {
          staffId: s.id,
          date: dateObj,
          checkInTime,
          checkOutTime,
          checkInLocation: `${faker.location.latitude({ min: 12, max: 28 })},${faker.location.longitude({ min: 72, max: 88 })}`,
          checkOutLocation: `${faker.location.latitude({ min: 12, max: 28 })},${faker.location.longitude({ min: 72, max: 88 })}`,
          totalHours: hoursWorked,
          isEarlyExit,
          hasGPS: true,
          hasQR: faker.datatype.boolean({ probability: 0.4 }),
          hasSelfie: faker.datatype.boolean({ probability: 0.3 }),
          confidenceScore: faker.number.int({ min: 50, max: 100 }),
          validationStatus: faker.helpers.arrayElement(["VALID","VALID","VALID","FLAGGED"]),
          attendanceStatus: status as never,
          method: faker.helpers.arrayElement(["GPS","QR","SELFIE"]),
        },
      });
      attendanceCount++;
    }
  }

  console.log(`✅ Created ${attendanceCount} attendance records`);

  // ─── 6. Customer Interactions (calls, emails, notes) ─────────────────────

  console.log("📞 Seeding customer interactions...");

  // Sync reviewStatus with existing approved/rejected flags
  await prisma.$executeRaw`
    UPDATE "CustomerInteraction"
    SET "reviewStatus" = CASE
      WHEN approved = true  THEN 'APPROVED'
      WHEN rejected = true  THEN 'REJECTED'
      WHEN "ownerNote" IS NOT NULL AND rejected = false THEN 'EDIT_REQUESTED'
      ELSE 'PENDING'
    END
    WHERE "reviewStatus" = 'PENDING'
  `;

  const interactionTypes = ["CALL","VISIT","NOTE","EMAIL"] as const;
  const directions = ["INBOUND","OUTBOUND"] as const;
  const rejectionReasons = ["Wrong Data","Incomplete","Policy Violation","Other"] as const;
  const outcomes = ["Follow-up scheduled","Demo given","Proposal sent","No answer","Interested","Not interested","Meeting booked","Closed deal"];

  // Distribution: 40% PENDING, 40% APPROVED, 10% REJECTED, 10% EDIT_REQUESTED
  type ReviewBucket = { approved: boolean; rejected: boolean; ownerNote: string | null; reviewStatus: string; reviewReason: string | null };

  function pickReviewBucket(): ReviewBucket {
    const r = Math.random();
    if (r < 0.40) return { approved: false, rejected: false, ownerNote: null, reviewStatus: "PENDING",        reviewReason: null };
    if (r < 0.80) return { approved: true,  rejected: false, ownerNote: null, reviewStatus: "APPROVED",       reviewReason: null };
    if (r < 0.90) {
      const reason = faker.helpers.arrayElement(rejectionReasons);
      return { approved: false, rejected: true, ownerNote: reason, reviewStatus: "REJECTED", reviewReason: reason };
    }
    return {
      approved: false, rejected: false,
      ownerNote: faker.helpers.arrayElement(["Please add GPS coordinates","Outcome description too vague","Duration is missing","Client name mismatch"]),
      reviewStatus: "EDIT_REQUESTED", reviewReason: null,
    };
  }

  for (let i = 0; i < 80; i++) {
    const clientId = clientIds[faker.number.int({ min: 0, max: 49 })];
    const staff    = allStaff[faker.number.int({ min: 0, max: allStaff.length - 1 })];
    const type     = faker.helpers.arrayElement(interactionTypes);
    const bucket   = pickReviewBucket();

    // Some PENDING items older than 48h to test escalation
    const isOldPending = bucket.reviewStatus === "PENDING" && Math.random() < 0.3;
    const createdAt    = isOldPending
      ? new Date(Date.now() - (50 + Math.random() * 100) * 60 * 60 * 1000)  // 50–150h ago
      : randomPastDate(60);

    await prisma.customerInteraction.create({
      data: {
        clientId,
        staffId:      staff.id,
        type,
        date:         randomPastDate(60),
        duration:     type === "CALL" || type === "VISIT" ? faker.number.int({ min: 5, max: 90 }) : null,
        outcome:      faker.helpers.arrayElement(outcomes),
        notes:        faker.lorem.sentence(),
        direction:    type === "EMAIL" || type === "CALL" ? faker.helpers.arrayElement(directions) : null,
        nextFollowUp: faker.helpers.maybe(() => randomFutureDate(14), { probability: 0.4 }),
        createdAt,
        ...bucket,
      },
    });
  }

  console.log(`✅ Created 80 customer interactions (PENDING/APPROVED/REJECTED/EDIT_REQUESTED mix)`);

  // ─── 7. Complaints (10) ───────────────────────────────────────────────────

  console.log("⚠️  Seeding 10 complaints...");

  const complaintPriorities = ["LOW","MEDIUM","HIGH","CRITICAL"] as const;
  const complaintStatuses = ["OPEN","IN_PROGRESS","RESOLVED","CLOSED"] as const;

  for (let i = 0; i < 10; i++) {
    const clientId = clientIds[faker.number.int({ min: 0, max: 49 })];
    const status = faker.helpers.arrayElement(complaintStatuses);

    await prisma.complaint.create({
      data: {
        clientId,
        raisedBy: allStaff[faker.number.int({ min: 0, max: allStaff.length - 1 })].id,
        description: faker.helpers.arrayElement([
          "Service delivery was delayed by more than 2 weeks.",
          "Invoice amount does not match the agreed quote.",
          "Product quality did not meet specifications.",
          "Support team was unresponsive for 3 days.",
          "Wrong item was delivered to the client.",
          "Software integration failed during implementation.",
          "Billing discrepancy on last month's invoice.",
          "Field engineer arrived late and was unprepared.",
          "Data migration caused partial data loss.",
          "SLA breach on critical issue resolution."
        ])[i % 10],
        priority: faker.helpers.arrayElement(complaintPriorities),
        status,
        assignedTo: allStaff[faker.number.int({ min: 0, max: allStaff.length - 1 })].id,
        resolution: status === "RESOLVED" || status === "CLOSED"
          ? faker.helpers.arrayElement(["Replacement dispatched","Refund processed","Issue fixed in v2.1","Escalated to senior team","Credit note issued"])
          : null,
        resolvedAt: status === "RESOLVED" || status === "CLOSED" ? randomPastDate(10) : null,
        createdAt: randomPastDate(45),
      },
    });
  }

  console.log(`✅ Created 10 complaints`);

  // ─── 8. Lead Activities ───────────────────────────────────────────────────

  console.log("📋 Seeding lead activities...");

  const leads = await prisma.lead.findMany({ select: { id: true } });
  const activityTypes = ["NOTE_ADDED","EMAIL_SENT","CALL_MADE","MEETING_SCHEDULED","STAGE_CHANGED"] as const;

  for (const lead of leads.slice(0, 30)) {
    const count = faker.number.int({ min: 1, max: 4 });
    for (let a = 0; a < count; a++) {
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          type: faker.helpers.arrayElement(activityTypes),
          description: faker.helpers.arrayElement([
            "Called client, discussed requirements",
            "Sent product brochure via email",
            "Scheduled demo for next week",
            "Added note: client interested in premium plan",
            "Follow-up call completed",
            "Lead stage updated",
            "Proposal document shared",
            "Meeting held — good response from client",
          ]),
          performedBy: allStaff[faker.number.int({ min: 0, max: allStaff.length - 1 })].id,
          createdAt: randomPastDate(60),
        },
      });
    }
  }

  console.log(`✅ Created lead activities`);

  // ─── 9. Lead Notes ────────────────────────────────────────────────────────

  console.log("📝 Seeding lead notes...");

  for (const lead of leads.slice(0, 25)) {
    await prisma.leadNote.create({
      data: {
        leadId: lead.id,
        content: faker.helpers.arrayElement([
          "Client requested a demo by end of this month.",
          "Budget approved — ready to proceed.",
          "Needs approval from their board before signing.",
          "Interested in the enterprise package.",
          "Competitor pricing was shared — need to revise proposal.",
          "Follow up in 2 weeks after internal review.",
          "Very promising lead — high chance of conversion.",
          "Price negotiation ongoing.",
        ]),
        createdBy: allStaff[faker.number.int({ min: 0, max: allStaff.length - 1 })].id,
        createdAt: randomPastDate(30),
      },
    });
  }

  console.log(`✅ Created lead notes`);

  // ─── 10. Products ─────────────────────────────────────────────────────────

  console.log("📦 Seeding products...");

  const productData = [
    { name: "CRM Pro License", sku: "CRM-PRO-001", category: "Software", unitPrice: 12000, costPrice: 6000, stockQuantity: 100 },
    { name: "Field Staff App", sku: "FSA-MOB-001", category: "Software", unitPrice: 5000, costPrice: 2000, stockQuantity: 200 },
    { name: "HR Management Suite", sku: "HR-STE-001", category: "Software", unitPrice: 18000, costPrice: 9000, stockQuantity: 50 },
    { name: "Attendance QR Device", sku: "ATT-QR-001", category: "Hardware", unitPrice: 3500, costPrice: 1800, stockQuantity: 30 },
    { name: "Analytics Dashboard", sku: "ANA-DSH-001", category: "Software", unitPrice: 8000, costPrice: 3500, stockQuantity: 75 },
  ];

  for (const p of productData) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        ...p,
        unit: "license",
        minimumStock: 5,
        description: `${p.name} — enterprise-grade solution for businesses.`,
      },
    });
  }

  console.log(`✅ Created 5 products`);

  // ─── 11. Invoices (10) ────────────────────────────────────────────────────

  console.log("🧾 Seeding 10 invoices...");

  const invoiceStatuses = ["DRAFT","SENT","PAID","OVERDUE"] as const;

  for (let i = 0; i < 10; i++) {
    const clientId = clientIds[i * 5];
    const issueDate = randomPastDate(60);
    const dueDate = new Date(issueDate.getTime() + 30 * 24 * 3600 * 1000);
    const subtotal = faker.number.float({ min: 5000, max: 100000, fractionDigits: 2 });
    const cgst = subtotal * 0.09;
    const sgst = subtotal * 0.09;
    const totalTax = cgst + sgst;
    const totalAmount = subtotal + totalTax;

    const invoice = await prisma.invoice.upsert({
      where: { invoiceNumber: `INV-2026-${String(i + 1).padStart(4, "0")}` },
      update: {},
      create: {
        invoiceNumber: `INV-2026-${String(i + 1).padStart(4, "0")}`,
        clientId,
        issueDate,
        dueDate,
        subtotal,
        cgst,
        sgst,
        igst: 0,
        totalTax,
        totalAmount,
        status: faker.helpers.arrayElement(invoiceStatuses),
        notes: faker.helpers.maybe(() => "Payment due within 30 days.", { probability: 0.5 }),
      },
    });

    // Add 1-3 line items per invoice
    const itemCount = faker.number.int({ min: 1, max: 3 });
    for (let j = 0; j < itemCount; j++) {
      const qty = faker.number.int({ min: 1, max: 10 });
      const unitPrice = faker.number.float({ min: 1000, max: 20000, fractionDigits: 2 });
      await prisma.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          description: faker.helpers.arrayElement(["CRM License","Implementation Services","Annual Support","Training","Custom Development","Hardware"]),
          quantity: qty,
          unitPrice,
          total: qty * unitPrice,
        },
      });
    }
  }

  console.log(`✅ Created 10 invoices with line items`);

  // ─── Done ─────────────────────────────────────────────────────────────────

  console.log("");
  console.log("🎉 Seeding complete!");
  console.log("   Admin login: admin@askworx.com / admin123456");
  console.log("   Manager:     rajesh.mehta@askworx.com / manager@123");
  console.log("   Staff:       ankit.verma@askworx.com / staff@123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
