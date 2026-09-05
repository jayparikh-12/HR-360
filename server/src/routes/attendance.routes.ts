import { Router } from 'express';

const router = Router();

export let attendanceRecords = [
  { id: 'ATT-101', employeeId: 'EMP-001', employeeName: 'John Doe', date: '2026-09-05', checkIn: '08:58 AM', checkOut: '05:45 PM', workedHours: 8.2, status: 'PRESENT' },
  { id: 'ATT-102', employeeId: 'EMP-002', employeeName: 'Maya Lin', date: '2026-09-05', checkIn: '09:22 AM', checkOut: '06:10 PM', workedHours: 8.0, status: 'LATE' },
  { id: 'ATT-103', employeeId: 'EMP-003', employeeName: 'Alex Rivera', date: '2026-09-05', checkIn: '08:45 AM', checkOut: '05:30 PM', workedHours: 8.0, status: 'PRESENT' },
  { id: 'ATT-104', employeeId: 'EMP-004', employeeName: 'Elena Rostova', date: '2026-09-05', checkIn: '09:00 AM', checkOut: '06:00 PM', workedHours: 8.0, status: 'PRESENT' },
  { id: 'ATT-105', employeeId: 'EMP-005', employeeName: 'David Kim', date: '2026-09-05', checkIn: '08:30 AM', checkOut: '07:15 PM', workedHours: 9.8, status: 'OVERTIME' },
  { id: 'ATT-106', employeeId: 'EMP-006', employeeName: 'Sarah Connor', date: '2026-09-05', checkIn: '—', checkOut: '—', workedHours: 0, status: 'ABSENT' },
];

router.get('/', (_req, res) => {
  res.json({ success: true, data: attendanceRecords });
});

router.post('/check-in', (req, res) => {
  const { employeeId, employeeName } = req.body;
  const newRec = {
    id: `ATT-${Date.now().toString().slice(-3)}`,
    employeeId: employeeId || 'EMP-001',
    employeeName: employeeName || 'John Doe',
    date: new Date().toISOString().split('T')[0],
    checkIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    checkOut: 'Active',
    workedHours: 0,
    status: 'PRESENT',
  };
  attendanceRecords.unshift(newRec);
  res.status(201).json({ success: true, data: newRec });
});

export default router;
