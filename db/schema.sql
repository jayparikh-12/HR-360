-- ============================================================================
-- PeoplePay360 Relational Database Schema
-- Normalized to Boyce-Codd Normal Form (BCNF) minimum.
-- Explicit FOREIGN KEY constraints replace inert inline REFERENCES clauses.
-- Hardened for Referential Integrity, Domain Checks, and Historical Payroll Preservation.
-- ============================================================================

-- 1. Employees Table (In BCNF: Candidate keys are {id}, {email})
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    gender VARCHAR(20) DEFAULT NULL,
    dateOfBirth DATE DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, PROBATION, TERMINATED, INACTIVE
    join_date DATE NOT NULL,
    bank_name VARCHAR(100) DEFAULT NULL,
    bank_account VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_employees_dept_status (department, status)
);

-- 2. Working Schedules Table (In BCNF: Candidate keys are {id}, {name})
CREATE TABLE IF NOT EXISTS working_schedules (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    weekly_hours DECIMAL(5,2) DEFAULT 40.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_working_schedules_name UNIQUE (name)
);

-- 3. Salary Structures Table (In BCNF: Candidate keys are {id}, {code})
CREATE TABLE IF NOT EXISTS salary_structures (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Salary Rules Table (In BCNF: Candidate keys are {id}, {structure_id, code})
CREATE TABLE IF NOT EXISTS salary_rules (
    id VARCHAR(50) PRIMARY KEY,
    structure_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    sequence INT NOT NULL,
    category VARCHAR(50) NOT NULL, -- BASIC, ALLOWANCE, GROSS, DEDUCTION, NET
    calculation_type VARCHAR(50) NOT NULL, -- FIXED, PERCENTAGE, FORMULA
    amount DECIMAL(10,2),
    percentage DECIMAL(5,2),
    formula TEXT,
    CONSTRAINT uq_salary_rules_structure_code UNIQUE (structure_id, code),
    CONSTRAINT fk_salary_rules_structure FOREIGN KEY (structure_id)
        REFERENCES salary_structures(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- 5. Contracts Table (In BCNF: Candidate key is {id})
CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    salary_structure_id VARCHAR(50) NOT NULL,
    working_schedule_id VARCHAR(50) NOT NULL,
    wage DECIMAL(12,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, FUTURE, HISTORICAL
    CONSTRAINT fk_contracts_employee FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_contracts_salary_structure FOREIGN KEY (salary_structure_id)
        REFERENCES salary_structures(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_contracts_working_schedule FOREIGN KEY (working_schedule_id)
        REFERENCES working_schedules(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT chk_contracts_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT chk_contracts_wage CHECK (wage >= 0),
    INDEX idx_contracts_emp_status (employee_id, status)
);

-- 6. Attendance Table (In BCNF: Candidate key is {id})
CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    check_in VARCHAR(20),
    check_out VARCHAR(20),
    worked_hours DECIMAL(4,2) DEFAULT 0.0,
    status VARCHAR(30) DEFAULT 'PRESENT', -- PRESENT, LATE, ABSENT, OVERTIME, MISSING_CHECKOUT
    CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_attendance_worked_hours CHECK (worked_hours >= 0),
    INDEX idx_attendance_emp_date (employee_id, date),
    INDEX idx_attendance_date (date),
    INDEX idx_attendance_date_status (date, status)
);

-- 7. Time Off Requests Table (In BCNF: Candidate key is {id})
CREATE TABLE IF NOT EXISTS time_off_requests (
    id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    leave_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days INT NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, REFUSED
    CONSTRAINT fk_time_off_employee FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_time_off_dates CHECK (end_date >= start_date),
    INDEX idx_time_off_emp_status (employee_id, status),
    INDEX idx_time_off_dates (start_date, end_date),
    INDEX idx_time_off_status (status)
);

-- 8. Payruns Table (In BCNF: Candidate key is {id})
CREATE TABLE IF NOT EXISTS payruns (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    period VARCHAR(100) NOT NULL,
    salary_structure_id VARCHAR(50),
    total_gross DECIMAL(14,2) DEFAULT 0.0,
    total_net DECIMAL(14,2) DEFAULT 0.0,
    employee_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, COMPUTED, VALIDATED, PAID
    validated_at TIMESTAMP NULL,
    validated_by VARCHAR(100) NULL,
    paid_at TIMESTAMP NULL,
    paid_by VARCHAR(100) NULL,
    payment_reference VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payruns_salary_structure FOREIGN KEY (salary_structure_id)
        REFERENCES salary_structures(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    INDEX idx_payruns_period_status (period, status),
    INDEX idx_payruns_status (status)
);

-- 9. Payslips Table (In BCNF: Candidate keys are {id}, {payrun_id, employee_id})
-- Note: Redundant transitive columns employee_name and department are eliminated to satisfy BCNF.
-- Employee details are joined from employees at query time.
-- Historical calculation snapshots & structured breakdowns (Phase 5.1) are persisted for immutability.
-- fk_payslips_employee enforces ON DELETE RESTRICT to guarantee historical payroll records are never accidentally destroyed.
CREATE TABLE IF NOT EXISTS payslips (
    id VARCHAR(50) PRIMARY KEY,
    payrun_id VARCHAR(50) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    period_start DATE NULL,
    period_end DATE NULL,
    contract_wage DECIMAL(12,2) NULL,
    basic DECIMAL(12,2) NOT NULL,
    hra DECIMAL(12,2) NOT NULL,
    allowance DECIMAL(12,2) NOT NULL,
    gross DECIMAL(12,2) NOT NULL,
    tax DECIMAL(12,2) NOT NULL,
    other_deductions DECIMAL(12,2) NOT NULL,
    net DECIMAL(12,2) NOT NULL,
    earnings_breakdown JSON NULL,
    deductions_breakdown JSON NULL,
    calculation_snapshot JSON NULL,
    calculation_timestamp TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    calculation_version INT NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, COMPUTED, VALIDATED, PAID
    warning TEXT,
    CONSTRAINT uq_payslips_payrun_employee UNIQUE (payrun_id, employee_id),
    CONSTRAINT fk_payslips_payrun FOREIGN KEY (payrun_id)
        REFERENCES payruns(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_payslips_employee FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    INDEX idx_payslips_employee_period (employee_id, period_start),
    INDEX idx_payslips_status (status)
);

-- 10. Users Table (Authentication, Credentials, and RBAC Roles)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    employee_id VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_employee FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    INDEX idx_users_email (email)
);
