-- ============================================================================
-- PeoplePay360 Relational Database Schema
-- Normalized to Boyce-Codd Normal Form (BCNF) minimum.
-- Explicit FOREIGN KEY constraints replace inert inline REFERENCES clauses.
-- ============================================================================

-- 1. Employees Table (In BCNF: Candidate keys are {id}, {email})
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    gender VARCHAR(20) DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, PROBATION, TERMINATED
    join_date DATE NOT NULL,
    bank_account VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        ON UPDATE CASCADE
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
        ON UPDATE CASCADE
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
        ON UPDATE CASCADE
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payruns_salary_structure FOREIGN KEY (salary_structure_id)
        REFERENCES salary_structures(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

-- 9. Payslips Table (In BCNF: Candidate keys are {id}, {payrun_id, employee_id})
-- Note: Redundant transitive columns employee_name and department are eliminated to satisfy BCNF.
-- Employee details are joined from employees at query time.
CREATE TABLE IF NOT EXISTS payslips (
    id VARCHAR(50) PRIMARY KEY,
    payrun_id VARCHAR(50) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    basic DECIMAL(12,2) NOT NULL,
    hra DECIMAL(12,2) NOT NULL,
    allowance DECIMAL(12,2) NOT NULL,
    gross DECIMAL(12,2) NOT NULL,
    tax DECIMAL(12,2) NOT NULL,
    other_deductions DECIMAL(12,2) NOT NULL,
    net DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, COMPUTED, VALIDATED, PAID
    warning TEXT,
    CONSTRAINT uq_payslips_payrun_employee UNIQUE (payrun_id, employee_id),
    CONSTRAINT fk_payslips_payrun FOREIGN KEY (payrun_id)
        REFERENCES payruns(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_payslips_employee FOREIGN KEY (employee_id)
        REFERENCES employees(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
