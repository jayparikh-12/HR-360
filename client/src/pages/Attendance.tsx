import React, { useState, useEffect, useCallback } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
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
    // Determine if current user has an open active check-in using their canonical employee ID
    const empId = user?.employeeId || (user?.id?.startsWith('EMP-') ? user.id : undefined);
    if (!empId) {
      setIsCheckedIn(false);
      setActiveRecord(null);
      return;
    }

    const active = fetchedRecords.find(
      (r) =>
        r.employeeId === empId &&
        r.status !== 'ABSENT' &&
        r.checkIn &&
        r.checkIn !== '—' &&
        (r.checkOut === 'Active' || !r.checkOut || r.checkOut === '—' || r.checkOut.trim() === '')
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
      console.error('[Attendance Page] Failed to fetch records:', err instanceof Error ? err.message : String(err));
      setError(err instanceof ApiError ? err.message : 'Unable to load attendance records. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [syncActiveState]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const getSystemTime = (): string => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const getSystemDate = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const handleToggleCheck = async () => {
    if (submitting) return;

    const empId = user?.employeeId || (user?.id?.startsWith('EMP-') ? user.id : undefined);
    if (!empId) {
      setError('Clock-in / clock-out is designated for staff employee profiles. This administrator account oversees organization-wide attendance records below.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (!isCheckedIn) {
        // Clock In with exact system time
        const currentTime = getSystemTime();
        const currentDate = getSystemDate();
        const created = await attendanceApi.checkIn({
          employeeId: empId,
          checkIn: currentTime,
          date: currentDate,
        });
        await loadAttendance();
        onAddRecord?.(created);
      } else {
        // Clock Out with exact system time
        const currentTime = getSystemTime();
        await attendanceApi.checkOut({
          recordId: activeRecord?.id,
          employeeId: empId,
          checkOut: currentTime,
        });
        await loadAttendance();
      }
    } catch (err) {
      console.error('[Attendance Action] Error toggling check state:', err instanceof Error ? err.message : String(err));
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

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadAttendance}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh attendance from database"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

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
      </div>

      {error && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '8px', fontSize: '13px', color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'transparent', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 600, fontSize: '16px', lineHeight: 1 }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card">
          <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Present Today</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} />
          </div>
          <div className="metric-val" style={{ color: '#059669' }}>{presentCount} Staff</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>On-schedule & active check-ins</div>
        </div>
        <div className="card">
          <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Late Arrivals</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706' }} />
          </div>
          <div className="metric-val" style={{ color: '#d97706' }}>{lateCount} Staff</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>Clocked in past grace period</div>
        </div>
        <div className="card">
          <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Overtime Shifts</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />
          </div>
          <div className="metric-val" style={{ color: 'var(--primary)' }}>{overtimeCount} Staff</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>Shift duration exceeding 8 hrs</div>
        </div>
        <div className="card">
          <div className="metric-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Absences Recorded</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e11d48' }} />
          </div>
          <div className="metric-val" style={{ color: '#e11d48' }}>{absentCount} Staff</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>No check-in or approved leave</div>
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
