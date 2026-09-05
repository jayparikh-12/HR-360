import React, { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import type { AttendanceRecord } from '../types';
import { attendanceApi } from '../api/attendance';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface AttendanceProps {
  attendanceRecords?: AttendanceRecord[];
  onAddRecord?: (record: AttendanceRecord) => void;
}

export const Attendance: React.FC<AttendanceProps> = ({ onAddRecord }) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(false);
  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const syncActiveState = useCallback((fetchedRecords: AttendanceRecord[]) => {
    // Determine if current user has an open active check-in
    const active = fetchedRecords.find(
      (r) =>
        (r.employeeId === user?.employeeId ||
          r.employeeName.toLowerCase() === (user?.name || '').toLowerCase() ||
          r.employeeId === user?.id) &&
        (r.checkOut === 'Active' || !r.checkOut || r.checkOut === '—' || r.workedHours === 0)
    );

    if (active) {
      setIsCheckedIn(true);
      setActiveRecord(active);
    } else {
      setIsCheckedIn(false);
      setActiveRecord(null);
    }
  }, [user]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await attendanceApi.getAll();
      setRecords(data);
      syncActiveState(data);
    } catch (err) {
      console.error('[Attendance Page] Failed to fetch records:', err);
      setError(err instanceof ApiError ? err.message : 'Unable to load attendance records. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [syncActiveState]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleToggleCheck = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      if (!isCheckedIn) {
        // Clock In
        const created = await attendanceApi.checkIn({
          employeeId: user?.employeeId || user?.id,
        });
        await loadAttendance();
        onAddRecord?.(created);
      } else {
        // Clock Out
        await attendanceApi.checkOut({
          recordId: activeRecord?.id,
          employeeId: user?.employeeId || user?.id,
        });
        await loadAttendance();
      }
    } catch (err) {
      console.error('[Attendance Action] Error toggling check state:', err);
      setError(err instanceof ApiError ? err.message : 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
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

  // Metrics summary
  const hasTodayRecords = records.some((r) => r.date === todayStr);
  const targetDataset = hasTodayRecords ? records.filter((r) => r.date === todayStr) : records;

  const presentCount = targetDataset.filter((r) => r.status === 'PRESENT' || r.status === 'OVERTIME' || r.status === 'LATE').length;
  const lateCount = targetDataset.filter((r) => r.status === 'LATE').length;
  const overtimeCount = targetDataset.filter((r) => r.status === 'OVERTIME').length;
  const absentCount = targetDataset.filter((r) => r.status === 'ABSENT').length;

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
          disabled={submitting}
        >
          <Clock size={15} />
          <span>
            {submitting
              ? 'Processing...'
              : isCheckedIn
              ? 'Clock Out (Active Session)'
              : 'Self Check-In Now'}
          </span>
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '8px', fontSize: '13px', color: '#991b1b' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Summary Row */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <div className="card">
          <div className="metric-title">Present Today</div>
          <div className="metric-val" style={{ color: '#047857' }}>{presentCount} Staff</div>
        </div>
        <div className="card">
          <div className="metric-title">Late Arrivals</div>
          <div className="metric-val" style={{ color: '#b45309' }}>{lateCount} Staff</div>
        </div>
        <div className="card">
          <div className="metric-title">Overtime Shifts</div>
          <div className="metric-val" style={{ color: 'var(--primary)' }}>{overtimeCount} Staff</div>
        </div>
        <div className="card">
          <div className="metric-title">Absences Recorded</div>
          <div className="metric-val" style={{ color: '#be123c' }}>{absentCount} Staff</div>
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
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate-400)' }}>
                  Loading attendance records from database...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate-400)' }}>
                  No attendance records found in database. Click "Self Check-In Now" to clock in.
                </td>
              </tr>
            ) : (
              records.map((rec) => (
                <tr key={rec.id}>
                  <td style={{ fontWeight: 600 }}>{rec.employeeName}</td>
                  <td style={{ color: 'var(--slate-500)' }}>{rec.date}</td>
                  <td>{rec.checkIn}</td>
                  <td>{rec.checkOut}</td>
                  <td style={{ fontWeight: 600 }}>{rec.workedHours > 0 ? `${rec.workedHours} hrs` : 'In Progress'}</td>
                  <td>{getStatusBadge(rec.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
