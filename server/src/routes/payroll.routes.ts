import { Router } from 'express';
import { PayrollEngine } from '../services/payrollEngine.js';

// Local in-memory employee list used by the payroll engine.
// Phase 2.2 removes the exported `employees` array from employee.routes;
// payroll persistence will be wired in a later phase.
const employees = [
  { id: 'EMP-001', name: 'John Doe', department: 'Engineering', wage: 6500 },
  { id: 'EMP-002', name: 'Maya Lin', department: 'Product', wage: 7200 },
  { id: 'EMP-003', name: 'Alex Rivera', department: 'Finance', wage: 5200 },
  { id: 'EMP-004', name: 'Elena Rostova', department: 'Human Resources', wage: 8000 },
  { id: 'EMP-005', name: 'David Kim', department: 'Engineering', wage: 6800 },
  { id: 'EMP-006', name: 'Sarah Connor', department: 'Operations', wage: 6300 },
];

const router = Router();

export let payruns: any[] = [
  {
    id: 'PR-2026-09',
    name: 'September 2026 Regular Cycle',
    period: 'Sep 01 – Sep 30, 2026',
    salaryStructure: 'Standard Full-Time Tech',
    totalGross: 40000,
    totalNet: 33450,
    employeeCount: 6,
    status: 'COMPUTED',
    payslips: employees.map((emp) => PayrollEngine.compute({
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      monthlyWage: emp.wage,
      unpaidDays: emp.name === 'Sarah Connor' ? 1 : 0,
    })),
  },
];

router.get('/payruns', (_req, res) => {
  res.json({ success: true, data: payruns });
});

router.post('/payruns/create', (req, res) => {
  const { name, period, salaryStructure, employeeIds } = req.body;
  const targetEmployees = employees.filter((e) => !employeeIds || employeeIds.includes(e.id));

  const computedPayslips = targetEmployees.map((emp) =>
    PayrollEngine.compute({
      employeeId: emp.id,
      employeeName: emp.name,
      department: emp.department,
      monthlyWage: emp.wage,
    })
  );

  const totalGross = computedPayslips.reduce((a: number, b: { gross: number }) => a + b.gross, 0);
  const totalNet = computedPayslips.reduce((a: number, b: { net: number }) => a + b.net, 0);

  const newPayrun = {
    id: `PR-${Date.now().toString().slice(-4)}`,
    name: name || 'Custom Payrun Cycle',
    period: period || 'Active Period',
    salaryStructure: salaryStructure || 'Standard Tech',
    totalGross,
    totalNet,
    employeeCount: computedPayslips.length,
    status: 'COMPUTED',
    payslips: computedPayslips,
  };

  payruns.unshift(newPayrun);
  res.status(201).json({ success: true, data: newPayrun });
});

router.patch('/payruns/:id/validate', (req, res) => {
  const pr = payruns.find((p) => p.id === req.params.id);
  if (!pr) return res.status(404).json({ success: false, message: 'Payrun not found' });
  pr.status = 'VALIDATED';
  res.json({ success: true, data: pr });
});

router.patch('/payruns/:id/pay', (req, res) => {
  const pr = payruns.find((p) => p.id === req.params.id);
  if (!pr) return res.status(404).json({ success: false, message: 'Payrun not found' });
  pr.status = 'PAID';
  res.json({ success: true, data: pr });
});

export default router;
