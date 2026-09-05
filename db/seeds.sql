-- PeoplePay360 Initial Seed Data

-- Employees
INSERT INTO employees (id, name, email, department, position, status, join_date, bank_account) VALUES
('EMP-001', 'John Doe', 'john.doe@company.com', 'Engineering', 'Senior Backend Engineer', 'ACTIVE', '2023-03-15', '•••• 4921'),
('EMP-002', 'Maya Lin', 'maya.lin@company.com', 'Product', 'Lead Product Manager', 'ACTIVE', '2022-08-01', '•••• 8832'),
('EMP-003', 'Alex Rivera', 'alex.rivera@company.com', 'Finance', 'Senior Payroll Specialist', 'ACTIVE', '2024-01-10', '•••• 1209'),
('EMP-004', 'Elena Rostova', 'elena.r@company.com', 'Human Resources', 'HR Director', 'ACTIVE', '2021-06-15', '•••• 3490'),
('EMP-005', 'David Kim', 'david.kim@company.com', 'Engineering', 'DevOps Architect', 'PROBATION', '2026-07-01', '•••• 7712'),
('EMP-006', 'Sarah Connor', 'sarah.c@company.com', 'Operations', 'Site Reliability Lead', 'ACTIVE', '2023-11-20', '•••• 6620');

-- Schedules
INSERT INTO working_schedules (id, name, weekly_hours) VALUES
('SCH-001', 'Standard 40h Regular', 40.0),
('SCH-002', 'Flexible Engineering', 40.0);

-- Salary Structures
INSERT INTO salary_structures (id, name, code) VALUES
('STR-001', 'Standard Full-Time Tech', 'TECH_STD');

-- Salary Rules
INSERT INTO salary_rules (id, structure_id, name, code, sequence, category, calculation_type, percentage) VALUES
('RUL-01', 'STR-001', 'Basic Salary', 'BASIC', 1, 'BASIC', 'PERCENTAGE', 60.0),
('RUL-02', 'STR-001', 'House Rent Allowance', 'HRA', 2, 'ALLOWANCE', 'PERCENTAGE', 25.0),
('RUL-03', 'STR-001', 'Special Allowance', 'ALLOWANCE', 3, 'ALLOWANCE', 'PERCENTAGE', 15.0),
('RUL-04', 'STR-001', 'Income Tax', 'TAX', 4, 'DEDUCTION', 'PERCENTAGE', 10.0),
('RUL-05', 'STR-001', 'Social Security / PF', 'PF', 5, 'DEDUCTION', 'PERCENTAGE', 7.0);

-- Contracts
INSERT INTO contracts (id, employee_id, salary_structure_id, working_schedule_id, wage, start_date, status) VALUES
('CON-001', 'EMP-001', 'STR-001', 'SCH-001', 6500.00, '2023-03-15', 'ACTIVE'),
('CON-002', 'EMP-002', 'STR-001', 'SCH-001', 7200.00, '2022-08-01', 'ACTIVE'),
('CON-003', 'EMP-003', 'STR-001', 'SCH-001', 5200.00, '2024-01-10', 'ACTIVE'),
('CON-004', 'EMP-004', 'STR-001', 'SCH-001', 8000.00, '2021-06-15', 'ACTIVE'),
('CON-005', 'EMP-005', 'STR-001', 'SCH-002', 6800.00, '2026-07-01', 'ACTIVE'),
('CON-006', 'EMP-006', 'STR-001', 'SCH-001', 6300.00, '2023-11-20', 'ACTIVE');
