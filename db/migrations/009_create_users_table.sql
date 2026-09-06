-- ============================================================================
-- PeoplePay360 Database Migration 009
-- Purpose: Add users table for authentication and RBAC roles with seeded admin
-- ============================================================================

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
