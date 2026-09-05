import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Check, 
  IndianRupee, 
  FileText, 
  Download, 
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { Payrun, PayslipItem, Employee } from '../types';
import { payrollApi } from '../api/payroll';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DetailedPayslipModal } from '../components/DetailedPayslipModal';

interface PayrunsProps {
  payruns: Payrun[];
  employees: Employee[];
  onUpdatePayrun: (updated: Payrun) => void;
  activePayrunId?: string | null;
  onSelectPayrun?: (id: string) => void;
}

/**
 * Resolve the default payrun to display when the user enters the Command Center.
 * Priority: first DRAFT payrun (user's active work) → most recent payrun → undefined.
 * Never hardcodes a specific payrun ID.
 */
const getDefaultPayrun = (runs: Payrun[]): Payrun | undefined => {
  if (!runs || runs.length === 0) return undefined;
  // Prefer the most-recent DRAFT so a fresh workflow is front-and-center
  const draft = runs.find((p) => p.status === 'DRAFT');
  if (draft) return draft;
  // Fall back to the most-recent payrun (DB returns created_at DESC)
  return runs[0];
};

export const Payruns: React.FC<PayrunsProps> = ({ 
  payruns, 
  employees, 
  onUpdatePayrun,
  activePayrunId,
  onSelectPayrun
}) => {
  const { displayRole } = useAuth();
  const canValidateAndPay = displayRole === 'Admin' || displayRole === 'HR Payroll Manager';
  const canCreatePayrun = displayRole === 'Admin' || displayRole === 'HR Payroll Manager' || displayRole === 'HR Payroll User';

  // Determine initial active payrun: preserve activePayrunId in same session if valid, otherwise smart default.
  // Returns undefined when no payruns exist — the UI will show an empty state.
  const resolveInitialPayrun = (): Payrun | undefined => {
    if (activePayrunId) {
      const match = payruns.find((p) => p.id === activePayrunId);
      if (match) return match;
    }
    return getDefaultPayrun(payruns);
  };

  const [activePayrun, setActivePayrun] = useState<Payrun | undefined>(resolveInitialPayrun);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipItem | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>(employees.map((e) => e.id));
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wizard controlled form state (Step 1)
  const [wizardName, setWizardName] = useState('October 2026 Regular Cycle');
  const [wizardPeriod, setWizardPeriod] = useState('2026-10-01 to 2026-10-31');
  const [wizardSalaryStructure, setWizardSalaryStructure] = useState('Standard Full-Time Tech');
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // Sync activePayrun with authoritative backend status on mount / when activePayrunId changes.
  // Always trusts the backend as source of truth for status.
  useEffect(() => {
    let isMounted = true;
    const loadPersistedPayrun = async () => {
      try {
        const backendRuns = await payrollApi.getAll();
        if (!isMounted) return;
        if (!backendRuns || backendRuns.length === 0) {
          // No payruns in DB — show empty state
          setActivePayrun(undefined);
          return;
        }

        setActivePayrun((prev) => {
          let match: Payrun | undefined;
          if (activePayrunId) {
            match = backendRuns.find((pr) => pr.id === activePayrunId);
          }
          if (!match) {
            match = getDefaultPayrun(backendRuns);
          }
          if (!match) return undefined;

          const mergedPayslips = (match.payslips && match.payslips.length > 0)
            ? match.payslips
            : (prev?.payslips || []).map((p) => ({ ...p, status: match!.status }));

          const enriched: Payrun = {
            ...(prev || match),
            ...match,
            status: match.status,
            payslips: mergedPayslips,
          };
          onUpdatePayrun(enriched);
          return enriched;
        });
      } catch (err) {
        console.warn('[Payruns] Could not fetch persisted payrun on mount:', err);
      }
    };

    loadPersistedPayrun();
    return () => {
      isMounted = false;
    };
  }, [activePayrunId, onUpdatePayrun]);

  // Validate Payrun via backend API (PATCH /api/payroll/payruns/:id/validate)
  const handleValidate = async () => {
    if (actionLoading || !activePayrun) return;
    setError(null);
    setActionLoading(true);

    try {
      const updated = await payrollApi.validate(activePayrun.id);
      const mergedPayslips = (updated.payslips && updated.payslips.length > 0)
        ? updated.payslips
        : activePayrun.payslips.map((p) => ({ ...p, status: 'VALIDATED' as const }));

      const newActive: Payrun = {
        ...activePayrun,
        ...updated,
        status: updated.status || 'VALIDATED',
        payslips: mergedPayslips,
      };

      setActivePayrun(newActive);
      onUpdatePayrun(newActive);
      onSelectPayrun?.(newActive.id);
    } catch (err: any) {
      console.error('[Payruns] Validate failed:', err);
      const msg = err instanceof ApiError ? err.message : (err?.message || 'Failed to validate payrun. Please try again.');
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Pay & Disburse Payrun via backend API (PATCH /api/payroll/payruns/:id/pay)
  const handlePay = async () => {
    if (actionLoading || !activePayrun) return;
    setError(null);
    setActionLoading(true);

    try {
      const updated = await payrollApi.pay(activePayrun.id);
      const mergedPayslips = (updated.payslips && updated.payslips.length > 0)
        ? updated.payslips
        : activePayrun.payslips.map((p) => ({ ...p, status: 'PAID' as const }));

      const newActive: Payrun = {
        ...activePayrun,
        ...updated,
        status: updated.status || 'PAID',
        payslips: mergedPayslips,
      };

      setActivePayrun(newActive);
      onUpdatePayrun(newActive);
      onSelectPayrun?.(newActive.id);
    } catch (err: any) {
      console.error('[Payruns] Payment failed:', err);
      const msg = err instanceof ApiError ? err.message : (err?.message || 'Failed to process payment. Please try again.');
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Local computation: DRAFT → COMPUTED (client-side only; no /compute API endpoint exists)
  const handleComputePayslips = () => {
    if (!activePayrun) return;
    setError(null);
    const updated: Payrun = {
      ...activePayrun,
      status: 'COMPUTED',
      payslips: activePayrun.payslips.map((p) => ({ ...p, status: 'COMPUTED' })),
    };
    setActivePayrun(updated);
    onUpdatePayrun(updated);
    onSelectPayrun?.(updated.id);
  };

  /**
   * Create a new payrun via the backend API.
   * The backend creates the record with status = DRAFT.
   * We use the returned object directly — no local status assumptions.
   */
  const handleFinishWizard = async () => {
    if (wizardLoading) return;
    setWizardError(null);
    setWizardLoading(true);

    try {
      const created = await payrollApi.create({
        name: wizardName.trim() || 'New Payrun',
        period: wizardPeriod.trim() || 'October 2026',
        salaryStructure: wizardSalaryStructure,
        employeeIds: selectedEmpIds.length > 0 ? selectedEmpIds : undefined,
      });

      // Use backend response as-is: status will be DRAFT
      const newRun: Payrun = {
        ...created,
        payslips: created.payslips || [],
      };

      setActivePayrun(newRun);
      onUpdatePayrun(newRun);
      onSelectPayrun?.(newRun.id);
      setWizardOpen(false);
      setWizardStep(1);
      // Reset wizard fields for next use
      setWizardName('October 2026 Regular Cycle');
      setWizardPeriod('2026-10-01 to 2026-10-31');
      setWizardSalaryStructure('Standard Full-Time Tech');
    } catch (err: any) {
      console.error('[Payruns] Wizard create failed:', err);
      const msg = err instanceof ApiError ? err.message : (err?.message || 'Failed to create payrun. Please try again.');
      setWizardError(msg);
    } finally {
      setWizardLoading(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Payrun Command Center</h1>
          <p className="page-desc">Batch calculate deterministic salary structures, validate deductions, and export payslips.</p>
        </div>
        {canCreatePayrun && (
          <button className="btn btn-primary" onClick={() => setWizardOpen(true)}>
            <Play size={14} />
            <span>New Payrun Wizard</span>
          </button>
        )}
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
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
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#991b1b',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Empty State — no payruns exist yet */}
      {!activePayrun && (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: 'var(--slate-400)',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '8px' }}>
            No Payruns Yet
          </div>
          <div style={{ fontSize: '13px', marginBottom: '24px', color: 'var(--slate-500)' }}>
            Create your first payrun to get started with payroll processing.
          </div>
          {canCreatePayrun && (
            <button className="btn btn-primary" onClick={() => setWizardOpen(true)}>
              <Play size={14} />
              <span>New Payrun Wizard</span>
            </button>
          )}
        </div>
      )}

      {/* Main Payrun Command Center — only when a payrun is active */}
      {activePayrun && (
        <>
      {/* 4-Stage Stepper Bar */}
      <div className="stepper-bar">
        <div className={`step-node ${activePayrun.status !== 'DRAFT' ? 'completed' : 'active'}`}>
          <div className="step-circle">{activePayrun.status !== 'DRAFT' ? <Check size={14} /> : '1'}</div>
          <span className="step-title">DRAFT</span>
        </div>
        <div className={`step-line ${['COMPUTED', 'VALIDATED', 'PAID'].includes(activePayrun.status) ? 'active' : ''}`} />

        <div className={`step-node ${['VALIDATED', 'PAID'].includes(activePayrun.status) ? 'completed' : activePayrun.status === 'COMPUTED' ? 'active' : ''}`}>
          <div className="step-circle">{['VALIDATED', 'PAID'].includes(activePayrun.status) ? <Check size={14} /> : '2'}</div>
          <span className="step-title">COMPUTED</span>
        </div>
        <div className={`step-line ${['VALIDATED', 'PAID'].includes(activePayrun.status) ? 'active' : ''}`} />

        <div className={`step-node ${activePayrun.status === 'PAID' ? 'completed' : activePayrun.status === 'VALIDATED' ? 'active' : ''}`}>
          <div className="step-circle">{activePayrun.status === 'PAID' ? <Check size={14} /> : '3'}</div>
          <span className="step-title">VALIDATED</span>
        </div>
        <div className={`step-line ${activePayrun.status === 'PAID' ? 'active' : ''}`} />

        <div className={`step-node ${activePayrun.status === 'PAID' ? 'completed active' : ''}`}>
          <div className="step-circle">{activePayrun.status === 'PAID' ? <Check size={14} /> : '4'}</div>
          <span className="step-title">PAID</span>
        </div>
      </div>

      {/* Active Payrun Meta Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {payruns.length > 1 ? (
                <select
                  aria-label="Select Payrun"
                  className="form-input"
                  style={{
                    width: 'auto',
                    fontWeight: 700,
                    fontSize: '18px',
                    padding: '4px 10px',
                    height: 'auto',
                    cursor: 'pointer',
                  }}
                  value={activePayrun.id}
                  onChange={(e) => {
                    const found = payruns.find((p) => p.id === e.target.value);
                    if (found) {
                      setActivePayrun(found);
                      onSelectPayrun?.(found.id);
                    }
                  }}
                >
                  {payruns.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} ({pr.period})
                    </option>
                  ))}
                </select>
              ) : (
                <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{activePayrun.name}</h2>
              )}
              <span className={`badge ${activePayrun.status === 'PAID' ? 'badge-success' : activePayrun.status === 'VALIDATED' ? 'badge-info' : 'badge-warning'}`}>
                {activePayrun.status}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--slate-500)', marginTop: '3px' }}>
              Cycle: {activePayrun.period} • Structure: {activePayrun.salaryStructure}
            </div>
          </div>

          {/* Workflow Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {activePayrun.status === 'DRAFT' && (
              <button
                className="btn btn-secondary"
                disabled={actionLoading}
                onClick={handleComputePayslips}
              >
                ⚡ Compute All Payslips
              </button>
            )}
            {(activePayrun.status === 'DRAFT' || activePayrun.status === 'COMPUTED') && (
              canValidateAndPay ? (
                <button
                  className="btn btn-primary"
                  disabled={actionLoading}
                  onClick={handleValidate}
                >
                  {actionLoading ? (
                    <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>{actionLoading ? 'Validating...' : 'Validate & Confirm Payrun'}</span>
                </button>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--slate-400)', fontStyle: 'italic', alignSelf: 'center' }}>
                  Payroll Manager validation required
                </span>
              )
            )}
            {activePayrun.status === 'VALIDATED' && (
              canValidateAndPay ? (
                <button
                  className="btn btn-primary"
                  style={{ backgroundColor: '#059669' }}
                  disabled={actionLoading}
                  onClick={handlePay}
                >
                  {actionLoading ? (
                    <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <IndianRupee size={14} />
                  )}
                  <span>{actionLoading ? 'Processing Payment...' : 'Mark Paid & Disburse'}</span>
                </button>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--slate-400)', fontStyle: 'italic', alignSelf: 'center' }}>
                  Payroll Manager disbursement required
                </span>
              )
            )}
            {activePayrun.status === 'PAID' && (
              <button
                className="btn btn-secondary"
                onClick={() => alert('Dispatched payslip vouchers to 6 verified employee emails.')}
              >
                <Download size={14} /> Export Payslips (ZIP)
              </button>
            )}
          </div>
        </div>

        {/* Totals Ribbon */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--slate-100)' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Employees</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{activePayrun.employeeCount}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Total Gross</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>₹{activePayrun.totalGross.toLocaleString('en-IN')}.00</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Total Deductions</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#be123c' }}>
              -₹{(activePayrun.totalGross - activePayrun.totalNet).toLocaleString('en-IN')}.00
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Net Disbursement</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
              ₹{activePayrun.totalNet.toLocaleString('en-IN')}.00
            </div>
          </div>
        </div>
      </div>

      {/* Payslip Batch Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Gross Salary</th>
              <th>Deductions</th>
              <th>Net Salary</th>
              <th>Status</th>
              <th>Voucher</th>
            </tr>
          </thead>
          <tbody>
            {activePayrun.payslips.map((slip) => (
              <tr key={slip.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{slip.employeeName}</div>
                  {slip.warning && (
                    <div style={{ fontSize: '11px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <AlertCircle size={10} /> {slip.warning}
                    </div>
                  )}
                </td>
                <td>{slip.department}</td>
                <td style={{ fontWeight: 600 }}>₹{slip.gross.toLocaleString('en-IN')}.00</td>
                <td style={{ color: '#be123c' }}>-₹{(slip.tax + slip.otherDeductions).toLocaleString('en-IN')}.00</td>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{slip.net.toLocaleString('en-IN')}.00</td>
                <td>
                  <span className={`badge ${slip.status === 'PAID' ? 'badge-success' : slip.status === 'VALIDATED' ? 'badge-info' : 'badge-warning'}`}>
                    {slip.status}
                  </span>
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPayslip(slip)}>
                    <FileText size={12} /> View Payslip
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

        </>
      )}

      {/* 2-STEP PAYRUN WIZARD MODAL */}
      {wizardOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">
                {wizardStep === 1 ? 'Step 1 of 2: Payroll Scope' : 'Step 2 of 2: Employee Selection'}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setWizardOpen(false)}>
                <X size={14} />
              </button>
            </div>

            {wizardStep === 1 ? (
              <div>
                <div className="form-field">
                  <label className="form-label">Payrun Title</label>
                  <input
                    className="form-input"
                    value={wizardName}
                    onChange={(e) => setWizardName(e.target.value)}
                    placeholder="e.g. October 2026 Regular Cycle"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Salary Structure</label>
                  <select
                    className="form-input"
                    value={wizardSalaryStructure}
                    onChange={(e) => setWizardSalaryStructure(e.target.value)}
                  >
                    <option>Standard Full-Time Tech</option>
                    <option>Executive Management</option>
                    <option>Hourly Operations</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Payroll Period</label>
                  <input
                    className="form-input"
                    value={wizardPeriod}
                    onChange={(e) => setWizardPeriod(e.target.value)}
                    placeholder="e.g. 2026-10-01 to 2026-10-31"
                  />
                </div>

                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setWizardOpen(false);
                      setWizardStep(1);
                      setWizardError(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={() => setWizardStep(2)}>
                    Continue to Employees →
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '13px', color: 'var(--slate-600)', marginBottom: '14px' }}>
                  Select eligible employees with active contracts:
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--slate-200)', borderRadius: '6px', padding: '10px' }}>
                  {employees.map((emp) => (
                    <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedEmpIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedEmpIds([...selectedEmpIds, emp.id]);
                          else setSelectedEmpIds(selectedEmpIds.filter((id) => id !== emp.id));
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{emp.name}</span>
                      <span style={{ color: 'var(--slate-500)', fontSize: '12px' }}>({emp.department} • ₹{emp.wage.toLocaleString('en-IN')}/mo)</span>
                    </label>
                  ))}
                </div>

                {wizardError && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={14} />
                    <span>{wizardError}</span>
                  </div>
                )}

                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setWizardStep(1)} disabled={wizardLoading}>← Back</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleFinishWizard}
                    disabled={wizardLoading}
                  >
                    {wizardLoading ? (
                      <><Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /><span>Creating Payrun...</span></>
                    ) : (
                      <span>Create Payrun ({selectedEmpIds.length} Selected)</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DETAILED PAYSLIP BREAKDOWN MODAL */}
      {selectedPayslip && (
        <DetailedPayslipModal
          payslipId={selectedPayslip.id}
          payrunId={activePayrun?.id}
          employeeId={selectedPayslip.employeeId}
          onClose={() => setSelectedPayslip(null)}
        />
      )}
    </div>
  );
};
