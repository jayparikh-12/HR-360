import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Check, 
  DollarSign, 
  FileText, 
  Download, 
  Printer, 
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { Payrun, PayslipItem, Employee } from '../types';
import { payrollApi } from '../api/payroll';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface PayrunsProps {
  payruns: Payrun[];
  employees: Employee[];
  onUpdatePayrun: (updated: Payrun) => void;
}

export const Payruns: React.FC<PayrunsProps> = ({ payruns, employees, onUpdatePayrun }) => {
  const { displayRole } = useAuth();
  const canValidateAndPay = displayRole === 'Admin' || displayRole === 'HR Payroll Manager';
  const canCreatePayrun = displayRole === 'Admin' || displayRole === 'HR Payroll Manager' || displayRole === 'HR Payroll User';

  const [activePayrun, setActivePayrun] = useState<Payrun>(payruns[0]);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipItem | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>(employees.map((e) => e.id));
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync activePayrun with authoritative backend status on mount
  useEffect(() => {
    let isMounted = true;
    const loadPersistedPayrun = async () => {
      try {
        const backendRuns = await payrollApi.getAll();
        if (!isMounted || !backendRuns || backendRuns.length === 0) return;

        setActivePayrun((prev) => {
          const match = backendRuns.find((pr) => pr.id === prev.id) || backendRuns[0];
          if (!match) return prev;

          const mergedPayslips = (match.payslips && match.payslips.length > 0)
            ? match.payslips
            : prev.payslips.map((p) => ({ ...p, status: match.status }));

          const enriched: Payrun = {
            ...prev,
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
  }, [onUpdatePayrun]);

  // Validate Payrun via backend API (PATCH /api/payroll/payruns/:id/validate)
  const handleValidate = async () => {
    if (actionLoading) return;
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
    if (actionLoading) return;
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
    } catch (err: any) {
      console.error('[Payruns] Payment failed:', err);
      const msg = err instanceof ApiError ? err.message : (err?.message || 'Failed to process payment. Please try again.');
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Local calculation of draft payslips
  const handleComputePayslips = () => {
    setError(null);
    const updated: Payrun = {
      ...activePayrun,
      status: 'COMPUTED',
      payslips: activePayrun.payslips.map((p) => ({ ...p, status: 'COMPUTED' })),
    };
    setActivePayrun(updated);
    onUpdatePayrun(updated);
  };

  // Complete wizard
  const handleFinishWizard = () => {
    const newPayslips: PayslipItem[] = employees
      .filter((e) => selectedEmpIds.includes(e.id))
      .map((e) => {
        const basic = Math.round(e.wage * 0.6);
        const hra = Math.round(e.wage * 0.25);
        const allowance = e.wage - basic - hra;
        const gross = e.wage;
        const tax = Math.round(gross * 0.1);
        const otherDeductions = Math.round(gross * 0.07);
        const net = gross - tax - otherDeductions;
        return {
          id: `PS-${e.id}`,
          employeeId: e.id,
          employeeName: e.name,
          department: e.department,
          basic,
          hra,
          allowance,
          gross,
          tax,
          otherDeductions,
          net,
          status: 'COMPUTED',
        };
      });

    const newRun: Payrun = {
      id: `PR-${Date.now().toString().slice(-4)}`,
      name: 'September 2026 Regular Cycle',
      period: 'Sep 01 – Sep 30, 2026',
      salaryStructure: 'Standard Full-Time Tech',
      totalGross: newPayslips.reduce((a, b) => a + b.gross, 0),
      totalNet: newPayslips.reduce((a, b) => a + b.net, 0),
      employeeCount: newPayslips.length,
      status: 'COMPUTED',
      payslips: newPayslips,
    };

    setActivePayrun(newRun);
    onUpdatePayrun(newRun);
    setWizardOpen(false);
    setWizardStep(1);
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
              <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{activePayrun.name}</h2>
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
                    <DollarSign size={14} />
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
            <div style={{ fontSize: '16px', fontWeight: 700 }}>${activePayrun.totalGross.toLocaleString()}.00</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Total Deductions</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#be123c' }}>
              -${(activePayrun.totalGross - activePayrun.totalNet).toLocaleString()}.00
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Net Disbursement</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
              ${activePayrun.totalNet.toLocaleString()}.00
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
                <td style={{ fontWeight: 600 }}>${slip.gross.toLocaleString()}.00</td>
                <td style={{ color: '#be123c' }}>-${(slip.tax + slip.otherDeductions).toLocaleString()}.00</td>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>${slip.net.toLocaleString()}.00</td>
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
                  <input className="form-input" defaultValue="October 2026 Regular Cycle" />
                </div>
                <div className="form-field">
                  <label className="form-label">Salary Structure</label>
                  <select className="form-input" defaultValue="Standard Full-Time Tech">
                    <option>Standard Full-Time Tech</option>
                    <option>Executive Management</option>
                    <option>Hourly Operations</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Payroll Period</label>
                  <input className="form-input" defaultValue="2026-10-01 to 2026-10-31" />
                </div>

                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setWizardOpen(false)}>Cancel</button>
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
                      <span style={{ color: 'var(--slate-500)', fontSize: '12px' }}>({emp.department} • ${emp.wage}/mo)</span>
                    </label>
                  ))}
                </div>

                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setWizardStep(1)}>← Back</button>
                  <button className="btn btn-primary" onClick={handleFinishWizard}>
                    Create Payrun ({selectedEmpIds.length} Selected)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INDIVIDUAL PAYSLIP VOUCHER MODAL */}
      {selectedPayslip && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Official Payslip Voucher</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPayslip(null)}>
                <X size={14} />
              </button>
            </div>

            {/* Voucher Body */}
            <div style={{ border: '1px solid var(--slate-200)', padding: '20px', borderRadius: '8px', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--slate-200)', paddingBottom: '14px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--primary)' }}>PeoplePay360 Inc.</div>
                  <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>100 Enterprise Way, Suite 400</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{activePayrun.period}</div>
                  <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>Voucher #{selectedPayslip.id}</div>
                </div>
              </div>

              {/* Employee Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '13px', marginBottom: '16px' }}>
                <div><strong>Employee:</strong> {selectedPayslip.employeeName}</div>
                <div><strong>ID:</strong> {selectedPayslip.employeeId}</div>
                <div><strong>Department:</strong> {selectedPayslip.department}</div>
                <div><strong>Status:</strong> <span className="badge badge-success">Disbursed</span></div>
              </div>

              {/* Itemized Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                {/* Earnings */}
                <div style={{ border: '1px solid var(--slate-200)', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--slate-500)', marginBottom: '8px' }}>EARNINGS</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span>Basic Salary</span>
                    <span>${selectedPayslip.basic.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span>HRA Allowance</span>
                    <span>${selectedPayslip.hra.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span>Special Allowance</span>
                    <span>${selectedPayslip.allowance.toLocaleString()}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--slate-200)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>GROSS</span>
                    <span>${selectedPayslip.gross.toLocaleString()}.00</span>
                  </div>
                </div>

                {/* Deductions */}
                <div style={{ border: '1px solid var(--slate-200)', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--slate-500)', marginBottom: '8px' }}>DEDUCTIONS</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span>Income Tax (TDS)</span>
                    <span>-${selectedPayslip.tax.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span>Social Security/PF</span>
                    <span>-${selectedPayslip.otherDeductions.toLocaleString()}</span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--slate-200)', marginTop: '36px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#be123c' }}>
                    <span>TOTAL DEDUCT</span>
                    <span>-${(selectedPayslip.tax + selectedPayslip.otherDeductions).toLocaleString()}.00</span>
                  </div>
                </div>
              </div>

              {/* Net Payout Banner */}
              <div style={{ background: 'var(--primary-light)', border: '1px solid #c7d2fe', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>NET SALARY PAYABLE:</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>${selectedPayslip.net.toLocaleString()}.00</span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => window.print()}>
                <Printer size={14} /> Print PDF
              </button>
              <button className="btn btn-primary" onClick={() => { alert('Downloaded official Payslip PDF'); setSelectedPayslip(null); }}>
                <Download size={14} /> Download Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
