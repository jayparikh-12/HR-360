import React, { useState, useEffect, useCallback } from 'react';
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
  Edit2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { Employee, Contract, AttendanceRecord, TimeOffRequest, Payrun } from '../types';
import { employeesApi, type CreateEmployeePayload, type UpdateEmployeePayload } from '../api/employees';
import { contractsApi } from '../api/contracts';
import { schedulesApi, type ScheduleRecord } from '../api/schedules';
import { attendanceApi } from '../api/attendance';
import { timeOffApi } from '../api/timeOff';
import { salaryStructuresApi, type SalaryStructure } from '../api/salaryStructures';
import { salaryRulesApi, type SalaryRule } from '../api/salaryRules';
import { payrollApi } from '../api/payroll';
import { ApiError } from '../api/client';

interface EmployeesProps {
  employees: Employee[];
  loading?: boolean;
  error?: string | null;
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

    // Client-side required field validation
    if (!form.firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!form.lastName.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!form.email.trim()) {
      setError('Work email is required.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setError('Please enter a valid work email address.');
      return;
    }
    if (!form.department.trim()) {
      setError('Department is required.');
      return;
    }
    if (!form.jobPosition.trim()) {
      setError('Job position is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateEmployeePayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        department: form.department.trim(),
        jobPosition: form.jobPosition.trim(),
        employeeType: form.employeeType || 'FULL_TIME',
        status: form.status || 'ACTIVE',
        ...(form.workingSchedule?.trim() ? { workingSchedule: form.workingSchedule.trim() } : {}),
        ...(form.phone?.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.bankName?.trim() ? { bankName: form.bankName.trim() } : {}),
        ...(form.bankAccountNo?.trim() ? { bankAccountNo: form.bankAccountNo.trim() } : {}),
      };

      await employeesApi.create(payload);
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create employee. Please try again.');
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
            disabled={submitting}
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
              <input style={inputStyle} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="John" required disabled={submitting} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Last Name *</label>
              <input style={inputStyle} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Doe" required disabled={submitting} />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Work Email *</label>
            <input style={inputStyle} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="john.doe@company.com" required disabled={submitting} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Department *</label>
              <input style={inputStyle} value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="Engineering" required disabled={submitting} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Job Position *</label>
              <input style={inputStyle} value={form.jobPosition} onChange={(e) => set('jobPosition', e.target.value)} placeholder="Senior Engineer" required disabled={submitting} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Employee Type</label>
              <select className="role-select" style={{ fontSize: '13px', padding: '7px 10px' }} value={form.employeeType} onChange={(e) => set('employeeType', e.target.value as CreateEmployeePayload['employeeType'])} disabled={submitting}>
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
              </select>
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Status</label>
              <select className="role-select" style={{ fontSize: '13px', padding: '7px 10px' }} value={form.status} onChange={(e) => set('status', e.target.value as CreateEmployeePayload['status'])} disabled={submitting}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Working Schedule</label>
            <input style={inputStyle} value={form.workingSchedule ?? ''} onChange={(e) => set('workingSchedule', e.target.value)} placeholder="Standard 40h Full-Time" disabled={submitting} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Bank Name</label>
              <input style={inputStyle} value={form.bankName ?? ''} onChange={(e) => set('bankName', e.target.value)} placeholder="Chase" disabled={submitting} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Bank Account No.</label>
              <input style={inputStyle} value={form.bankAccountNo ?? ''} onChange={(e) => set('bankAccountNo', e.target.value)} placeholder="1234567890" disabled={submitting} />
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

// ── Edit Employee Modal ───────────────────────────────────────────────────────

interface EditEmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onUpdated: (updated?: Employee) => void;
}

const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({ employee, onClose, onUpdated }) => {
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(
    employee.status === 'TERMINATED' ? 'INACTIVE' : 'ACTIVE'
  );
  const [department, setDepartment] = useState(employee.department || '');
  const [jobPosition, setJobPosition] = useState(employee.position || '');
  const [workingSchedule, setWorkingSchedule] = useState(employee.schedule || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (!department.trim()) {
      setError('Department cannot be empty.');
      return;
    }
    if (!jobPosition.trim()) {
      setError('Job position cannot be empty.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: UpdateEmployeePayload = {
        status,
        department: department.trim(),
        jobPosition: jobPosition.trim(),
        ...(workingSchedule.trim() ? { workingSchedule: workingSchedule.trim() } : {}),
      };
      const updated = await employeesApi.update(employee.id, payload);
      onUpdated(updated);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update employee.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '12px',
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
      <div className="card" style={{ width: '420px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Edit Employee Details</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting} style={{ padding: '4px 8px' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--slate-500)', marginBottom: '16px' }}>
          Employee: <strong>{employee.name}</strong> <span style={{ fontSize: '11px', color: 'var(--slate-400)' }}>({employee.id})</span>
        </div>

        {error && (
          <div style={{ marginBottom: '14px', padding: '8px 12px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '6px', fontSize: '13px', color: '#991b1b' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Status</label>
            <select
              className="role-select"
              style={{ width: '100%', fontSize: '13px', padding: '7px 10px' }}
              value={status}
              onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
              disabled={submitting}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive (Terminated)</option>
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Department *</label>
            <input
              style={inputStyle}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Engineering"
              required
              disabled={submitting}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Job Position *</label>
            <input
              style={inputStyle}
              value={jobPosition}
              onChange={(e) => setJobPosition(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              required
              disabled={submitting}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Working Schedule</label>
            <input
              style={inputStyle}
              value={workingSchedule}
              onChange={(e) => setWorkingSchedule(e.target.value)}
              placeholder="e.g. Standard 40h Full-Time"
              disabled={submitting}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              <Save size={13} />
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Employee 360 Hub Component ────────────────────────────────────────────────

interface Employee360HubProps {
  employeeId: string;
  onBack: () => void;
  onNavigateTab?: (tab: string) => void;
  onEmployeeUpdated: (updated?: Employee) => void;
}

interface HubData {
  contracts: Contract[];
  activeContract: Contract | null;
  schedule: ScheduleRecord | null;
  attendance: AttendanceRecord[];
  timeOff: TimeOffRequest[];
  salaryStructure: SalaryStructure | null;
  salaryRules: SalaryRule[];
  payruns: Array<{
    id: string;
    name: string;
    period: string;
    status: string;
    gross: number;
    net: number;
  }>;
}

const Employee360Hub: React.FC<Employee360HubProps> = ({
  employeeId,
  onBack,
  onNavigateTab: _onNavigateTab,
  onEmployeeUpdated,
}) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [hubData, setHubData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'contracts' | 'attendance' | 'timeoff' | 'salary' | 'payruns'>('overview');
  const [showEditModal, setShowEditModal] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    let active = true;
    setLoading(true);
    setError(null);
    setEmployee(null);
    setHubData(null);

    try {
      // 1. Fetch employee record (GET /api/employees/:id)
      const emp = await employeesApi.getById(employeeId);
      if (!active) return;
      setEmployee(emp);

      // 2. Concurrently fetch all associated domain collections
      const [allContracts, allSchedules, allAttendance, allTimeOff, allStructures, allPayruns] = await Promise.all([
        contractsApi.getAll().catch(() => [] as Contract[]),
        schedulesApi.getAll().catch(() => [] as ScheduleRecord[]),
        attendanceApi.getAll().catch(() => [] as AttendanceRecord[]),
        timeOffApi.getAll().catch(() => [] as TimeOffRequest[]),
        salaryStructuresApi.getAll().catch(() => [] as SalaryStructure[]),
        payrollApi.getAll().catch(() => [] as Payrun[]),
      ]);
      if (!active) return;

      // Filter contracts for this employee
      const empContracts = allContracts.filter(
        (c) =>
          c.employeeId === employeeId ||
          (emp.activeContractId && c.id === emp.activeContractId) ||
          c.employeeName?.toLowerCase() === emp.name?.toLowerCase()
      );
      const activeContract = empContracts.find((c) => c.status === 'ACTIVE') || empContracts[0] || null;

      // Match working schedule
      const schedRef = activeContract?.workingSchedule || emp.schedule;
      const matchedSchedule =
        allSchedules.find(
          (s) =>
            s.id === schedRef ||
            s.name === schedRef ||
            (schedRef && s.name.toLowerCase().includes(schedRef.toLowerCase()))
        ) || null;

      // Filter attendance records strictly belonging to this employee
      const empAttendance = allAttendance.filter(
        (a) =>
          a.employeeId === employeeId ||
          ((a as any).empCode && (a as any).empCode === employeeId) ||
          (a.employeeName && a.employeeName.toLowerCase() === emp.name.toLowerCase())
      );

      // Filter time off requests strictly belonging to this employee
      const empTimeOff = allTimeOff.filter(
        (t) =>
          t.employeeId === employeeId ||
          ((t as any).empCode && (t as any).empCode === employeeId) ||
          (t.employeeName && t.employeeName.toLowerCase() === emp.name.toLowerCase())
      );

      // Match salary structure
      const structRef = activeContract?.salaryStructure;
      const matchedStructure = structRef
        ? allStructures.find(
            (s) => s.id === structRef || s.name === structRef || s.code === structRef
          ) || null
        : null;

      // Fetch salary rules for the matched structure
      let rules: SalaryRule[] = [];
      if (matchedStructure) {
        rules = await salaryRulesApi.getAll(matchedStructure.id).catch(() => []);
      }
      if (!active) return;

      // Extract payslips / payruns for this employee
      const empPayruns: Array<{
        id: string;
        name: string;
        period: string;
        status: string;
        gross: number;
        net: number;
      }> = [];

      for (const pr of allPayruns) {
        if (Array.isArray(pr.payslips)) {
          const match = pr.payslips.find(
            (p) =>
              p.employeeId === employeeId ||
              p.employeeName?.toLowerCase() === emp.name?.toLowerCase()
          );
          if (match) {
            empPayruns.push({
              id: pr.id,
              name: pr.name,
              period: pr.period,
              status: pr.status,
              gross: match.gross,
              net: match.net,
            });
          }
        }
      }

      setHubData({
        contracts: empContracts,
        activeContract,
        schedule: matchedSchedule,
        attendance: empAttendance,
        timeOff: empTimeOff,
        salaryStructure: matchedStructure,
        salaryRules: rules,
        payruns: empPayruns,
      });
    } catch (err: any) {
      if (!active) return;
      console.error('[Employee360] Failed to load employee 360 data:', err);
      if (err instanceof ApiError && err.statusCode === 404) {
        setError('The requested employee record could not be found. It may have been deleted.');
      } else if (err instanceof ApiError && err.statusCode === 401) {
        setError('Authentication session expired. Please sign in again.');
      } else {
        setError(err?.message || 'Unable to load employee information. Please try again.');
      }
    } finally {
      if (active) setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [employeeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdated = (updated?: Employee) => {
    if (updated) {
      setEmployee(updated);
    }
    onEmployeeUpdated(updated);
    loadData();
  };

  // 1. Loading State
  if (loading && !employee) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--slate-400)' }}>
        <RefreshCw size={28} className="spin" style={{ margin: '0 auto 16px', display: 'block', color: 'var(--primary)' }} />
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
          Loading Employee 360 Hub…
        </div>
        <div style={{ fontSize: '13px', color: 'var(--slate-500)' }}>
          Retrieving employee profile, contracts, schedule, attendance, and compensation data.
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error || !employee) {
    return (
      <div>
        <div style={{ marginBottom: '16px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>
            <ArrowLeft size={13} /> Back to Directory
          </button>
        </div>
        <div
          style={{
            padding: '24px',
            background: '#fff',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>
            <AlertCircle size={20} /> Unable to Load Employee 360
          </div>
          <p style={{ fontSize: '13px', color: '#7f1d1d', marginBottom: '18px' }}>
            {error || 'An unexpected error occurred while retrieving this employee.'}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onBack}>
              Return to Directory
            </button>
            <button className="btn btn-primary btn-sm" onClick={loadData}>
              <RefreshCw size={13} /> Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Derived metrics from real domain records
  const effectiveWage = hubData?.activeContract?.wage ?? employee.wage ?? 0;
  
  // Real Attendance Rate
  const attendanceLogs = hubData?.attendance ?? [];
  const presentCount = attendanceLogs.filter(
    (a) => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'OVERTIME'
  ).length;
  const attendanceRate = attendanceLogs.length > 0 ? Math.round((presentCount / attendanceLogs.length) * 100) : (employee.attendanceRate || 100);

  // Real Leave Balance
  const timeOffRequests = hubData?.timeOff ?? [];
  const approvedDays = timeOffRequests
    .filter((t) => t.status === 'APPROVED')
    .reduce((sum, r) => sum + (r.durationDays || 1), 0);
  const leaveBalance = Math.max(0, 20 - approvedDays);

  return (
    <div>
      {/* Edit Modal */}
      {showEditModal && (
        <EditEmployeeModal
          employee={employee}
          onClose={() => setShowEditModal(false)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Top Action Bar */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={13} /> Back to Directory
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={loadData}
          disabled={loading}
          title="Refresh 360 data from server"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh Hub
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowEditModal(true)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Edit2 size={13} /> Edit Details
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800 }}>
              {employee.avatarInitials}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--slate-900)' }}>{employee.name}</h2>
                <span className={`badge ${employee.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                  <span className="badge-dot" />
                  {employee.status}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--slate-500)', marginTop: '2px' }}>
                {employee.position} • {employee.department} • ID: {employee.id}
              </div>
            </div>
          </div>

          {/* SMART STAT ACTION BUTTONS (Clicking switches active tab) */}
          <div className="smart-pills-bar" style={{ marginBottom: 0 }}>
            <div
              className={`smart-pill ${activeTab === 'contracts' ? 'active' : ''}`}
              style={activeTab === 'contracts' ? { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' } : {}}
              onClick={() => setActiveTab('contracts')}
            >
              <FileText size={14} color="var(--primary)" />
              <span>Contract: <strong>{hubData?.activeContract ? '1 Active' : (hubData?.contracts?.length ? `${hubData.contracts.length} Saved` : 'None')}</strong></span>
            </div>
            <div
              className={`smart-pill ${activeTab === 'attendance' ? 'active' : ''}`}
              style={activeTab === 'attendance' ? { borderColor: '#059669', background: '#ecfdf5', color: '#047857' } : {}}
              onClick={() => setActiveTab('attendance')}
            >
              <Clock size={14} color="#059669" />
              <span>Attendance: <strong>{attendanceRate}%</strong></span>
            </div>
            <div
              className={`smart-pill ${activeTab === 'timeoff' ? 'active' : ''}`}
              style={activeTab === 'timeoff' ? { borderColor: '#d97706', background: '#fffbeb', color: '#b45309' } : {}}
              onClick={() => setActiveTab('timeoff')}
            >
              <Palmtree size={14} color="#d97706" />
              <span>Time Off: <strong>{leaveBalance}d Left</strong></span>
            </div>
            <div
              className={`smart-pill ${activeTab === 'salary' ? 'active' : ''}`}
              style={activeTab === 'salary' ? { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' } : {}}
              onClick={() => setActiveTab('salary')}
            >
              <DollarSign size={14} color="var(--primary)" />
              <span>Wage: <strong>${effectiveWage.toLocaleString()}/mo</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Strip */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--slate-200)',
          marginBottom: '20px',
          overflowX: 'auto',
        }}
      >
        {[
          { key: 'overview', label: 'Overview', icon: Building },
          { key: 'contracts', label: `Contracts & Schedule (${hubData?.contracts?.length ?? 0})`, icon: FileText },
          { key: 'attendance', label: `Attendance (${hubData?.attendance?.length ?? 0})`, icon: Clock },
          { key: 'timeoff', label: `Time Off (${hubData?.timeOff?.length ?? 0})`, icon: Palmtree },
          { key: 'salary', label: 'Salary Structure & Rules', icon: DollarSign },
          { key: 'payruns', label: `Pay History (${hubData?.payruns?.length ?? 0})`, icon: CreditCard },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--slate-600)',
                fontWeight: isActive ? 600 : 500,
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
              onClick={() => setActiveTab(t.key as any)}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS */}

      {/* 1. Overview Tab (100% faithful to existing 2-card layout) */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Job & Org */}
          <div className="card">
            <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={16} color="var(--primary)" /> Job &amp; Organization
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)' }}>Department</span>
                <span style={{ fontWeight: 600 }}>{employee.department}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)' }}>Work Email</span>
                <span style={{ fontWeight: 600 }}>{employee.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)' }}>Working Schedule</span>
                <span style={{ fontWeight: 600 }}>
                  {hubData?.schedule
                    ? `${hubData.schedule.name} (${hubData.schedule.weeklyHours}h/wk)`
                    : (employee.schedule || 'Standard 40h')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)' }}>Joined Organization</span>
                <span style={{ fontWeight: 600 }}>{employee.joinDate || '—'}</span>
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
                <span style={{ fontWeight: 700, color: 'var(--slate-900)' }}>${effectiveWage.toLocaleString()}.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)' }}>Salary Structure</span>
                <span style={{ fontWeight: 600 }}>
                  {hubData?.salaryStructure
                    ? `${hubData.salaryStructure.name} (${hubData.salaryStructure.code})`
                    : 'None Assigned'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)' }}>Disbursement Bank</span>
                <span style={{ fontWeight: 600 }}>{employee.bankAccount || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)' }}>Status</span>
                <span className="badge badge-success">{employee.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Contracts & Schedule Tab */}
      {activeTab === 'contracts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Contracts Table */}
          <div className="table-container">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--slate-200)', fontWeight: 700, fontSize: '14px' }}>
              Employment Contracts ({hubData?.contracts?.length ?? 0})
            </div>
            <table>
              <thead>
                <tr>
                  <th>Contract ID</th>
                  <th>Wage</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Salary Structure</th>
                  <th>Schedule</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!hubData?.contracts || hubData.contracts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--slate-400)', fontSize: '13px' }}>
                      No contract records found for this employee in MySQL.
                    </td>
                  </tr>
                ) : (
                  hubData.contracts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{c.id}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>${c.wage.toLocaleString()}/mo</td>
                      <td>{c.startDate}</td>
                      <td>{c.endDate || 'Ongoing'}</td>
                      <td>{c.salaryStructure}</td>
                      <td>{c.workingSchedule}</td>
                      <td>
                        <span className={`badge ${c.status === 'ACTIVE' ? 'badge-success' : 'badge-warning'}`}>
                          <span className="badge-dot" />
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Working Schedule Card */}
          <div className="card">
            <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="var(--primary)" /> Working Schedule Information
            </h3>
            {hubData?.schedule ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: 'var(--slate-500)', marginBottom: '4px' }}>Schedule Name</div>
                  <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{hubData.schedule.name}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-500)', marginBottom: '4px' }}>Weekly Working Hours</div>
                  <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{hubData.schedule.weeklyHours} hours/week</div>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-500)', marginBottom: '4px' }}>Working Schedule ID</div>
                  <div style={{ fontWeight: 600, color: 'var(--slate-700)' }}>{hubData.schedule.id}</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--slate-500)' }}>
                Using default standard schedule: <strong>{employee.schedule || 'Standard 40h Full-Time'}</strong>. No custom schedule row assigned.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Attendance Tab */}
      {activeTab === 'attendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="table-container">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>
                Attendance Logs for {employee.name} ({hubData?.attendance?.length ?? 0})
              </span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: attendanceRate >= 90 ? '#047857' : '#b45309' }}>
                Calculated Rate: {attendanceRate}%
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Worked Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!hubData?.attendance || hubData.attendance.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--slate-400)', fontSize: '13px' }}>
                      No attendance records recorded for this employee in MySQL.
                    </td>
                  </tr>
                ) : (
                  hubData.attendance.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.date}</td>
                      <td>{a.checkIn}</td>
                      <td>{a.checkOut}</td>
                      <td>{a.workedHours} hrs</td>
                      <td>
                        <span className={`badge ${a.status === 'PRESENT' ? 'badge-success' : a.status === 'LATE' ? 'badge-warning' : 'badge-danger'}`}>
                          <span className="badge-dot" />
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Time Off Tab */}
      {activeTab === 'timeoff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="table-container">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>
                Time Off Requests for {employee.name} ({hubData?.timeOff?.length ?? 0})
              </span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#b45309' }}>
                Remaining Balance: {leaveBalance} Days
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!hubData?.timeOff || hubData.timeOff.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--slate-400)', fontSize: '13px' }}>
                      No time-off requests submitted for this employee in MySQL.
                    </td>
                  </tr>
                ) : (
                  hubData.timeOff.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.leaveType}</td>
                      <td>{t.startDate}</td>
                      <td>{t.endDate}</td>
                      <td>{t.durationDays} days</td>
                      <td style={{ color: 'var(--slate-600)', maxWidth: '200px' }}>{t.reason || '—'}</td>
                      <td>
                        <span className={`badge ${t.status === 'APPROVED' ? 'badge-success' : t.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}>
                          <span className="badge-dot" />
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Salary Structure & Rules Tab */}
      {activeTab === 'salary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Structure Summary Card */}
          <div className="card">
            <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={16} color="var(--primary)" /> Assigned Salary Structure
            </h3>
            {hubData?.salaryStructure ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: 'var(--slate-500)', marginBottom: '4px' }}>Structure Name</div>
                  <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{hubData.salaryStructure.name}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-500)', marginBottom: '4px' }}>Structure Code</div>
                  <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{hubData.salaryStructure.code}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-500)', marginBottom: '4px' }}>Structure ID</div>
                  <div style={{ fontWeight: 600, color: 'var(--slate-700)' }}>{hubData.salaryStructure.id}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--slate-500)', marginBottom: '4px' }}>Total Active Contracts</div>
                  <div style={{ fontWeight: 600, color: 'var(--slate-700)' }}>{hubData.salaryStructure.contractCount} contracts</div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--slate-500)' }}>
                No specific salary structure linked to this employee's active contract.
              </div>
            )}
          </div>

          {/* Salary Rules Table */}
          <div className="table-container">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--slate-200)', fontWeight: 700, fontSize: '14px' }}>
              Salary Rules ({hubData?.salaryRules?.length ?? 0})
            </div>
            <table>
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Rule Code</th>
                  <th>Rule Name</th>
                  <th>Category</th>
                  <th>Calculation Type</th>
                  <th>Amount / Value</th>
                </tr>
              </thead>
              <tbody>
                {!hubData?.salaryRules || hubData.salaryRules.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--slate-400)', fontSize: '13px' }}>
                      No salary rules defined for this structure in MySQL.
                    </td>
                  </tr>
                ) : (
                  hubData.salaryRules.map((r) => (
                    <tr key={r.id}>
                      <td style={{ color: 'var(--slate-500)', fontWeight: 600 }}>{r.sequence}</td>
                      <td style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{r.code}</td>
                      <td>{r.name}</td>
                      <td>
                        <span className="badge badge-neutral">{r.category}</span>
                      </td>
                      <td>{r.calculationType}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {r.amount !== null && r.amount !== undefined
                          ? `$${r.amount.toLocaleString()}`
                          : r.percentage !== null && r.percentage !== undefined
                          ? `${r.percentage}%`
                          : r.formula || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Payrun History Tab */}
      {activeTab === 'payruns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="table-container">
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--slate-200)', fontWeight: 700, fontSize: '14px' }}>
              Payrun &amp; Payslip History ({hubData?.payruns?.length ?? 0})
            </div>
            <table>
              <thead>
                <tr>
                  <th>Payrun Name</th>
                  <th>Period</th>
                  <th>Gross Pay</th>
                  <th>Net Disbursement</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!hubData?.payruns || hubData.payruns.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--slate-400)', fontSize: '13px' }}>
                      No historical payslips or payruns found for this employee.
                    </td>
                  </tr>
                ) : (
                  hubData.payruns.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{p.name}</td>
                      <td>{p.period}</td>
                      <td style={{ fontWeight: 600 }}>${p.gross.toLocaleString()}.00</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>${p.net.toLocaleString()}.00</td>
                      <td>
                        <span className={`badge ${p.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>
                          <span className="badge-dot" />
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Employees Component ──────────────────────────────────────────────────

export const Employees: React.FC<EmployeesProps> = ({
  employees,
  loading = false,
  error = null,
  onNavigateTab,
  onRefresh,
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [showAddForm, setShowAddForm] = useState(false);


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
  };

  return (
    <div>
      {/* Add Employee Modal */}
      {showAddForm && (
        <AddEmployeeForm
          onClose={() => setShowAddForm(false)}
          onCreated={handleCreated}
        />
      )}

      {/* If an employee is selected, render real API-backed Employee 360 Hub! */}
      {selectedEmpId ? (
        <Employee360Hub
          employeeId={selectedEmpId}
          onBack={() => setSelectedEmpId(null)}
          onNavigateTab={onNavigateTab}
          onEmployeeUpdated={handleUpdated}
        />
      ) : (
        /* Employee Directory List */
        <div>
          <div className="page-header">
            <div>
              <h1 className="page-title">Employee Directory</h1>
              <p className="page-desc">Central operational hub for {employees.length} active staff members.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onRefresh}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Refresh from database"
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddForm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <UserPlus size={14} /> Add Employee
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                background: '#fee2e2',
                border: '1px solid #f87171',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#991b1b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>⚠️ {error}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onRefresh}
                style={{ padding: '4px 10px', background: '#fff' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading Indicator */}
          {loading && employees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-400)', fontSize: '14px' }}>
              Loading employee directory from database…
            </div>
          ) : (
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
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--slate-400)' }}>
                        {employees.length === 0 ? (
                          <div>
                            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
                              No Employees Found
                            </div>
                            <div style={{ fontSize: '13px', marginBottom: '14px' }}>
                              There are currently no employee records in the database.
                            </div>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => setShowAddForm(true)}
                              style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                              <UserPlus size={14} /> Add First Employee
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '13px', marginBottom: '10px' }}>
                              No employees matched your search or department filter.
                            </div>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => { setSearch(''); setSelectedDept('ALL'); }}
                              style={{ margin: '0 auto' }}
                            >
                              Reset Filters
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((emp) => (
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
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEmpId(emp.id)}>
                            Open 360 Hub
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Employees;
