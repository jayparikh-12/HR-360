# PeoplePay360 Database Setup

This folder contains the complete relational schema and initial seed data for the hackathon.

## Files
- `schema.sql`: Full SQL schema for employees, contracts, working schedules, attendance, time-off, salary rules, payruns, and payslips.
- `seeds.sql`: Pre-populated initial seed data matching the demo workflow.

## Quick Setup with SQLite
```bash
sqlite3 peoplepay360.db < schema.sql
sqlite3 peoplepay360.db < seeds.sql
```

## Quick Setup with PostgreSQL
```bash
psql -U postgres -d peoplepay360 -f schema.sql
psql -U postgres -d peoplepay360 -f seeds.sql
```
