import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import type { AttendanceRecord } from '../types';

interface AttendanceProps {
  attendanceRecords: AttendanceRecord[];
  onAddRecord: (record: AttendanceRecord) => void;
}

export const Attendance: React.FC<AttendanceProps> = ({ attendanceRecords, onAddRecord }) => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>(attendanceRecords);

  const handleToggleCheck = () => {
    if (!isCheckedIn) {
      setIsCheckedIn(true);
      const newRec: AttendanceRecord = {
        id: `ATT-${Date.now().toString().slice(-3)}`,
        employeeId: 'EMP-001',
        employeeName: 'John Doe',
        date: new Date().toISOString().split('T')[0],
        checkIn: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        checkOut: 'Active',
        workedHours: 0,
        status: 'PRESENT',
      };
      setRecords([newRec, ...records]);
      onAddRecord(newRec);
    } else {
      setIsCheckedIn(false);
      const updated = records.map((r, i) =>
        i === 0 ? { ...r, checkOut: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), workedHours: 8.0 } : r
      );
      setRecords(updated);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <span className="badge badge-success"><span className="badge-dot" />Present</span>;
      case 'LATE':
        return <span className="badge badge-warning"><span className="badge-dot" />Late</span>;
      case 'OVERTIME':
        return <span className="badge badge-info"><span className="badge-dot" />Overtime</span>;
      case 'ABSENT':
        return <span className="badge badge-danger"><span className="badge-dot" />Absent</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Registry</h1>
          <p className="page-desc">Daily check-in and check-out logs feeding into the payroll overtime and absence engine.</p>
        </div>

        {/* Live Check-in / Out Widget */}
        <button
          className={`btn ${isCheckedIn ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleToggleCheck}
        >
          <Clock size={15} />
          <span>{isCheckedIn ? 'Clock Out (08h 12m active)' : 'Self Check-In Now'}</span>
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <div className="card">
          <div className="metric-title">Present Today</div>
          <div className="metric-val" style={{ color: '#047857' }}>4 Staff</div>
        </div>
        <div className="card">
          <div className="metric-title">Late Arrivals</div>
          <div className="metric-val" style={{ color: '#b45309' }}>1 Staff</div>
        </div>
        <div className="card">
          <div className="metric-title">Overtime Shifts</div>
          <div className="metric-val" style={{ color: 'var(--primary)' }}>1 Staff</div>
        </div>
        <div className="card">
          <div className="metric-title">Absences Recorded</div>
          <div className="metric-val" style={{ color: '#be123c' }}>1 Staff</div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Worked Hours</th>
              <th>Compliance Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((rec) => (
              <tr key={rec.id}>
                <td style={{ fontWeight: 600 }}>{rec.employeeName}</td>
                <td style={{ color: 'var(--slate-500)' }}>{rec.date}</td>
                <td>{rec.checkIn}</td>
                <td>{rec.checkOut}</td>
                <td style={{ fontWeight: 600 }}>{rec.workedHours > 0 ? `${rec.workedHours} hrs` : 'In Progress'}</td>
                <td>{getStatusBadge(rec.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
