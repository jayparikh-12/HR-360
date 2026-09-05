import React, { useState } from 'react';
import { Check, X, Plus } from 'lucide-react';
import type { TimeOffRequest } from '../types';

interface TimeOffProps {
  requests: TimeOffRequest[];
  onApprove: (id: string) => void;
  onRefuse: (id: string) => void;
}

export const TimeOff: React.FC<TimeOffProps> = ({ requests: initialRequests, onApprove, onRefuse }) => {
  const [requests, setRequests] = useState<TimeOffRequest[]>(initialRequests);
  const [newModalOpen, setNewModalOpen] = useState(false);

  const handleAction = (id: string, newStatus: 'APPROVED' | 'REFUSED') => {
    const updated = requests.map((r) => (r.id === id ? { ...r, status: newStatus } : r));
    setRequests(updated);
    if (newStatus === 'APPROVED') onApprove(id);
    else onRefuse(id);
  };

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

      {/* Allocation Cards */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <div className="card">
          <div className="metric-title">Annual Leave Quota</div>
          <div className="metric-val">20 Days</div>
          <div style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '4px' }}>Standard company allocation</div>
        </div>
        <div className="card">
          <div className="metric-title">Taken This Cycle</div>
          <div className="metric-val">5 Days</div>
          <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px' }}>Across 3 team members</div>
        </div>
        <div className="card">
          <div className="metric-title">Pending Approvals</div>
          <div className="metric-val" style={{ color: '#b45309' }}>
            {requests.filter((r) => r.status === 'PENDING').length} Requests
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
            {requests.map((req) => (
              <tr key={req.id}>
                <td style={{ fontWeight: 600 }}>{req.employeeName}</td>
                <td>
                  <span style={{ fontWeight: 500 }}>{req.leaveType}</span>
                </td>
                <td style={{ color: 'var(--slate-500)' }}>
                  {req.startDate} to {req.endDate}
                </td>
                <td style={{ fontWeight: 600 }}>{req.durationDays} day(s)</td>
                <td style={{ color: 'var(--slate-600)' }}>{req.reason}</td>
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
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ backgroundColor: '#059669' }}
                        onClick={() => handleAction(req.id, 'APPROVED')}
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#be123c' }}
                        onClick={() => handleAction(req.id, 'REFUSED')}
                      >
                        <X size={12} /> Refuse
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                      Resolved
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Simple Request Modal */}
      {newModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Submit Time Off Request</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setNewModalOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div>
              <div className="form-field">
                <label className="form-label">Employee</label>
                <input className="form-input" defaultValue="John Doe (EMP-001)" disabled />
              </div>
              <div className="form-field">
                <label className="form-label">Leave Type</label>
                <select className="form-input" defaultValue="Paid Annual Leave">
                  <option>Paid Annual Leave</option>
                  <option>Sick Leave</option>
                  <option>Unpaid Leave</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Dates</label>
                <input className="form-input" defaultValue="2026-09-20 to 2026-09-22" />
              </div>
              <div className="form-field">
                <label className="form-label">Reason Note</label>
                <input className="form-input" placeholder="Personal appointment" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setNewModalOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const newReq: TimeOffRequest = {
                    id: `TO-${Date.now().toString().slice(-3)}`,
                    employeeId: 'EMP-001',
                    employeeName: 'John Doe',
                    leaveType: 'Paid Annual Leave',
                    startDate: '2026-09-20',
                    endDate: '2026-09-22',
                    durationDays: 2,
                    reason: 'Personal time',
                    status: 'PENDING',
                  };
                  setRequests([newReq, ...requests]);
                  setNewModalOpen(false);
                }}
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
