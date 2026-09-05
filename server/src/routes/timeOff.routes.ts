import { Router } from 'express';

const router = Router();

export let timeOffRequests = [
  { id: 'TO-201', employeeId: 'EMP-001', employeeName: 'John Doe', leaveType: 'Paid Annual Leave', startDate: '2026-09-12', endDate: '2026-09-15', durationDays: 3, reason: 'Family trip', status: 'PENDING' },
  { id: 'TO-202', employeeId: 'EMP-002', employeeName: 'Maya Lin', leaveType: 'Sick Leave', startDate: '2026-09-02', endDate: '2026-09-02', durationDays: 1, reason: 'Medical appointment', status: 'APPROVED' },
  { id: 'TO-203', employeeId: 'EMP-006', employeeName: 'Sarah Connor', leaveType: 'Unpaid Leave', startDate: '2026-09-05', endDate: '2026-09-05', durationDays: 1, reason: 'Personal emergency', status: 'APPROVED' },
];

router.get('/', (_req, res) => {
  res.json({ success: true, data: timeOffRequests });
});

router.patch('/:id/approve', (req, res) => {
  const reqItem = timeOffRequests.find((r) => r.id === req.params.id);
  if (!reqItem) return res.status(404).json({ success: false, message: 'Request not found' });
  reqItem.status = 'APPROVED';
  res.json({ success: true, data: reqItem });
});

router.patch('/:id/refuse', (req, res) => {
  const reqItem = timeOffRequests.find((r) => r.id === req.params.id);
  if (!reqItem) return res.status(404).json({ success: false, message: 'Request not found' });
  reqItem.status = 'REFUSED';
  res.json({ success: true, data: reqItem });
});

export default router;
