import { Router } from 'express';

const router = Router();

export let contracts = [
  { id: 'CON-001', employeeId: 'EMP-001', employeeName: 'John Doe', wage: 6500, structure: 'Standard Full-Time', schedule: 'Standard 40h', status: 'ACTIVE' },
  { id: 'CON-002', employeeId: 'EMP-002', employeeName: 'Maya Lin', wage: 7200, structure: 'Executive Full-Time', schedule: 'Standard 40h', status: 'ACTIVE' },
  { id: 'CON-003', employeeId: 'EMP-003', employeeName: 'Alex Rivera', wage: 5200, structure: 'Standard Full-Time', schedule: 'Standard 40h', status: 'ACTIVE' },
];

router.get('/', (_req, res) => {
  res.json({ success: true, data: contracts });
});

router.post('/', (req, res) => {
  const newContract = { id: `CON-${Date.now().toString().slice(-3)}`, ...req.body };
  contracts.push(newContract);
  res.status(201).json({ success: true, data: newContract });
});

export default router;
