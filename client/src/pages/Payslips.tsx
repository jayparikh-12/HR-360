import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  FileText, 
  RefreshCw, 
  AlertCircle, 
  Calendar, 
  CheckCircle2, 
  CreditCard, 
  Search, 
  UserCheck, 
  Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { payrollApi } from '../api/payroll';
import { employeesApi } from '../api/employees';
import type { Employee, EmployeePayslipHistoryItem } from '../types';
import { DetailedPayslipModal } from '../components/DetailedPayslipModal';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ApiError } from '../api/client';

export const Payslips: React.FC = () => {
  const { user, displayRole } = useAuth();
  const isEmployee = displayRole === 'Employee';

  // State for all employees (for managers/admins)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    user?.employeeId || 'EMP-001'
  );

  // Payslip history state
  const [payslips, setPayslips] = useState<EmployeePayslipHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayslipId, setSelectedPayslipId] = useState<string | null>(null);

  // Search/filter for payslips in current view
  const [searchTerm, setSearchTerm] = useState<string>('');

  const requestIdRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      requestIdRef.current = -1;
    };
  }, []);

  // 1. Load employees list for managers/admins
  useEffect(() => {
    if (!isEmployee) {
      employeesApi.getAll()
        .then((list) => {
          setEmployees(list);
          // If current selectedEmployeeId is not set or not in list, default to first employee
          if (list.length > 0 && (!selectedEmployeeId || !list.some(e => e.id === selectedEmployeeId))) {
            setSelectedEmployeeId(user?.employeeId && list.some(e => e.id === user.employeeId) ? user.employeeId : list[0].id);
          }
        })
        .catch((err) => {
          console.warn('[Payslips] Could not load employees dropdown:', err);
        });
    }
  }, [isEmployee, user?.employeeId]);

  // Target employee ID to query:
  // Strictly enforce user's own employeeId for EMPLOYEE role to prevent any cross-employee UI leak
  const targetEmployeeId = isEmployee ? (user?.employeeId || '') : selectedEmployeeId;

  // 2. Fetch employee payslips from backend API with concurrency guard
  const fetchPayslips = useCallback(async () => {
    if (!targetEmployeeId) {
      setLoading(false);
      setPayslips([]);
      return;
    }

    const currentReqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const history = await payrollApi.getEmployeePayslips(targetEmployeeId);
      if (currentReqId === requestIdRef.current) {
        setPayslips(history);
      }
    } catch (err: any) {
      if (currentReqId === requestIdRef.current) {
        console.error('[Payslips] Failed to load payslips:', err instanceof Error ? err.message : String(err));
        if (err instanceof ApiError) {
          if (err.statusCode === 403) {
            setError('Access Denied: You do not have permission to view payroll records for this employee.');
          } else if (err.statusCode === 404) {
            setError(`No payroll records found for employee '${targetEmployeeId}'.`);
          } else {
            setError(err.message || 'Failed to retrieve payslip history.');
          }
        } else {
          setError(err?.message || 'Unable to load payslips. Please check your connection.');
        }
      }
    } finally {
      if (currentReqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [targetEmployeeId]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  // Filter payslips by cycle name or period (memoized for render efficiency)
  const filteredPayslips = useMemo(() => {
    if (!searchTerm.trim()) return payslips;
    const term = searchTerm.toLowerCase();
    return payslips.filter((p) => {
      const periodStr = `${p.payrollPeriod.start || ''} ${p.payrollPeriod.end || ''}`.toLowerCase();
      return p.payrunName.toLowerCase().includes(term) || periodStr.includes(term) || p.status.toLowerCase().includes(term);
    });
  }, [payslips, searchTerm]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="badge badge-success">
            <span className="badge-dot" />
            PAID
          </span>
        );
      case 'VALIDATED':
        return (
          <span className="badge badge-info">
            <span className="badge-dot" />
            VALIDATED
          </span>
        );
      case 'COMPUTED':
        return (
          <span className="badge badge-info">
            <span className="badge-dot" />
            COMPUTED
          </span>
        );
      case 'DRAFT':
      default:
        return (
          <span className="badge badge-warning">
            <span className="badge-dot" />
            DRAFT
          </span>
        );
    }
  };

  const selectedEmployeeName = isEmployee
    ? (user?.name || user?.employeeId || 'My Account')
    : (employees.find((e) => e.id === selectedEmployeeId)?.name || selectedEmployeeId);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEmployee ? 'My Payslips' : 'Employee Payslips & Payroll History'}
          </h1>
          <p className="page-desc">
            {isEmployee 
              ? 'View and inspect your historical payslip vouchers with complete earnings and deductions breakdowns.'
              : 'Audit historical, persisted payslips across company staff members with zero recalculation.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={fetchPayslips}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh payslips from database"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Manager / Admin Employee Selector Bar */}
      {!isEmployee && employees.length > 0 && (
        <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserCheck size={16} color="var(--primary)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--slate-700)' }}>
                Select Employee:
              </span>
              <select
                aria-label="Select Employee for Payslip History"
                className="form-input"
                style={{
                  width: 'auto',
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '6px 12px',
                  height: 'auto',
                  cursor: 'pointer',
                  minWidth: '240px',
                }}
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.id} • {emp.department})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
              Viewing records for: <strong>{selectedEmployeeName}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchPayslips} style={{ padding: '4px 10px' }}>
            Retry
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="search-box" style={{ width: '280px' }}>
          <Search size={15} color="var(--slate-400)" />
          <input 
            type="text"
            placeholder="Filter by cycle, period, status…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ fontSize: '13px', color: 'var(--slate-500)' }}>
          Showing <strong>{filteredPayslips.length}</strong> {filteredPayslips.length === 1 ? 'record' : 'records'}
        </div>
      </div>

      {/* Payslip History Table Card */}
      <div className="table-container">
        <div style={{ 
          padding: '14px 18px', 
          borderBottom: '1px solid var(--border-color)', 
          fontWeight: 700, 
          fontSize: '14px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={16} color="var(--primary)" />
            <span>Persisted Payslip History — {selectedEmployeeName}</span>
          </div>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--slate-500)', letterSpacing: '0.04em' }}>
            Deterministic Snapshots (Newest First)
          </span>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-500)' }}>
            <RefreshCw size={26} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: 'var(--primary)' }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-800)', marginBottom: '4px' }}>
              Loading Payslip History…
            </div>
            <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
              Querying persisted historical payroll snapshots.
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredPayslips.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-400)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📄</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
              No Historical Payslips Found
            </div>
            <div style={{ fontSize: '13px', color: 'var(--slate-500)', maxWidth: '420px', margin: '0 auto' }}>
              {searchTerm 
                ? 'No payslips match your search criteria. Try clearing the search query.'
                : `No payroll snapshots have been calculated for ${selectedEmployeeName} yet.`}
            </div>
          </div>
        )}

        {/* Live Records Table */}
        {!loading && !error && filteredPayslips.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Cycle Name</th>
                <th>Payroll Period</th>
                <th>Gross Salary</th>
                <th>Total Deductions</th>
                <th>Net Disbursement</th>
                <th>Status</th>
                <th>Disbursed Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayslips.map((slip) => (
                <tr key={slip.payslipId}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{slip.payrunName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--slate-400)' }}>Ref: #{slip.payslipId}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <Calendar size={13} color="var(--slate-400)" />
                      <span>
                        {slip.payrollPeriod.start && slip.payrollPeriod.end
                          ? `${formatDate(slip.payrollPeriod.start)} – ${formatDate(slip.payrollPeriod.end)}`
                          : 'Regular Cycle'}
                      </span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(slip.grossSalary)}</td>
                  <td style={{ color: '#be123c' }}>-{formatCurrency(slip.totalDeductions)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '14px' }}>
                    {formatCurrency(slip.netSalary)}
                  </td>
                  <td>{getStatusBadge(slip.status)}</td>
                  <td>
                    {slip.paidAt ? (
                      <span style={{ fontSize: '12px', color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={12} color="#047857" />
                        {formatDate(slip.paidAt)}
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--slate-400)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedPayslipId(slip.payslipId)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                      >
                        <FileText size={12} />
                        <span>View Breakdown</span>
                      </button>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={async () => {
                          try {
                            await payrollApi.downloadPayslipPdf(slip.payslipId);
                          } catch (err: any) {
                            alert(err?.message || 'Failed to download payslip PDF');
                          }
                        }}
                        title="Download PDF Voucher"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Download size={12} />
                        <span>PDF</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detailed Payslip Modal */}
      {selectedPayslipId && (
        <DetailedPayslipModal
          payslipId={selectedPayslipId}
          onClose={() => setSelectedPayslipId(null)}
        />
      )}
    </div>
  );
};
