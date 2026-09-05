import { Router } from 'express';

const router = Router();

// In-memory demo store (connectable to SQL in db/)
export let employees = [
  { id: 'EMP-001', name: 'John Doe', email: 'john.doe@company.com', department: 'Engineering', position: 'Senior Backend Engineer', wage: 6500, status: 'ACTIVE' },
  { id: 'EMP-002', name: 'Maya Lin', email: 'maya.lin@company.com', department: 'Product', position: 'Lead Product Manager', wage: 7200, status: 'ACTIVE' },
  { id: 'EMP-003', name: 'Alex Rivera', email: 'alex.rivera@company.com', department: 'Finance', position: 'Senior Payroll Specialist', wage: 5200, status: 'ACTIVE' },
  { id: 'EMP-004', name: 'Elena Rostova', email: 'elena.r@company.com', department: 'Human Resources', position: 'HR Director', wage: 8000, status: 'ACTIVE' },
  { id: 'EMP-005', name: 'David Kim', email: 'david.kim@company.com', department: 'Engineering', position: 'DevOps Architect', wage: 6800, status: 'PROBATION' },
  { id: 'EMP-006', name: 'Sarah Connor', email: 'sarah.c@company.com', department: 'Operations', position: 'Site Reliability Lead', wage: 6300, status: 'ACTIVE' },
];

router.get('/', (_req, res) => {
  res.json({ success: true, data: employees });
});

router.get('/:id', (req, res) => {
  const emp = employees.find((e) => e.id === req.params.id);
  if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
  res.json({ success: true, data: emp });
});

router.post('/', (req, res) => {
  const newEmp = { id: `EMP-${Date.now().toString().slice(-3)}`, ...req.body };
  employees.push(newEmp);
  res.status(201).json({ success: true, data: newEmp });
});

export default router;
