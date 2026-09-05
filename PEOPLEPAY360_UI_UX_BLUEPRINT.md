# PeoplePay360 — UI/UX & Implementation Blueprint
**Document Version:** 1.0.0 | **Author:** Pavan & Jay (Team PeoplePay360) | **Scope:** 24-Hour Hackathon Implementation  
**Platform Concept:** Integrated HR & Payroll Operations Platform (Connecting Employee → Contract → Schedule → Attendance → Time Off → Salary Structure → Payrun → Payslip → Analytics)

---

## Executive Summary & Design Principles

PeoplePay360 is not a set of disconnected CRUD tables. It is an **orchestrated operational pipeline** where the **Employee Hub** sits at the center, feeding operational inputs (attendance, working schedules, approved time-off leaves) into a deterministic **Payroll Engine** (contracts, salary structures, rule sequences, payrun batches, payslip generation, and executive dashboards).

### Core Principles for Hackathon Execution:
1. **Framework-Agnostic & Small Vertical Slices:** Screen designs and component contracts decouple frontend presentation from backend architecture.
2. **Speed Through Reusability:** Every screen is composed of 12 recurring atomic components (Smart Stat Pills, Stepper Wizard, Status Badges, Filterable Data Tables, Metric Cards).
3. **Demo-Optimized Workflows:** The UI prioritizes visual state progression (e.g. Payrun `DRAFT` → `COMPUTED` → `VALIDATED` → `PAID`) with explicit alerts and immediate feedback.
4. **Role-Aware Scoping:** Clean boundary between Employee Self-Service and HR/Payroll Manager Command Center.

---

## 1. Complete Sitemap

```
PeoplePay360 (Root)
│
├── /login ── Authentication & Role Switcher (Demo Mode)
│
├── /dashboard ── Executive Overview & Operational Health (KPIs, Charts, Feeds)
│
├── /hr ── Core Human Resources Module
│   ├── /employees ── Employee Directory (Table / Kanban Views)
│   │   ├── /employees/new ── Create Employee Form
│   │   └── /employees/:id ── Employee 360 Hub (Identity, Contract, Attendance, Time Off)
│   ├── /contracts ── Contract Management
│   │   ├── /contracts/new ── New Contract Form
│   │   └── /contracts/:id ── Contract Detail / Activation
│   ├── /schedules ── Working Schedules (7-Day Shift & Break Hours Config)
│   ├── /attendance ── Attendance Registry & Daily Check-In/Out Logs
│   └── /time-off ── Time Off Operations Hub
│       ├── /time-off/requests ── Leave Requests & Approval Pipeline
│       ├── /time-off/allocations ── Employee Leave Entitlements & Balances
│       └── /time-off/types ── Leave Type Configuration & Payroll Integration
│
├── /payroll ── Payroll Engine Module
│   ├── /structures ── Salary Structures (Rule Sequencing & Hierarchies)
│   ├── /rules ── Salary Calculation Rules (Fixed, Percentage, Formula)
│   ├── /payruns ── Payrun Batch Directory
│   │   ├── /payruns/wizard ── 2-Step Payrun Creation Wizard (Scope → Employee Selection)
│   │   └── /payruns/:id ── Payrun Processing Command Center (Workflow Stepper & Payslips)
│   └── /payslips ── Global Payslip Archive
│       └── /payslips/:id ── Printable Payslip Voucher View (PDF / Email Ready)
│
├── /reports ── Analytics & Auditing
│   └── /reports/payroll-dashboard ── Deep Payroll Analysis & Department Cost Center
│
└── /admin ── System Administration
    ├── /admin/users ── User Account Provisioning
    └── /admin/roles ── Role-Based Access Control (RBAC Matrix)
```

---

## 2. Navigation Hierarchy & Shell Layout

### Layout Wireframe (Desktop)

```
+--------------------------------------------------------------------------------------------------+
| BRAND LOGO [PeoplePay360] | Search [Cmd+K] | Active Period: Sept 2026 | [Role: HR Payroll Mgr v] |
+---------------------------+----------------------------------------------------------------------+
| [v] DASHBOARD             | Breadcrumbs: HR / Employees / John Doe (EMP-0042)                     |
|                           | Page Title: Employee 360 Hub                        [Edit] [Actions v]|
| [v] HR OPERATIONS         +----------------------------------------------------------------------+
|   • Employees (48)        | [ Contracts: 1 Active ] [ Attendance: 96% ] [ Leaves: 3 Pending ]   |
|   • Contracts (45)        +----------------------------------------------------------------------+
|   • Schedules (3)         |  ( Identity )  ( Job & Org )  ( Schedule )  ( Bank & Tax )  ( Pay )    |
|   • Attendance            | +------------------------------------------------------------------+ |
|   • Time Off              | | Personal Details Grid                                            | |
|     - Requests            | | Full Name: John Doe              Work Email: john@company.com    | |
|     - Allocations         | | Department: Engineering          Job Title: Senior Backend Eng   | |
|     - Leave Types         | | Working Schedule: Standard 40h   Manager: Sarah Connor           | |
|                           | +------------------------------------------------------------------+ |
| [v] PAYROLL ENGINE        |                                                                      |
|   • Salary Structures     |                                                                      |
|   • Salary Rules          |                                                                      |
|   • Payruns               |                                                                      |
|   • Payslips              |                                                                      |
|                           |                                                                      |
| [v] REPORTS & ANALYTICS   |                                                                      |
|   • Payroll Dashboard     |                                                                      |
|                           |                                                                      |
| [v] SETTINGS / ADMIN      |                                                                      |
+---------------------------+----------------------------------------------------------------------+
```

### Key Navigation Elements:
- **Left Collapsible Sidebar (250px width):**
  - Section Headers: `GENERAL`, `HR MANAGEMENT`, `PAYROLL ENGINE`, `REPORTS`, `ADMIN`.
  - Active Item Highlight: Accent background pill with left indicator bar.
  - Collapsible Chevron for sub-items (`Time Off`, `Admin`).
  - Bottom Utility: System Status badge (`Demo Mode: Live`), Collapse toggle button.
- **Top Bar (64px height, sticky):**
  - Brand Logo + Organization Switcher.
  - Global Search Input (`Cmd+K` shortcut placeholder).
  - Quick Action Dropdown: `+ Quick Check-In`, `+ New Employee`, `+ Run Payroll`.
  - Current Pay Period pill (e.g., `September 2026 - Active Cycle`).
  - Role Persona Quick Switcher (Essential for hackathon live judging).
  - User Avatar with status badge + Profile Dropdown.
- **Sub-Header / Breadcrumb Bar:**
  - Dynamic breadcrumb trail (clickable links).
  - Screen H1 title and primary contextual action buttons.

---

## 3. Screen Inventory & Priority Classification

| Screen ID | Screen Name | Route | Role Access | Priority | Primary Objective |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SCR-01** | Login & Persona Selector | `/login` | Public | **MUST BUILD** | Fast role-switching authentication for demo |
| **SCR-02** | Main Application Shell | `/*` | All | **MUST BUILD** | Unified sidebar, header, alerts, and responsive grid |
| **SCR-03** | Operations Dashboard | `/dashboard` | All (Role-scoped) | **MUST BUILD** | Executive KPIs, alerts, attendance & leave balance |
| **SCR-04** | Employee Directory | `/hr/employees` | HR, Payroll, Admin | **MUST BUILD** | Filterable list & Kanban cards with avatar & status |
| **SCR-05** | Employee 360 Hub | `/hr/employees/:id`| All (Role-scoped) | **MUST BUILD** | Central operational anchor with smart counters |
| **SCR-06** | Contract Management | `/hr/contracts` | HR, Payroll, Admin | **MUST BUILD** | Active/Historical/Future contract validation |
| **SCR-07** | Working Schedule Config | `/hr/schedules` | HR, Admin | **MUST BUILD** | 7-day work/break hours matrix & total weekly hours |
| **SCR-08** | Attendance Registry | `/hr/attendance` | All (Role-scoped) | **MUST BUILD** | Check-in/out logs, worked hours, and status badges |
| **SCR-09A**| Time Off Requests | `/hr/time-off/requests` | All | **MUST BUILD** | Leave pipeline with Approve/Refuse & balance preview |
| **SCR-09B**| Time Off Allocations | `/hr/time-off/allocations`| HR, Admin | **SHOULD BUILD**| Entitlement quotas (Allocated, Taken, Remaining) |
| **SCR-09C**| Time Off Types Config | `/hr/time-off/types` | HR, Admin | **SHOULD BUILD**| Units, allocation rules, payroll integration flags |
| **SCR-10** | Salary Structures | `/payroll/structures` | Payroll, Admin | **MUST BUILD** | Ordered rule sequences (Basic → Net) |
| **SCR-11** | Salary Rules Config | `/payroll/rules` | Payroll, Admin | **MUST BUILD** | Fixed, Percentage, and Formula calculations |
| **SCR-12** | Payrun Wizard (2-Step) | `/payroll/payruns/wizard` | Payroll, Admin | **MUST BUILD** | Step 1: Scope; Step 2: Employee Selection |
| **SCR-13** | Payrun Command Center | `/payroll/payruns/:id` | Payroll, Admin | **MUST BUILD** | Stepper (`DRAFT` → `PAID`), warnings, batch table |
| **SCR-14** | Payslip Voucher View | `/payroll/payslips/:id`| All (Role-scoped) | **MUST BUILD** | Breakdown of Earnings, Deductions, Net & PDF export |
| **SCR-15** | Payroll Analytics | `/reports/payroll-dashboard`| Payroll, Admin | **SHOULD BUILD**| Dept costs, trends, drill-down audit capabilities |
| **SCR-16** | Admin: User & Roles | `/admin/roles` | Admin | **NICE TO HAVE** | RBAC permission matrix for extended demo |

---

## 4. Detailed Screen-by-Screen Layout Recommendations

### SCR-01: Login & Persona Selector
- **Header:** PeoplePay360 brand identity with sub-heading: *"Integrated HR & Deterministic Payroll Engine"*.
- **Left Panel:** Modern illustration or metric highlights (*"100% accurate salary rules with automated time-off deduction sync"*).
- **Right Panel (Interactive Login Card):**
  - Standard Email / Password inputs with validation states.
  - **Hackathon Quick-Persona Switcher (Crucial for Demo):**
    - 5 clickable badge cards: `[Employee: John]` | `[HR Manager: Sarah]` | `[HR Payroll User: Alex]` | `[HR Payroll Manager: Elena]` | `[Admin: Root]`.
    - Clicking a badge auto-populates credentials and sets active demo context.
  - Submit Button: *"Sign In to Workspace"* (shows spinner on submit).
  - Footer: Secure OAuth / SAML SSO mock link.

### SCR-02: Main Application Layout Shell
- Standardized container wrapping all authenticated screens.
- **Top-right Toast Notification Center:** For instant feedback on state changes (e.g. *"Payrun PR-2026-09 Computed for 48 Employees"*).
- **Global Context Bar:** Sticky top warning banner if prerequisites are missing (e.g. *"Notice: 2 employees have expired contracts before the current payrun cycle"*).

### SCR-03: Operations Dashboard
- **Top Row (5 High-Impact KPI Cards):**
  1. *Total Net Salary Paid:* Value in currency + trend delta (+2.4% vs last cycle).
  2. *Payslips Generated:* e.g. `48 / 50` with circular progress ring.
  3. *Average Net Salary:* Average per full-time employee.
  4. *Approved Time Off (This Month):* Total person-days on leave.
  5. *Attendance Health Score:* e.g. `96.2%` on-time attendance.
- **Middle Row (Charts):**
  - *Left Chart (60% width):* **Monthly Net Salary Trends** (Line/Area chart showing last 6 months Gross vs Net).
  - *Right Chart (40% width):* **Salary Cost by Department** (Horizontal bar or Donut chart: Engineering, Sales, Product, HR, Operations).
- **Bottom Row (Operational Action Widgets):**
  - *Payroll Warnings & Action Items Feed (40% width):*
    - Tagged cards: `[URGENT] 1 Employee Missing Bank Details` (Click to open).
    - `[INFO] Payrun September 2026 ready for validation`.
  - *Attendance & Leaves Today (30% width):* 3 employees on approved leave today with avatars.
  - *Quick Payrun Launcher (30% width):* Button to launch Payrun Wizard directly.

### SCR-04: Employee Directory
- **Control Bar:**
  - Search input with instantaneous debounced filtering (by name, email, employee ID).
  - Dropdown Filters: Department (`All`, `Engineering`, `HR`, `Finance`), Status (`Active`, `Onboarding`, `Terminated`), Type (`Full-time`, `Contractor`).
  - View Toggle: `[Table View Icon]` | `[Kanban Cards Icon]`.
  - Primary Action Button: `[+ Add Employee]`.
- **Table Columns:**
  - `Avatar + Employee Name` (with subtitle: ID & Work Email).
  - `Department & Job Position`.
  - `Employment Type` (Pill: `Full-time`, `Part-time`).
  - `Active Contract` (Badge: Green `Active (Standard 40h)` or Red `No Contract`).
  - `Attendance Health` (Mini badge: `98%`).
  - `Status` (Pill: Green `Active`, Amber `Probation`, Gray `Archived`).
  - `Actions Menu (...)`: View Hub, Edit Profile, Generate Payslip.
- **Kanban View:** Visual cards grouped by Department with quick stat counters.

### SCR-05: Employee 360 Hub (Central Operational Anchor)
- **Top Profile Header Banner:**
  - Large Avatar with status indicator dot.
  - Employee Full Name, Job Title, Employee Code (`EMP-0042`), Department Tag.
  - Quick Contact links: Email, Phone, Office Location.
- **Smart Stat Action Pills (Top Right / Counter Bar):**
  - Clickable interactive counters with badge numbers:
    - `[ 📄 Contracts: 1 Active ]` → Opens Contract tab or drawer.
    - `[ ⏱ Attendance: 98% (22 Days) ]` → Opens Attendance log modal.
    - `[ 🏖 Time Off: 3 Days Left ]` → Opens Leave Allocation drawer.
    - `[ 💰 Last Payslip: $4,850 (Paid) ]` → Opens latest payslip view.
- **Tabbed Information Container:**
  - **Tab 1: Identity & Personal:** Full name, DOB, personal email, address, emergency contact.
  - **Tab 2: Job & Organization:** Department, Manager, Start Date, Work Location, Notice Period.
  - **Tab 3: Working Schedule:** Active schedule assignment (links to Schedule config), daily expected hours.
  - **Tab 4: Bank & Tax Details:** Bank Name, Account Number (masked `****4921`), Routing/IFSC Code, Tax ID/PAN.
  - **Tab 5: Payroll & History:** Active salary structure assigned, historical payslip archive list.

### SCR-06: Contract Screens
- **Contract List Screen:**
  - Badges clearly demarcating contract status:
    - `Active` (Solid Green): Currently effective contract.
    - `Future` (Solid Blue): Pre-signed contract with future start date.
    - `Historical` (Subtle Gray): Expired or superseded previous contracts.
  - Table Columns: Employee, Contract Reference (`CON-2026-001`), Wage Amount, Currency, Salary Structure Assigned, Start Date, End Date, Actions.
- **Contract Form / Modal:**
  - Employee Picker (Searchable dropdown).
  - Contract Title & Reference Code.
  - Date Range: Effective Start Date & Optional End Date.
  - Department & Position selector.
  - Wage Input (Currency selector + numeric value + pay frequency: Monthly/Hourly).
  - Salary Structure Dropdown (e.g. `Standard Full-time Structure`).
  - Working Schedule Dropdown (e.g. `40-Hour Regular Shift`).
  - State Toggle: `[Draft / Running / Expired]`.

### SCR-07: Working Schedule Configuration
- **Visual 7-Day Matrix Component:**
  - Rows for: `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday`.
  - Columns per day:
    1. Day Name + Toggle Switch (`Working Day: ON / OFF`).
    2. Start Time Picker (e.g. `09:00`).
    3. End Time Picker (e.g. `18:00`).
    4. Unpaid Break Duration (e.g. `1 hour` or `60 mins`).
    5. Daily Net Worked Hours (Auto-calculated: `End - Start - Break = 8.0h`).
- **Schedule Summary Banner:**
  - Prominent Callout Card: `Total Weekly Scheduled Hours: 40.0 Hours` (dynamically sums enabled day hours).
  - Tolerance / Overtime threshold setting: e.g. `Standard Daily Target: 8.0h`.

### SCR-08: Attendance Registry & Daily Check-In
- **Quick Check-In Bar (Top):**
  - Self-service widget: `Current Time: 09:14 AM` | `[Check In Button]` (transforms to `[Check Out Button]` with active duration counter when checked in).
- **Attendance Log Table:**
  - Date, Employee Name & Department.
  - Check-in Timestamp (e.g. `09:02 AM`).
  - Check-out Timestamp (e.g. `06:05 PM`).
  - Total Worked Hours (e.g. `8h 03m`).
  - **Status Badges:**
    - `Present` (Green) — Checked in within expected window.
    - `Late` (Amber) — Checked in >15 mins past scheduled start.
    - `Absent` (Red) — Scheduled working day with no log.
    - `Overtime` (Purple) — Worked > schedule target.
    - `Missing Checkout` (Orange Alert) — Check-in exists with no check-out past day end.
    - `Manual Edit` (Blue Outline Tag) — Indicates manager corrected entry.
- **Manual Attendance Correction Modal:**
  - Edit check-in/out times, with mandatory "Reason for manual edit" field for compliance auditing.

### SCR-09: Time Off Operations (Requests, Allocations, Types)
- **Sub-View 1: Requests (`/hr/time-off/requests`):**
  - Filter Tabs: `All Requests` | `Pending Review (3)` | `Approved` | `Refused`.
  - Table: Employee, Leave Type (e.g. `Paid Annual Leave`), Date Span (Start to End), Duration (e.g. `2 Days`), Reason Note, Status Badge.
  - **Detail / Approval Modal:**
    - Displays employee's current balance: `Total Allocated: 20d | Taken: 12d | Available: 8d`.
    - **Impact Preview:** *"Approving this request will reduce available balance to 6d"*.
    - Buttons: `[Approve (Green)]` | `[Refuse (Red)]` with rejection note prompt.
- **Sub-View 2: Allocations (`/hr/time-off/allocations`):**
  - Visual Progress Cards: Allocated Days, Taken Days, Remaining Balance (with percentage progress bar).
  - Action: `[+ Allocate Leave Days]` to grant seasonal or annual quotas.
- **Sub-View 3: Time Off Types (`/hr/time-off/types`):**
  - List and config: Name (e.g. `Sick Leave`, `Annual Leave`, `Unpaid Leave`).
  - Unit: `Days` vs `Hours`.
  - Allocation Required: `Yes / No`.
  - **Payroll Integration Toggle:** `Paid Leave (Included in Gross)` vs `Unpaid Leave (Triggers Salary Deduction)`.

### SCR-10: Salary Structures
- **List Screen:**
  - Structure Name (e.g. `Standard Tech Executive`, `Hourly Contractor`).
  - Rules Count (e.g. `6 Rules Configured`).
  - Assigned Employees Count (e.g. `34 Employees`).
  - Status Badge (`Active`).
- **Structure Detail & Rule Sequencing View:**
  - Visual Ordered Hierarchy showing calculation precedence:
    ```
    Seq 01: BASIC       [Category: Basic]       (Fixed or Contract Wage)
      ↓
    Seq 02: HRA         [Category: Allowance]   (40% of BASIC)
      ↓
    Seq 03: CONVEYANCE  [Category: Allowance]   (Fixed Amount: $200)
      ↓
    Seq 04: GROSS       [Category: Gross]       (BASIC + HRA + CONVEYANCE)
      ↓
    Seq 05: TAX_DEDUCT  [Category: Deduction]   (15% of GROSS)
      ↓
    Seq 06: UNPAID_LEAVE[Category: Deduction]   (Formula: (BASIC/30) * UNPAID_DAYS)
      ↓
    Seq 07: NET         [Category: Net]         (GROSS - DEDUCTIONS)
    ```
  - Drag-and-drop or Sequence Number inputs to ensure deterministic computation order.

### SCR-11: Salary Rules Configuration
- **Rule Configuration Form:**
  - Rule Name (e.g. `House Rent Allowance`).
  - Code (Unique identifier used in formulas, e.g. `HRA`, `GROSS`, `NET`, `TAX`).
  - Category Selector: `[Basic]` | `[Allowance]` | `[Gross]` | `[Deduction]` | `[Net]`.
  - Sequence Integer: Determines execution order.
  - **Calculation Type Switcher (Dynamic UI):**
    - **Option A: Fixed Amount:** Shows numeric currency input (e.g. `$250.00`).
    - **Option B: Percentage:** Shows Percentage input (`40%`) + Base Variable dropdown (`BASIC` or `GROSS`).
    - **Option C: Formula:** Interactive code/formula editor input (e.g. `contract.wage * 0.5 + allowances.conveyance`).
      - Helper cheatsheet below formula editor showing available variables: `contract.wage`, `attendance.worked_hours`, `time_off.unpaid_days`, `rules.BASIC`.

### SCR-12: Payrun Wizard (2-Step Modal Workflow)
- **Modal Header:** Step Indicator: `[1. Payroll Scope] ───── [2. Employee Selection]`.
- **Step 1 — Payroll Scope:**
  - Payrun Name input (e.g. `September 2026 Regular Cycle`).
  - Salary Structure selection dropdown.
  - Payroll Period: Start Date (`2026-09-01`) & End Date (`2026-09-30`).
  - Payment Due Date (`2026-10-01`).
  - *No database records created yet.*
  - Action: `[Continue to Employee Selection →]`.
- **Step 2 — Employee Selection:**
  - Summary Bar: `48 Eligible Employees Found for this Structure`.
  - Search bar + Department filter.
  - Multi-select checkbox table with `[Select All Eligible]` toggle.
  - List shows: Employee Name, Department, Active Contract wage, Exclusions/Warnings.
  - **Exclusion Warnings Tab / Section:**
    - e.g. `2 Employees Ineligible`:
      - *Alex Miller:* No active contract during this date range.
      - *Dana Scully:* Bank account details missing.
  - Primary Action: `[Create Payrun & Open Processing Screen]`.

### SCR-13: Payrun Processing Command Center
- **Workflow State Stepper (Top Ribbon):**
  - Visual interactive pipeline:
    `[ DRAFT ] ───▶ [ COMPUTED ] ───▶ [ VALIDATED ] ───▶ [ MARK PAID ] ───▶ [ PAYSLIPS SENT ]`
  - Active step highlighted with pulse indicator; completed steps marked with checkmark.
- **Payrun Meta Header:**
  - Payrun ID & Name: `PR-2026-09 (September Regular)`.
  - Structure: `Standard Full-time` | Period: `Sep 01 - Sep 30, 2026`.
  - High-Level Summary Stats:
    - `Employees: 48` | `Total Gross: $248,500.00` | `Total Deductions: $42,100.00` | `Total Net Cost: $206,400.00`.
- **Pre-Validation Warnings Section (Collapsible Alert Box):**
  - Yellow/Red warning badges:
    - `⚠ 1 Employee has 0 recorded attendance days in this period`.
    - `⚠ 2 Unpaid leaves will be deducted from base wage`.
- **Payslip Batch Table:**
  - Checkbox selection for bulk actions.
  - Columns: Employee Name, Base Wage, Gross, Total Deductions, Net Salary, Computed Status (`Draft`, `Computed`, `Confirmed`), Warnings Flag.
  - Row Click: Opens side-sheet or modal with individual employee computation breakdown.
- **Sticky Bottom Action Bar:**
  - In `DRAFT` state: `[Re-Compute All]` and `[Validate & Confirm Payrun]`.
  - In `VALIDATED` state: `[Mark Paid & Close Period]`.
  - In `PAID` state: `[Download All Payslips (ZIP)]` and `[Send Payslips via Email]`.

### SCR-14: Payslip Voucher View
- **Voucher Layout (A4-Proportioned, Print & PDF Optimized):**
  - Company Header: Organization Name, Address, Tax Registration, Logo.
  - Pay Period & Reference: `Payslip #PS-2026-09-042 | Period: Sep 01 - Sep 30, 2026`.
  - Employee Profile Box (2-column): Name, ID, Department, Position, Bank Name, Masked Account, Worked Days, Unpaid Absence Days.
  - **Itemized Salary Table (Side-by-Side Earnings & Deductions):**
    ```
    +--------------------------------+--------------------------------+
    | EARNINGS                       | DEDUCTIONS                     |
    +--------------------------------+--------------------------------+
    | Basic Salary         $4,000.00 | Income Tax (TDS)       $480.00 |
    | House Rent Allowance $1,200.00 | Social Security/PF     $300.00 |
    | Special Allowance      $300.00 | Unpaid Leave Deduction $133.33 |
    +--------------------------------+--------------------------------+
    | TOTAL GROSS          $5,500.00 | TOTAL DEDUCTIONS       $913.33 |
    +--------------------------------+--------------------------------+
    | NET SALARY PAYABLE:                      $4,586.67              |
    | (In words: Four Thousand Five Hundred Eighty-Six & 67/100)      |
    +-----------------------------------------------------------------+
    ```
  - Verification Footer: System-generated verification hash and signature line.
- **Top Action Bar:**
  - `[🖨 Print PDF]` | `[⬇ Download PDF]` | `[✉ Send to Employee Email]`.

### SCR-15: Payroll Analytics Dashboard
- **Filter Bar:** Period range selector, Department multi-select, Employee contract type.
- **Executive Visualizations:**
  - Chart 1: *Salary Cost Distribution by Department* (Bar chart with cost breakdown).
  - Chart 2: *Gross vs Net Payroll Trend* (Stacked area chart over past 6-12 months).
  - Chart 3: *Leave Liability & Absence Cost* (Financial impact of paid vs unpaid time off).
  - Chart 4: *Overtime vs Regular Hours Spend*.
- **Audit Table:** Filterable list of all payroll line-item anomalies for the cycle.

---

## 5. Master Component Inventory

```
UI Primitives & Atoms
├── Typography (Heading1, Heading2, Text, Caption, CodeBlock)
├── Buttons (Primary, Secondary, Ghost, Danger, IconOnly, ButtonGroup)
├── Form Inputs (TextInput, NumberInput, SelectDropdown, SearchInput, DatePicker, ToggleSwitch)
├── Data Display (Avatar, AvatarGroup, StatusBadge, SmartStatPill, CurrencyDisplay, PercentageBar)
├── Feedback (ToastNotification, InlineAlert, SkeletonLoader, EmptyStateView, ConfirmDialog)
└── Layout Structures (AppShell, SidebarNav, TopHeader, Card, MetricCard, StepperWizard, Table, Modal)
```

---

## 6. Reusable Component List & Props Specification

| Component | Usage & Props | Hackathon Speed Benefit |
| :--- | :--- | :--- |
| `<SmartStatPill />` | `label: string, count: number \| string, icon: IconType, onClick: () => void, variant: 'default' \| 'active' \| 'warning'` | Instant smart buttons for Employee Hub & dashboard counters |
| `<StatusBadge />` | `status: StatusType, size?: 'sm' \| 'md', showDot?: boolean` | Standardized color/icon mapping across all 15 screens |
| `<MetricCard />` | `title: string, value: string, trend?: { delta: string, isPositive: boolean }, icon: IconType, subtext?: string` | Used in Executive Dashboard, Payrun Header, and Analytics |
| `<StepperWizard />`| `steps: Array<{ label: string, status: 'complete' \| 'current' \| 'upcoming' }>, onStepClick?: (idx) => void` | Used in Payrun 2-step creation & 5-step processing pipeline |
| `<DataTable />` | `columns: ColumnDef[], data: any[], searchable?: boolean, filterable?: boolean, pagination?: boolean, onRowClick?: (row) => void` | Powers Employee list, Attendance list, Payrun batch list, Leave requests |
| `<AlertBanner />` | `type: 'info' \| 'warning' \| 'error' \| 'success', title: string, message: string, action?: { label: string, onClick: () => void }` | Shows missing bank details, zero attendance days, expired contracts |
| `<EmptyState />` | `title: string, description: string, icon: IconType, actionLabel?: string, onAction?: () => void` | Zero-data placeholders for payslips, leaves, contracts |
| `<ModalDialog />`| `isOpen: boolean, onClose: () => void, title: string, footerActions: ReactNode, size: 'sm' \| 'md' \| 'lg' \| 'xl'` | Used for quick check-in, leave approval, and payrun wizard |

---

## 7. Status Badge System (Semantic Color Tokens)

To guarantee visual consistency across modules, use this strict semantic token map:

| Domain | State | Background | Text / Border | Icon / Visual Indicator |
| :--- | :--- | :--- | :--- | :--- |
| **Employee** | Active | `bg-emerald-50` | `text-emerald-700 border-emerald-200` | Solid green pulse dot |
| **Employee** | Probation | `bg-amber-50` | `text-amber-700 border-amber-200` | Yellow dot |
| **Employee** | Terminated | `bg-slate-100` | `text-slate-600 border-slate-200` | Gray archived icon |
| **Contract** | Active | `bg-emerald-50` | `text-emerald-700 border-emerald-200` | Checkmark |
| **Contract** | Future | `bg-sky-50` | `text-sky-700 border-sky-200` | Calendar clock |
| **Contract** | Historical | `bg-slate-100` | `text-slate-500 border-slate-200` | History clock |
| **Attendance** | Present | `bg-emerald-50` | `text-emerald-700 border-emerald-200` | On-time check |
| **Attendance** | Late | `bg-amber-50` | `text-amber-700 border-amber-200` | Clock alert |
| **Attendance** | Absent | `bg-rose-50` | `text-rose-700 border-rose-200` | X-mark |
| **Attendance** | Overtime | `bg-indigo-50` | `text-indigo-700 border-indigo-200` | Plus duration |
| **Attendance** | Missing Checkout| `bg-orange-50` | `text-orange-700 border-orange-200` | Exclamation circle |
| **Attendance** | Manual Edit | `bg-blue-50` | `text-blue-700 border-blue-200` | Pencil tag |
| **Time Off** | Pending | `bg-amber-50` | `text-amber-700 border-amber-200` | Hourglass |
| **Time Off** | Approved | `bg-emerald-50` | `text-emerald-700 border-emerald-200` | Double checkmark |
| **Time Off** | Refused | `bg-rose-50` | `text-rose-700 border-rose-200` | Ban circle |
| **Payrun** | Draft | `bg-slate-100` | `text-slate-700 border-slate-200` | Edit pencil |
| **Payrun** | Computed | `bg-blue-50` | `text-blue-700 border-blue-200` | Calculator icon |
| **Payrun** | Validated | `bg-indigo-50` | `text-indigo-700 border-indigo-200` | Shield check |
| **Payrun** | Paid | `bg-emerald-50` | `text-emerald-700 border-emerald-200` | Banknote check |

---

## 8. Form Patterns & Validation Architecture

- **Grid Layout:** Standard 2-column responsive layout (`grid-cols-1 md:grid-cols-2 gap-6`) for all forms.
- **Visual Section Anchors:** Group fields with clean section headers (`Personal Information`, `Compensation & Contract`, `Banking & Compliance`).
- **Real-Time Validation States:**
  - *Default:* Neutral border (`border-slate-300`).
  - *Focus:* Subtle ring (`ring-2 ring-indigo-500 border-indigo-500`).
  - *Error:* Red border (`border-rose-500`) with assistive error icon and helper message immediately below the field.
  - *Success:* Subtle green check for unique validated fields (e.g. Employee Code).
- **Dynamic Calculation Previews:**
  - In Salary Rules: Changing calculation type instantly toggles the child inputs without page reload.
  - In Working Schedule: Adjusting break duration instantly recalculates daily and total weekly hours in the summary badge.
- **Sticky Bottom Action Bar:** For long forms (Employee Hub, Contract Form), actions (`Save Changes`, `Cancel`, `Archive`) remain pinned to the bottom of the viewport with an active change detection prompt.

---

## 9. Table Patterns & Data Density

- **Header Bar:** Embedded search field on the left, filter chips in the center, view toggle and primary `+ Add` button on the right.
- **Density:** Compact row height (`48px` to `56px`) with clear vertical alignment for enterprise data readability.
- **Interactive Rows:** Entire row hover highlight (`hover:bg-slate-50`); clicking row navigates to the item detail.
- **Row Multi-Select Checkbox:** Fixed first column with `Select All` in the table header, triggering a floating bulk actions bar (`Compute Selected`, `Approve Selected`, `Export CSV`).
- **Sticky Column Headers:** Header remains locked at the top during vertical scrolling.
- **Empty State Fallback:** Never show an empty white box; render a centered icon, clear message, and single primary action button.

---

## 10. Modal & Dialog System

| Modal Name | Trigger | Content & Actions |
| :--- | :--- | :--- |
| **Payrun Wizard Modal** | `[+ Run Payroll]` button | 2-step modal with scope configuration and employee selection table |
| **Quick Check-In / Out** | Topbar Attendance Pill | Timestamp confirmation, GPS/IP mock status, Notes, `[Confirm Check-In]` |
| **Time Off Decision Modal** | Row click in Requests | Leave duration, remaining balance impact calculation, `[Approve]` / `[Refuse]` |
| **Manual Attendance Fix** | Attendance row edit icon | Adjust clock-in/out times, select audit reason dropdown, `[Save Correction]` |
| **Destructive Confirm Dialog**| Delete / Refuse / Cancel | Clear red warning alert, consequence explanation, `[Confirm Action]` |

---

## 11. Empty, Loading, and Error States

### Empty States:
- **No Payruns:** Illustration of a payroll ledger + Headline: *"No Payruns Executed Yet"* + Body: *"Start your first payroll cycle by selecting an active salary structure and eligible employees."* + Button: `[+ Launch Payrun Wizard]`.
- **No Attendance Logs:** *"No check-ins recorded for today"* + Button: `[+ Manual Check-In]`.
- **No Pending Time Off:** Checkmark badge + *"All leave requests are reviewed. Your inbox is clean."*

### Loading States:
- **Table Skeleton:** 5 rows with animated pulsing gray rectangles matching table column widths.
- **Metric Card Skeleton:** Pulsing rectangular badge for title and large square for numeric value.
- **Payrun Calculation Progress:** Circular animated progress indicator showing `Computing 48 / 48 Payslips (82%)...` with deterministic progress bar.

### Error & Warning States:
- **Missing Contract Alert:** Red inline banner on Employee Hub: *"Action Required: This employee has no active contract. They will be excluded from upcoming payruns."*
- **Missing Bank Details:** Yellow banner on Payrun table: *"Warning: 2 payslips cannot be marked as Paid due to missing IBAN/Account details."*

---

## 12. Role-Based Navigation & Access Matrix (RBAC)

| Application Route / Action | Employee | HR Manager | HR Payroll User | HR Payroll Manager | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Dashboard (Overview)** | Own Stats | Full HR | Full Payroll | Full Exec | Full Exec |
| **Employees: View Directory**| Team Only | Full View | Full View | Full View | Full View |
| **Employees: Create / Edit** | Hidden | Full Edit | Read Only | Full Edit | Full Edit |
| **Contracts & Working Schedules**| Hidden | Full Access | Read Only | Full Access | Full Access |
| **Attendance: Check In / Out**| Self Only | Self + Team | Self Only | Self + All | Full Access |
| **Attendance: Manual Corrections**| Hidden | Full Access | Read Only | Full Access | Full Access |
| **Time Off: Submit Request** | Self Only | Self Only | Self Only | Self Only | Full Access |
| **Time Off: Approve / Refuse**| Hidden | Full Access | Hidden | Full Access | Full Access |
| **Salary Structures & Rules**| Hidden | Read Only | Read Only | Full Access | Full Access |
| **Payrun: Launch Wizard** | Hidden | Hidden | Full Access | Full Access | Full Access |
| **Payrun: Compute & Validate**| Hidden | Hidden | Compute Only | Full Validate | Full Access |
| **Payrun: Mark Paid** | Hidden | Hidden | Hidden | Full Access | Full Access |
| **Payslips: View & Print** | Own Slip | Hidden | All Slips | All Slips | All Slips |
| **Admin: Roles & Permissions**| Hidden | Hidden | Hidden | Hidden | Full Access |

---

## 13. Complete Payrun Wizard UX Flow (Step-by-Step)

```
[ User clicks "+ Run Payroll" on Payrun Directory or Topbar ]
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: PAYROLL SCOPE SELECTION                             │
│ • Enter Payrun Title: "September 2026 Regular Cycle"         │
│ • Select Salary Structure: "Standard Full-Time Tech"        │
│ • Choose Date Range: [2026-09-01] to [2026-09-30]           │
│ • Select Payment Target Date: [2026-10-01]                  │
│                                                             │
│ [Cancel]                         [Continue to Employees →]  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: ELIGIBLE EMPLOYEE SELECTION                         │
│ • System scans database against Structure & Active Contract │
│ • Header shows: "48 Eligible Employees | 2 Excluded"        │
│ • Multi-Select Table with [x] Check All checkbox            │
│ • Excluded Tab displays:                                    │
│    - EMP-019 (Sarah T.): Contract expired 2026-08-31        │
│    - EMP-031 (David K.): Missing bank account numbers       │
│                                                             │
│ [← Back to Scope]                [Create Payrun & Open Hub] │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
[ Payrun Record Created with State: "DRAFT" ]
[ Redirects directly to SCR-13: Payrun Command Center ]
```

---

## 14. Complete Payslip UX Flow (From Compute to Dispatch)

```
┌─────────────────────────────────────────────────────────────┐
│ PAYRUN PROCESSING COMMAND CENTER (SCR-13)                   │
│ Active State: [ DRAFT ]                                     │
│ Action: User clicks "[⚡ Compute All Payslips]"             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ COMPUTATION ENGINE EXECUTION                                │
│ For each selected employee:                                 │
│  1. Retrieve Contract Wage & Salary Structure               │
│  2. Fetch Working Schedule (Target Hours: 160h)             │
│  3. Aggregate Attendance Logs (Worked Hours: 152h)          │
│  4. Deduct Unpaid Time Off Leaves (1 Day Unpaid)            │
│  5. Calculate ordered rules: Basic → Allowances → Deductions│
│  6. Store calculated values in draft payslip records        │
│ Stepper transitions to: [ COMPUTED ]                        │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ AUDIT & VALIDATION REVIEW                                   │
│ • Review batch table: Check Gross, Deductions, Net totals   │
│ • Inspect warnings banner (e.g. 1 attendance outlier)       │
│ • Click any row to preview side-by-side computation drawer  │
│ Action: Manager clicks "[✓ Validate & Confirm Payrun]"      │
│ Stepper transitions to: [ VALIDATED ]                       │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ PAYMENT EXECUTION & CLOSING                                 │
│ Action: Finance clicks "[💳 Mark Paid & Close Period]"      │
│ • Batch state locks (No further edits permitted)            │
│ • Stepper transitions to: [ PAID ]                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ EMPLOYEE DISPATCH & EXPORT (SCR-14)                         │
│ • Action A: "[✉ Send Payslips via Email]" (Triggers dispatch)│
│ • Action B: "[⬇ Export All PDF (ZIP)]"                      │
│ • Individual Employee logs into Portal:                     │
│    - Sees new payslip under "My Payslips"                   │
│    - Opens clean voucher view with Print/PDF export         │
└─────────────────────────────────────────────────────────────┘
```

---

## 15. Complete Employee Hub UX Flow

The **Employee Hub (SCR-05)** is the connective tissue of the entire platform:

```
                            ┌────────────────────────┐
                            │      EMPLOYEE HUB      │
                            │   John Doe (EMP-0042)  │
                            └───────────┬────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
   [ Smart Pill: Contracts ]  [ Smart Pill: Attendance ] [ Smart Pill: Time Off ]
   • Shows: "1 Active"        • Shows: "96% (22 Days)"   • Shows: "3 Days Left"
   • Clicking opens:          • Clicking opens:          • Clicking opens:
     Contract Details Tab       Attendance Calendar        Leave Balance Drawer
             │                          │                          │
             ▼                          ▼                          ▼
   Wage: $5,000 / mo          Clock-in: 09:02 AM         Allocated: 20 Days
   Structure: Full-Time       Clock-out: 18:05 PM        Taken: 17 Days
   Schedule: Standard 40h     Status: Present            Remaining: 3 Days
             │                          │                          │
             └──────────────────────────┼──────────────────────────┘
                                        │
                                        ▼
                         [ Smart Pill: Last Payslip ]
                         • Shows: "$4,586.67 (Paid)"
                         • Clicking opens printable Payslip Voucher (SCR-14)
```

---

## 16. Dashboard Information Architecture & Layout Grid

```
+---------------------------------------------------------------------------------------------------+
| DASHBOARD HEADER: Welcome, Elena (HR Payroll Manager) | Filter: [September 2026 v] [All Depts v]  |
+---------------------------------------------------------------------------------------------------+
| [ KPI 1: Net Paid ]  [ KPI 2: Payslips ]  [ KPI 3: Avg Salary ] [ KPI 4: Leaves ] [ KPI 5: Health]|
|    $206,400.00            48 / 50             $4,300.00            14 Days             96.2%      |
|    (+2.4% vs Aug)       (96% complete)       (Full-Time)        (Approved)          (On-Time)     |
+-------------------------------------------------------------------+-------------------------------+
| CHART 1: Monthly Net Salary Trends (Last 6 Months)                | CHART 2: Cost by Department   |
| [ Area chart: Gross vs Net payout over April - September ]        | [ Bar/Donut: Eng $120k,       |
|                                                                   |   Sales $45k, Ops $25k, ...]  |
+-------------------------------------------------------------------+-------------------------------+
| OPERATIONAL SECTION A: Active Payroll Alerts                      | OPERATIONAL SECTION B:        |
| • ⚠ 2 Employees missing bank details for Oct cycle                | Department Overview Table     |
| • ℹ September Payrun validated and locked                         | Dept | Headcount | Total Cost |
| • 🏖 3 Employees on leave today (John, Maya, Sam)                 | Eng  |    24     |  $124,000  |
+-------------------------------------------------------------------+-------------------------------+
```

---

## 17. Critical User Journeys (End-to-End Traces)

### FLOW 1: The Master HR-to-Payroll Operational Pipeline
1. **Employee Creation:** HR creates new employee profile *Maya Lin* (`SCR-04` → `SCR-05`).
2. **Contract Binding:** HR attaches active contract with wage `$6,000/mo`, assigned to `Standard Salary Structure` (`SCR-06`).
3. **Schedule Assignment:** Maya is mapped to `40-Hour Working Schedule` (`SCR-07`).
4. **Attendance Logging:** Daily check-ins aggregate 19 worked days out of 20 (`SCR-08`).
5. **Time Off Impact:** Maya has 1 approved unpaid absence recorded in Time Off (`SCR-09A`).
6. **Payrun Initiation:** Payroll Manager launches Payrun Wizard for September (`SCR-12`).
7. **Automated Computation:** System computes Maya's gross, applies unpaid absence deduction formula, calculates tax, and outputs net pay `$5,120` (`SCR-13`).
8. **Validation & Payout:** Manager validates payrun, marks paid, and dispatches payslip (`SCR-13` → `SCR-14`).

### FLOW 2: Time Off Allocation, Request, Approval & Balance Reduction
1. **Allocation Provision:** HR allocates 15 days of `Annual Paid Leave` to employee (`SCR-09B`).
2. **Employee Request:** Employee requests 3 days leave from `2026-09-15` to `2026-09-17` (`SCR-09A`).
3. **Manager Review:** Manager opens request modal; UI shows: `Current Balance: 15d` → `After Approval: 12d`.
4. **Approval Action:** Manager clicks `[Approve]`.
5. **Balance Deduction:** Allocation balance instantly decrements to 12 days; status badge turns Green `Approved`.
6. **Payroll Sync:** Because the leave type is configured as `Paid`, no deduction is flagged for the payrun engine.

### FLOW 3: Executive Payroll Audit & Drill-Down
1. **Dashboard Alert:** Executive views Dashboard (`SCR-03`) and notices Engineering department cost increased +15%.
2. **Filter Trigger:** Selects `Department: Engineering` in the filter bar.
3. **Payrun Drill-Down:** Clicks into latest Payrun (`SCR-13`) filtered by Engineering.
4. **Anomaly Identification:** Spots overtime allowance badge on 4 senior engineers due to weekend release.
5. **Voucher Inspection:** Clicks individual payslip to inspect exact overtime formula breakdown (`SCR-14`).

---

## 18. Suggested Design System Specifications

### Color Palette (Tailored Modern Enterprise Theme)
- **Primary / Brand:** Indigo
  - `primary-50`: `#EEF2FF` (Hover backgrounds, active pills)
  - `primary-500`: `#6366F1` (Interactive focus rings, accents)
  - `primary-600`: `#4F46E5` (Primary buttons, active sidebar items)
  - `primary-700`: `#4338CA` (Button hover states)
- **Slate Neutrals (Clean Enterprise SaaS):**
  - `slate-50`: `#F8FAFC` (App body background)
  - `slate-100`: `#F1F5F9` (Card borders, table headers)
  - `slate-200`: `#E2E8F0` (Dividers, input borders)
  - `slate-600`: `#475569` (Subtitles, muted labels)
  - `slate-900`: `#0F172A` (Primary headings, high-contrast text)
- **Semantic Accents:**
  - `emerald-600`: `#059669` (Success, Paid, Active, Present)
  - `amber-500`: `#F59E0B` (Warning, Pending, Late, Probation)
  - `rose-600`: `#E11D48` (Danger, Refused, Absent, Error)
  - `sky-500`: `#0EA5E9` (Future contracts, informational tags)

### Typography Hierarchy
- **Font Family:** `Inter`, `Plus Jakarta Sans`, or system `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- **Scale:**
  - `H1 / Page Title:` `24px` (`font-bold`, tracking `-0.02em`)
  - `H2 / Section Title:` `18px` (`font-semibold`)
  - `H3 / Card Header:` `15px` (`font-semibold`)
  - `Body Regular:` `14px` (`font-normal`, leading `1.5`)
  - `Small / Captions / Badges:` `12px` (`font-medium`)
  - `Data / Monospace (Wages, Codes):` `13px` (`font-mono`)

### Spacing, Radii & Shadows
- **Border Radius:** `rounded-lg` (`8px`) for cards, buttons, inputs; `rounded-full` for badges & avatar pills.
- **Card Styling:** `bg-white border border-slate-200 shadow-sm`.
- **Elevation / Modals:** `shadow-xl border border-slate-200`.

---

## 19. Mobile & Responsive Priorities

Because this is an operational enterprise platform being built in a 24-hour hackathon, **Desktop (1280px+) is the primary demo target**. However, implement these responsive safeguards:
1. **Sidebar:** Automatically collapses into an icon rail on tablet (`<1024px`) and a slide-over mobile drawer on phone (`<768px`).
2. **Tables:** Horizontal scroll with sticky first column (Employee Name & Avatar stay pinned while scrolling wide payroll figures).
3. **KPI Cards:** Collapse from 5 columns on desktop → 2 columns on tablet → 1 column on mobile.
4. **Smart Stat Pills:** Wrap gracefully onto two lines on smaller viewports.
5. **Payslip Voucher:** Fixed container width with CSS media query `@media print` ensuring clean 1-page A4 PDF output without sidebar/headers.

---

## 20. UI Implementation Priority Order (24-Hour Hackathon Roadmap)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: FOUNDATION & CENTRAL HUB (Hours 0 - 6)                            │
│ [MUST BUILD]                                                                │
│ 1. App Shell Layout (Sidebar, Topbar, Breadcrumbs, Role Persona Switcher)   │
│ 2. Design System Tokens & Base Components (Button, Input, Badge, Table)     │
│ 3. Employee Directory Screen (Search, Filter, Table View)                   │
│ 4. Employee 360 Hub Screen (Personal info tabs + Smart Stat Action Pills)   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: OPERATIONAL INPUTS & HR LOGIC (Hours 6 - 12)                       │
│ [MUST BUILD]                                                                │
│ 5. Contract Management Screen (Active / Historical Badges, Wage setup)      │
│ 6. Working Schedule Config (7-Day Matrix with dynamic 40h calculation)      │
│ 7. Attendance Screen (Check-in/out logs, Worked hours, Status badges)       │
│ 8. Time Off Requests & Approval Modal (Live balance reduction feedback)     │
│ [SHOULD BUILD] Time Off Allocations & Leave Type Config                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: THE PAYROLL ENGINE — CORE DEMO VALUE (Hours 12 - 18)               │
│ [MUST BUILD]                                                                │
│ 9.  Salary Structures & Rules Config (Ordered rule list: Basic → Gross → Net)│
│ 10. Payrun 2-Step Wizard (Scope Selection → Eligible Employee Selection)   │
│ 11. Payrun Command Center (Stepper: Draft → Compute → Validate → Mark Paid) │
│ 12. Individual Payslip Voucher Screen (Itemized Earnings/Deductions + PDF)  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: EXECUTIVE DASHBOARD & POLISH (Hours 18 - 22)                       │
│ [MUST BUILD]                                                                │
│ 13. Executive Dashboard (5 Top KPIs + Payroll Alerts + Dept Cost Chart)     │
│ 14. Pre-Validation Warnings (Missing bank details / Missing contract alerts)│
│ [SHOULD BUILD] Monthly Net Salary Trend Chart & Dept Breakdown Table        │
│ [NICE TO HAVE] Admin RBAC permission matrix                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: DEMO SEED DATA & PRESENTATION DRY-RUN (Hours 22 - 24)              │
│ 15. Seed realistic demo data (48 employees across 4 depts with real wages)  │
│ 16. Rehearse Flow 1, Flow 2, and Flow 3 end-to-end                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## UI Execution Checklist (Actionable Tracker for Jay & Pavan)

Use this checklist during your sprint:

### Shell & Common Components
- [ ] Base Theme configuration (Slate/Indigo palette, typography, radii)
- [ ] `<AppShell />` with collapsible sidebar, top bar, and breadcrumbs
- [ ] Quick-Persona Role Switcher in header for demo switching
- [ ] `<StatusBadge />` with semantic styling for all states
- [ ] `<SmartStatPill />` component with count & badge indicator
- [ ] `<DataTable />` with search, department filter, and pagination
- [ ] `<StepperWizard />` component for workflows

### Employee & HR Operations
- [ ] **SCR-04:** Employee List View with status badges and search
- [ ] **SCR-05:** Employee 360 Hub with profile details & 4 smart action pills
- [ ] **SCR-06:** Contract Form & List (Active / Future / Historical badges)
- [ ] **SCR-07:** Working Schedule 7-day configuration with dynamic weekly hours
- [ ] **SCR-08:** Attendance Registry with status badges (`Present`, `Late`, `Absent`, `Overtime`)
- [ ] **SCR-09:** Time Off Requests screen with Approve / Refuse balance preview modal

### Payroll Engine & Workflows
- [ ] **SCR-10:** Salary Structure detail view showing sequential rule ordering
- [ ] **SCR-11:** Salary Rule creation form with dynamic Fixed/Percentage/Formula fields
- [ ] **SCR-12:** Payrun 2-Step Wizard (Scope config → Eligible employee multi-select)
- [ ] **SCR-13:** Payrun Processing Screen with 5-stage stepper (`Draft` → `Paid`)
- [ ] **SCR-13:** Payrun warnings banner (missing bank details, 0 attendance days)
- [ ] **SCR-14:** Printable Payslip voucher with side-by-side earnings & deductions

### Executive Intelligence & Demo Readiness
- [ ] **SCR-03:** Dashboard with 5 KPI cards (Net Salary, Payslips, Avg Salary, Leaves, Attendance)
- [ ] **SCR-03:** Salary Cost by Department chart & Monthly Trend chart
- [ ] Pre-populate rich seed data (Employees with contracts, attendance logs, approved leaves)
- [ ] End-to-end dry run: Employee → Schedule → Attendance → Time Off → Payrun → Payslip
