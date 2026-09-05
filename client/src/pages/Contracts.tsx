import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  X,
  Calendar,
  IndianRupee,
  Clock,
  Building,
  User,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { Contract, Employee } from '../types';
import { contractsApi, type CreateContractPayload } from '../api/contracts';
import { employeesApi } from '../api/employees';
import { schedulesApi, type ScheduleRecord } from '../api/schedules';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface ContractsProps {
  onNavigateTab?: (tab: string) => void;
}

// ── Contract Detail Modal ───────────────────────────────────────────────────

interface ContractDetailModalProps {
  contractId: string;
  onClose: () => void;
}

export const ContractDetailModal: React.FC<ContractDetailModalProps> = ({ contractId, onClose }) => {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const data = await contractsApi.getById(contractId);
        if (!cancelled) setContract(data);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.statusCode === 404 ? 'Contract not found.' : err.message);
          } else {
            setError('Failed to load contract details.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          width: '100%', maxWidth: '520px', background: '#fff',
          borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)' }}>
              Contract Details
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--slate-400)' }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate-500)', fontSize: '13px' }}>
            <RefreshCw size={20} className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
            <div>Loading contract details…</div>
          </div>
        ) : error ? (
          <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#b91c1c', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : contract ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--slate-100)' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--slate-900)' }}>
                  {contract.id}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                  Ref: {contract.employeeId}
                </div>
              </div>
              <span className={`badge ${contract.status === 'ACTIVE' ? 'badge-success' : contract.status === 'FUTURE' ? 'badge-info' : 'badge-warning'}`}>
                <span className="badge-dot" />
                {contract.status}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} /> Employee
                </span>
                <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>
                  {contract.employeeName || contract.employeeId}
                </span>
              </div>

              {contract.department && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building size={14} /> Department
                  </span>
                  <span style={{ fontWeight: 600 }}>{contract.department}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IndianRupee size={14} /> Base Monthly Wage
                </span>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '14px' }}>
                  ₹{Number(contract.wage).toLocaleString('en-IN')}.00 / mo
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={14} /> Effective Period
                </span>
                <span style={{ fontWeight: 600 }}>
                  {contract.startDate} {contract.endDate ? `→ ${contract.endDate}` : '(Indefinite)'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} /> Salary Structure
                </span>
                <span style={{ fontWeight: 600 }}>
                  {contract.salaryStructure || contract.structure || 'Standard'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} /> Working Schedule
                </span>
                <span style={{ fontWeight: 600 }}>
                  {contract.workingSchedule || contract.schedule || 'Standard 40h'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ── Create Contract Modal ───────────────────────────────────────────────────

interface CreateContractModalProps {
  employees: Employee[];
  schedules: ScheduleRecord[];
  preselectedEmployeeId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateContractModal: React.FC<CreateContractModalProps> = ({
  employees,
  schedules,
  preselectedEmployeeId,
  onClose,
  onCreated,
}) => {
  const [employeeId, setEmployeeId] = useState(preselectedEmployeeId || (employees[0]?.id ?? ''));
  const [wage, setWage] = useState<string>('6000');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>('');
  const [status, setStatus] = useState<'ACTIVE' | 'FUTURE' | 'HISTORICAL'>('ACTIVE');
  const [workingScheduleId, setWorkingScheduleId] = useState(schedules[0]?.id ?? 'SCH-001');
  const [customId, setCustomId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client validation
    if (!employeeId) {
      setError('Please select an employee.');
      return;
    }
    const numWage = parseFloat(wage);
    if (isNaN(numWage) || numWage < 0) {
      setError('Wage must be a non-negative number.');
      return;
    }
    if (!startDate) {
      setError('Start date is required.');
      return;
    }
    if (endDate && endDate < startDate) {
      setError('End date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateContractPayload = {
        employeeId,
        wage: numWage,
        startDate,
        endDate: endDate ? endDate : null,
        status,
        salaryStructureId: 'STR-001',
        workingScheduleId,
        ...(customId.trim() ? { id: customId.trim() } : {}),
      };

      await contractsApi.create(payload);
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setError(err.message || 'Conflict: This employee already has an active contract or contract ID exists.');
        } else if (err.statusCode === 404) {
          setError(err.message || 'Selected employee does not exist.');
        } else if (err.statusCode === 400) {
          setError(err.message || 'Validation error. Please check form fields.');
        } else if (err.statusCode === 401) {
          setError('Session expired or unauthorized. Please sign in again.');
        } else {
          setError(err.message || 'Failed to create contract.');
        }
      } else {
        setError('Failed to create contract. Please check connection and try again.');
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
    padding: '8px 10px',
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
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          width: '100%', maxWidth: '520px', background: '#fff',
          borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-lg)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)' }}>
              Create Employment Contract
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--slate-400)' }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px', marginBottom: '16px', background: '#fef2f2',
              border: '1px solid #f87171', borderRadius: '8px', color: '#b91c1c',
              fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Employee *</label>
            <select
              style={inputStyle}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
            >
              <option value="">Select an employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.id}) — {emp.department}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Monthly Wage (₹) *</label>
              <input
                type="number"
                min="0"
                step="500"
                style={inputStyle}
                value={wage}
                onChange={(e) => setWage(e.target.value)}
                placeholder="e.g. 65000"
                required
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Status</label>
              <select
                style={inputStyle}
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'FUTURE' | 'HISTORICAL')}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="FUTURE">FUTURE</option>
                <option value="HISTORICAL">HISTORICAL</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Start Date *</label>
              <input
                type="date"
                style={inputStyle}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>End Date (Optional)</label>
              <input
                type="date"
                style={inputStyle}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Working Schedule</label>
            <select
              style={inputStyle}
              value={workingScheduleId}
              onChange={(e) => setWorkingScheduleId(e.target.value)}
            >
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.weeklyHours}h / week)
                </option>
              ))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Custom Contract ID (Optional)</label>
            <input
              type="text"
              style={inputStyle}
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="e.g. CON-2026-001 (auto-generated if blank)"
              maxLength={50}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Contracts View ─────────────────────────────────────────────────────

export const Contracts: React.FC<ContractsProps> = () => {
  const { displayRole } = useAuth();
  const canCreateContract = displayRole === 'Admin' || displayRole === 'HR Manager';
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'FUTURE' | 'HISTORICAL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Load contracts, employees, and schedules
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [contractsData, employeesData, schedulesData] = await Promise.all([
        contractsApi.getAll(),
        employeesApi.getAll().catch(() => []),
        schedulesApi.getAll().catch(() => []),
      ]);
      setContracts(contractsData);
      setEmployees(employeesData);
      setSchedules(schedulesData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to connect to backend service. Please verify server is running.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered contracts
  const filteredContracts = contracts.filter((c) => {
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      c.id.toLowerCase().includes(term) ||
      c.employeeId.toLowerCase().includes(term) ||
      (c.employeeName && c.employeeName.toLowerCase().includes(term)) ||
      (c.department && c.department.toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });

  const activeCount = contracts.filter((c) => c.status === 'ACTIVE').length;
  const avgWage = contracts.length > 0
    ? Math.round(contracts.reduce((acc, c) => acc + Number(c.wage || 0), 0) / contracts.length)
    : 0;

  return (
    <div>
      {/* Detail Modal */}
      {selectedContractId && (
        <ContractDetailModal
          contractId={selectedContractId}
          onClose={() => setSelectedContractId(null)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateContractModal
          employees={employees}
          schedules={schedules}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadData}
        />
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Contract Management</h1>
          <p className="page-desc">
            Enterprise employment agreements and compensation records persisted in MySQL.
          </p>
        </div>
        {canCreateContract && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> New Contract
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid-4" style={{ marginBottom: '20px' }}>
        <div className="card">
          <div className="metric-title">Total Contracts</div>
          <div className="metric-val">{contracts.length}</div>
          <div className="metric-trend" style={{ color: 'var(--slate-500)' }}>
            Persisted MySQL records
          </div>
        </div>
        <div className="card">
          <div className="metric-title">Active Contracts</div>
          <div className="metric-val" style={{ color: '#047857' }}>{activeCount}</div>
          <div className="metric-trend">
            <CheckCircle2 size={12} /> Currently operating
          </div>
        </div>
        <div className="card">
          <div className="metric-title">Average Monthly Wage</div>
          <div className="metric-val">₹{avgWage.toLocaleString('en-IN')}</div>
          <div className="metric-trend" style={{ color: 'var(--primary)' }}>
            Across all staff
          </div>
        </div>
        <div className="card">
          <div className="metric-title">Future / Inactive</div>
          <div className="metric-val" style={{ color: '#b45309' }}>
            {contracts.length - activeCount}
          </div>
          <div className="metric-trend" style={{ color: '#b45309' }}>
            Draft or Historical
          </div>
        </div>
      </div>

      {/* Error state banner with retry */}
      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#b91c1c',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Control Bar: Filter Tabs & Search */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['ALL', 'ACTIVE', 'FUTURE', 'HISTORICAL'] as const).map((st) => (
            <button
              key={st}
              className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'ALL' ? 'All Contracts' : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="search-box" style={{ width: '260px' }}>
          <Search size={15} color="var(--slate-400)" />
          <input
            type="text"
            placeholder="Search contracts or staff…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Contract Table / States */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-500)', fontSize: '13px' }}>
            <RefreshCw size={22} className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
            <div>Loading contracts from MySQL…</div>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-400)' }}>
            <FileText size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--slate-700)' }}>
              No contracts found
            </div>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              {searchTerm || statusFilter !== 'ALL'
                ? 'Try adjusting your search criteria or filter.'
                : 'No contracts are currently stored in the database.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)', color: 'var(--slate-500)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 16px' }}>Contract Ref</th>
                  <th style={{ padding: '12px 16px' }}>Employee</th>
                  <th style={{ padding: '12px 16px' }}>Monthly Wage</th>
                  <th style={{ padding: '12px 16px' }}>Working Schedule</th>
                  <th style={{ padding: '12px 16px' }}>Effective Dates</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((c) => (
                  <tr
                    key={c.id}
                    style={{ borderBottom: '1px solid var(--slate-100)', cursor: 'pointer' }}
                    onClick={() => setSelectedContractId(c.id)}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                      {c.id}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>
                        {c.employeeName || c.employeeId}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-400)' }}>
                        {c.employeeId} {c.department ? `• ${c.department}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--slate-900)' }}>
                      ₹{Number(c.wage).toLocaleString('en-IN')}.00
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--slate-600)' }}>
                      {c.workingSchedule || c.schedule || 'Standard 40h'}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--slate-500)', fontSize: '12px' }}>
                      {c.startDate} {c.endDate ? `→ ${c.endDate}` : '(Indefinite)'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${c.status === 'ACTIVE' ? 'badge-success' : c.status === 'FUTURE' ? 'badge-info' : 'badge-warning'}`}>
                        <span className="badge-dot" />
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContractId(c.id);
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
