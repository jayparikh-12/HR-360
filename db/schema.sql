-- PeoplePay360 Relational Database Schema
-- Compatible with SQLite, PostgreSQL, and MySQL

-- 1. Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, PROBATION, TERMINATED
    join_date DATE NOT NULL,
    bank_account VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Working Schedules Table
CREATE TABLE IF NOT EXISTS working_schedules (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    weekly_hours DECIMAL(5,2) DEFAULT 40.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Salary Structures Table
CREATE TABLE IF NOT EXISTS salary_structures (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Salary Rules Table (Ordered calculation precedence)
CREATE TABLE IF NOT EXISTS salary_rules (
    id VARCHAR(50) PRIMARY KEY,
    structure_id VARCHAR(50) REFERENCES salary_structures(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    sequence INT NOT NULL,
    category VARCHAR(50) NOT NULL, -- BASIC, ALLOWANCE, GROSS, DEDUCTION, NET
    calculation_type VARCHAR(50) NOT NULL, -- FIXED, PERCENTAGE, FORMULA
    amount DECIMAL(10,2),
    percentage DECIMAL(5,2),
    formula TEXT
);

-- 5. Contracts Table
CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(id),
    salary_structure_id VARCHAR(50) REFERENCES salary_structures(id),
    working_schedule_id VARCHAR(50) REFERENCES working_schedules(id),
    wage DECIMAL(12,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE' -- ACTIVE, FUTURE, HISTORICAL
);

-- 6. Attendance Table
CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(id),
    date DATE NOT NULL,
    check_in VARCHAR(20),
    check_out VARCHAR(20),
    worked_hours DECIMAL(4,2) DEFAULT 0.0,
    status VARCHAR(30) DEFAULT 'PRESENT' -- PRESENT, LATE, ABSENT, OVERTIME, MISSING_CHECKOUT
);

-- 7. Time Off Requests Table
CREATE TABLE IF NOT EXISTS time_off_requests (
    id VARCHAR(50) PRIMARY KEY,
    employee_id VARCHAR(50) REFERENCES employees(id),
    leave_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days INT NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'PENDING' -- PENDING, APPROVED, REFUSED
);

-- 8. Payruns Table
CREATE TABLE IF NOT EXISTS payruns (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    period VARCHAR(100) NOT NULL,
    salary_structure_id VARCHAR(50) REFERENCES salary_structures(id),
    total_gross DECIMAL(14,2) DEFAULT 0.0,
    total_net DECIMAL(14,2) DEFAULT 0.0,
    employee_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, COMPUTED, VALIDATED, PAID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Payslips Table
CREATE TABLE IF NOT EXISTS payslips (
    id VARCHAR(50) PRIMARY KEY,
    payrun_id VARCHAR(50) REFERENCES payruns(id),
    employee_id VARCHAR(50) REFERENCES employees(id),
    basic DECIMAL(12,2) NOT NULL,
    hra DECIMAL(12,2) NOT NULL,
    allowance DECIMAL(12,2) NOT NULL,
    gross DECIMAL(12,2) NOT NULL,
    tax DECIMAL(12,2) NOT NULL,
    other_deductions DECIMAL(12,2) NOT NULL,
    net DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT' -- DRAFT, COMPUTED, VALIDATED, PAID
);
