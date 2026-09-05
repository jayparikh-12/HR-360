import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, Plus } from 'lucide-react';
import type { TimeOffRequest } from '../types';
import { timeOffApi } from '../api/timeOff';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface TimeOffProps {
  requests?: TimeOffRequest[];
  onApprove?: (id: string) => void;
  onRefuse?: (id: string) => void;
}

export const TimeOff: React.FC<TimeOffProps> = ({ onApprove, onRefuse }) => {
  const { user, displayRole } = useAuth();
  const canApprove = displayRole === 'Admin' || displayRole === 'HR Manager';
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [newModalOpen, setNewModalOpen] = useState<boolean>(false);

  // Modal Form State
  const [leaveType, setLeaveType] = useState<string>('Paid Annual Leave');
  const [startDate, setStartDate] = useState<string>('2026-09-20');
  const [endDate, setEndDate] = useState<string>('2026-09-22');
  const [reason, setReason] = useState<string>('Personal appointment');
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await timeOffApi.getAll();
      setRequests(data);
    } catch (err) {
      console.error('[TimeOff Page] Failed to fetch requests:', err);
      setError(err instanceof ApiError ? err.message : 'Unable to load time-off requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAction = async (id: string, newStatus: 'APPROVED' | 'REFUSED') => {
    if (actionLoadingId) return;
    setActionLoadingId(id);
    setError(null);
    try {
      if (newStatus === 'APPROVED') {
        const updated = await timeOffApi.approve(id);
        setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
        onApprove?.(id);
      } else {
        const updated = await timeOffApi.refuse(id);
        setRequests((prev) => prev.map((r) => (r.id === id ? updated : r)));
        onRefuse?.(id);
      }
    } catch (err) {
      console.error(`[TimeOff Action] Failed to ${newStatus.toLowerCase()} request:`, err);
      setError(err instanceof ApiError ? err.message : `Failed to ${newStatus.toLowerCase()} request.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateRequest = async () => {
    if (modalSubmitting) return;

    if (!startDate || !endDate) {
      setModalError('Please select both start and end dates.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setModalError('End date cannot be before start date.');
      return;
    }

    const empId = user?.employeeId || (user?.id?.startsWith('EMP-') ? user.id : 'EMP-004');

    setModalSubmitting(true);
    setModalError(null);
    try {
      await timeOffApi.create({
        employeeId: empId,
        leaveType,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      await loadRequests();
      setNewModalOpen(false);
      setReason('');
    } catch (err) {
      console.error('[TimeOff Modal] Failed to submit request:', err);
      setModalError(err instanceof ApiError ? err.message : 'Failed to submit time-off request.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Dynamic summary stats
  const takenDays = requests
    .filter((r) => r.status === 'APPROVED')
    .reduce((acc, r) => acc + (r.durationDays || 0), 0);
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const teamMemberCount = new Set(
    requests.filter((r) => r.status === 'APPROVED').map((r) => r.employeeId)
  ).size;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Time Off & Leave Operations</h1>
          <p className="page-desc">Manage employee leave requests, approve entitlements, and automatically deduct unpaid days from payroll.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setNewModalOpen(true)}>
          <Plus size={14} /> Request Leave
        </button>
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

      {/* Allocation Cards */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <div className="card">
          <div className="metric-title">Annual Leave Quota</div>
          <div className="metric-val">20 Days</div>
          <div style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '4px' }}>Standard company allocation</div>
        </div>
        <div className="card">
          <div className="metric-title">Taken This Cycle</div>
          <div className="metric-val">{takenDays} Days</div>
          <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>
            Across {teamMemberCount} team member{teamMemberCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="card">
          <div className="metric-title">Pending Approvals</div>
          <div className="metric-val" style={{ color: '#b45309' }}>
            {pendingCount} Request{pendingCount === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '4px' }}>Requires manager signoff</div>
        </div>
        <div className="card">
          <div className="metric-title">Payroll Sync Status</div>
          <div className="metric-val" style={{ color: '#047857' }}>Active</div>
          <div style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '4px' }}>Unpaid days synced to Payrun</div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>Date Span</th>
              <th>Duration</th>
              <th>Reason Note</th>
              <th>Status</th>
              <th>Decision Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate-400)' }}>
                  Loading time-off requests from database...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate-400)' }}>
                  No time-off requests recorded. Click "Request Leave" to submit a request.
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id}>
                  <td style={{ fontWeight: 600 }}>{req.employeeName}</td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{req.leaveType}</span>
                  </td>
                  <td style={{ color: 'var(--slate-500)' }}>
                    {req.startDate} to {req.endDate}
                  </td>
                  <td style={{ fontWeight: 600 }}>{req.durationDays} day(s)</td>
                  <td style={{ color: 'var(--slate-600)' }}>{req.reason || '—'}</td>
                  <td>
                    <span
                      className={`badge ${
                        req.status === 'APPROVED'
                          ? 'badge-success'
                          : req.status === 'REFUSED'
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}
                    >
                      <span className="badge-dot" />
                      {req.status}
                    </span>
                  </td>
                  <td>
                    {req.status === 'PENDING' ? (
                      canApprove ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ backgroundColor: '#059669' }}
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleAction(req.id, 'APPROVED')}
                          >
                            <Check size={12} /> {actionLoadingId === req.id ? '...' : 'Approve'}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#be123c' }}
                            disabled={actionLoadingId === req.id}
                            onClick={() => handleAction(req.id, 'REFUSED')}
                          >
                            <X size={12} /> {actionLoadingId === req.id ? '...' : 'Refuse'}
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                          Pending Approval
                        </span>
                      )
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                        Resolved
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Submit Request Modal */}
      {newModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Submit Time Off Request</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setNewModalOpen(false)}>
                <X size={14} />
              </button>
            </div>

            {modalError && (
              <div style={{ margin: '10px 0', padding: '8px 12px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '6px', fontSize: '12px', color: '#991b1b' }}>
                ⚠️ {modalError}
              </div>
            )}

            <div>
              <div className="form-field">
                <label className="form-label">Employee</label>
                <input
                  className="form-input"
                  value={`${user?.name || 'Current User'} (${user?.employeeId || 'Active User'})`}
                  disabled
                />
              </div>
              <div className="form-field">
                <label className="form-label">Leave Type</label>
                <select
                  className="form-input"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  <option value="Paid Annual Leave">Paid Annual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-field">
                  <label className="form-label">Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-field">
                <label className="form-label">Reason Note</label>
                <input
                  className="form-input"
                  placeholder="Personal appointment or vacation"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNewModalOpen(false)} disabled={modalSubmitting}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateRequest}
                disabled={modalSubmitting}
              >
                {modalSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
