import React, { useState } from 'react';
import {
  Search,
  FileText,
  Clock,
  Palmtree,
  DollarSign,
  ArrowLeft,
  Building,
  CreditCard,
  UserPlus,
  X,
  Save,
} from 'lucide-react';
import type { Employee } from '../types';
import { employeesApi, type CreateEmployeePayload, type UpdateEmployeePayload } from '../api/employees';
import { schedulesApi, type ScheduleRecord } from '../api/schedules';
import { ContractDetailModal, CreateContractModal } from './Contracts';
import { ScheduleDetailModal } from './Schedules';
import { ApiError } from '../api/client';

interface EmployeesProps {
  employees: Employee[];
  onNavigateTab: (tab: string) => void;
  onRefresh?: () => void;
}

// ── Add Employee Form ─────────────────────────────────────────────────────────

const EMPTY_FORM: CreateEmployeePayload = {
  firstName: '',
  lastName: '',
  email: '',
  department: '',
  jobPosition: '',
  employeeType: 'FULL_TIME',
  status: 'ACTIVE',
  workingSchedule: 'Standard 40h Full-Time',
};

interface AddEmployeeFormProps {
  onClose: () => void;
  onCreated: () => void;
}

const AddEmployeeForm: React.FC<AddEmployeeFormProps> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState<CreateEmployeePayload>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof CreateEmployeePayload, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await employeesApi.create(form);
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create employee. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--slate-500)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  };
  const inputStyle: React.CSSProperties = {
    padding: '7px 10px',
    border: '1px solid var(--slate-200)',
    borderRadius: '6px',
    fontSize: '13px',
    color: 'var(--slate-900)',
    outline: 'none',
    background: '#fff',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{ width: '520px', maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)' }}>Add New Employee</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ padding: '4px 8px' }}
          >
            <X size={14} />
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '8px', fontSize: '13px', color: '#991b1b' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>First Name *</label>
              <input style={inputStyle} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="John" required />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Last Name *</label>
              <input style={inputStyle} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Doe" required />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Work Email *</label>
            <input style={inputStyle} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="john.doe@company.com" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Department *</label>
              <input style={inputStyle} value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Engineering" required />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Job Position *</label>
              <input style={inputStyle} value={form.jobPosition} onChange={(e) => set('jobPosition', e.target.value)} placeholder="Senior Engineer" required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Employee Type</label>
              <select className="role-select" style={{ fontSize: '13px', padding: '7px 10px' }} value={form.employeeType} onChange={(e) => set('employeeType', e.target.value as CreateEmployeePayload['employeeType'])}>
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Status</label>
              <select className="role-select" style={{ fontSize: '13px', padding: '7px 10px' }} value={form.status} onChange={(e) => set('status', e.target.value as CreateEmployeePayload['status'])}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Working Schedule</label>
            <input style={inputStyle} value={form.workingSchedule ?? ''} onChange={(e) => set('workingSchedule', e.target.value)} placeholder="Standard 40h Full-Time" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Bank Name</label>
              <input style={inputStyle} value={form.bankName ?? ''} onChange={(e) => set('bankName', e.target.value)} placeholder="Chase" />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Bank Account No.</label>
              <input style={inputStyle} value={form.bankAccountNo ?? ''} onChange={(e) => set('bankAccountNo', e.target.value)} placeholder="1234567890" />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              <Save size={13} />
              {submitting ? 'Saving…' : 'Save Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Edit Status Modal ─────────────────────────────────────────────────────────

interface EditStatusModalProps {
  employee: Employee;
  onClose: () => void;
  onUpdated: () => void;
}

const EditStatusModal: React.FC<EditStatusModalProps> = ({ employee, onClose, onUpdated }) => {
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(
    employee.status === 'TERMINATED' ? 'INACTIVE' : 'ACTIVE'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const payload: UpdateEmployeePayload = { status };
      await employeesApi.update(employee.id, payload);
      onUpdated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update employee status.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card" style={{ width: '360px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Update Employee Status</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 8px' }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--slate-500)', marginBottom: '16px' }}>
          Employee: <strong>{employee.name}</strong>
        </div>
        {error && (
          <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '6px', fontSize: '13px', color: '#991b1b' }}>
            {error}
          </div>
        )}
        <select
          className="role-select"
          style={{ width: '100%', fontSize: '13px', padding: '8px 10px', marginBottom: '16px' }}
          value={status}
          onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive (Terminated)</option>
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={submitting}>
            <Save size={13} />
            {submitting ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Employees Component ──────────────────────────────────────────────────

export const Employees: React.FC<EmployeesProps> = ({ employees, onNavigateTab, onRefresh }) => {
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditStatus, setShowEditStatus] = useState(false);

  const [viewingContractId, setViewingContractId] = useState<string | null>(null);
  const [viewingScheduleId, setViewingScheduleId] = useState<string | null>(null);
  const [showNewContractForEmp, setShowNewContractForEmp] = useState<string | null>(null);
  const [schedulesList, setSchedulesList] = useState<ScheduleRecord[]>([]);

  React.useEffect(() => {
    schedulesApi.getAll().then(setSchedulesList).catch(() => {});
  }, []);

  const filtered = employees.filter((emp) => {
    const matchSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      emp.id.toLowerCase().includes(search.toLowerCase());
    const matchDept = selectedDept === 'ALL' || emp.department === selectedDept;
    return matchSearch && matchDept;
  });

  const handleCreated = () => {
    onRefresh?.();
  };

  const handleUpdated = () => {
    onRefresh?.();
    setSelectedEmp(null); // Return to list so fresh data is visible
  };

  return (
    <div>
      {/* Modals */}
      {showAddForm && (
        <AddEmployeeForm
          onClose={() => setShowAddForm(false)}
          onCreated={handleCreated}
        />
      )}
      {showEditStatus && selectedEmp && (
        <EditStatusModal
          employee={selectedEmp}
          onClose={() => setShowEditStatus(false)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Contract & Schedule Modals */}
      {viewingContractId && (
        <ContractDetailModal
          contractId={viewingContractId}
          onClose={() => setViewingContractId(null)}
        />
      )}
      {showNewContractForEmp && (
        <CreateContractModal
          employees={employees}
          schedules={schedulesList}
          preselectedEmployeeId={showNewContractForEmp}
          onClose={() => setShowNewContractForEmp(null)}
          onCreated={() => {
            onRefresh?.();
            setShowNewContractForEmp(null);
          }}
        />
      )}
      {viewingScheduleId && (
        <ScheduleDetailModal
          scheduleId={viewingScheduleId}
          onClose={() => setViewingScheduleId(null)}
        />
      )}

      {/* If an employee is selected, render Employee 360 Hub! */}
      {selectedEmp ? (
        <div>
          {/* Back button */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEmp(null)}>
              <ArrowLeft size={13} /> Back to Directory
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowEditStatus(true)}
              style={{ marginLeft: 'auto' }}
            >
              Edit Status
            </button>
          </div>

          {/* Profile Header Card */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
                  {selectedEmp.avatarInitials}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--slate-900)' }}>{selectedEmp.name}</h2>
                    <span className={`badge ${selectedEmp.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                      <span className="badge-dot" />
                      {selectedEmp.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--slate-500)', marginTop: '2px' }}>
                    {selectedEmp.position} • {selectedEmp.department} • ID: {selectedEmp.id}
                  </div>
                </div>
              </div>

              {/* SMART STAT ACTION BUTTONS */}
              <div className="smart-pills-bar" style={{ marginBottom: 0 }}>
                <div
                  className="smart-pill"
                  onClick={() => {
                    if (selectedEmp.activeContractId) {
                      setViewingContractId(selectedEmp.activeContractId);
                    } else {
                      setShowNewContractForEmp(selectedEmp.id);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                  title="Click to view or manage active contract"
                >
                  <FileText size={14} color="var(--primary)" />
                  <span>Contract: <strong>{selectedEmp.activeContractId ? '1 Active' : 'Create New'}</strong></span>
                </div>
                <div className="smart-pill" onClick={() => onNavigateTab('attendance')}>
                  <Clock size={14} color="#059669" />
                  <span>Attendance: <strong>{selectedEmp.attendanceRate}%</strong></span>
                </div>
                <div className="smart-pill" onClick={() => onNavigateTab('time-off')}>
                  <Palmtree size={14} color="#d97706" />
                  <span>Time Off: <strong>{selectedEmp.leaveBalance}d Left</strong></span>
                </div>
                <div className="smart-pill" onClick={() => onNavigateTab('payruns')}>
                  <DollarSign size={14} color="var(--primary)" />
                  <span>Wage: <strong>${selectedEmp.wage.toLocaleString()}/mo</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Job & Org */}
            <div className="card">
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={16} color="var(--primary)" /> Job &amp; Organization
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Department</span>
                  <span style={{ fontWeight: 600 }}>{selectedEmp.department}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Work Email</span>
                  <span style={{ fontWeight: 600 }}>{selectedEmp.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Working Schedule</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 600 }}>{selectedEmp.schedule}</span>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: '11px', height: '22px' }}
                      onClick={() => {
                        const found = schedulesList.find((s) => s.name.toLowerCase() === selectedEmp.schedule.toLowerCase());
                        setViewingScheduleId(found ? found.id : (schedulesList[0]?.id || 'SCH-001'));
                      }}
                      title="View schedule details"
                    >
                      View
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Joined Organization</span>
                  <span style={{ fontWeight: 600 }}>{selectedEmp.joinDate}</span>
                </div>
              </div>
            </div>

            {/* Compensation & Bank */}
            <div className="card">
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={16} color="var(--primary)" /> Compensation &amp; Bank Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Base Monthly Wage</span>
                  <span style={{ fontWeight: 700, color: 'var(--slate-900)' }}>${selectedEmp.wage.toLocaleString()}.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Salary Structure</span>
                  <span style={{ fontWeight: 600 }}>Standard Tech (Basic + HRA + Allowances)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Disbursement Bank</span>
                  <span style={{ fontWeight: 600 }}>Chase Enterprise ({selectedEmp.bankAccount})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Tax Status</span>
                  <span className="badge badge-success">Standard W-2 Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Employee Directory List */
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Employee Directory</h1>
              <p className="page-desc">Central operational hub for {employees.length} active staff members.</p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowAddForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <UserPlus size={14} /> Add Employee
            </button>
          </div>

          <div className="table-container">
            {/* Filter / Search Bar */}
            <div className="table-search-bar">
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1 }}>
                <div className="search-box" style={{ width: '240px' }}>
                  <Search size={14} color="var(--slate-400)" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="role-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="ALL">All Departments</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Product">Product</option>
                  <option value="Finance">Finance</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="Operations">Operations</option>
                  <option value="Sales &amp; Marketing">Sales &amp; Marketing</option>
                </select>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                Showing {filtered.length} of {employees.length} employees
              </div>
            </div>

            {/* Table */}
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department &amp; Role</th>
                  <th>Contract Wage</th>
                  <th>Attendance</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar">{emp.avatarInitials}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{emp.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{emp.department}</div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>{emp.position}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>${emp.wage.toLocaleString()}/mo</div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>{emp.schedule}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: emp.attendanceRate >= 95 ? '#047857' : '#b45309' }}>
                        {emp.attendanceRate}%
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${emp.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                        <span className="badge-dot" />
                        {emp.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEmp(emp)}>
                        Open 360 Hub
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
