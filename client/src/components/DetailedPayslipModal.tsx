import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Calendar, 
  User, 
  Building, 
  CheckCircle2, 
  CreditCard,
  Clock,
  Download
} from 'lucide-react';
import type { DetailedPayslip } from '../types';
import { payrollApi } from '../api/payroll';
import { ApiError } from '../api/client';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';

interface DetailedPayslipModalProps {
  payslipId?: string | null;
  payrunId?: string | null;
  employeeId?: string | null;
  initialPayslip?: DetailedPayslip | null;
  onClose: () => void;
}

export const DetailedPayslipModal: React.FC<DetailedPayslipModalProps> = ({
  payslipId,
  payrunId,
  employeeId,
  initialPayslip,
  onClose,
}) => {
  const [payslip, setPayslip] = useState<DetailedPayslip | null>(initialPayslip || null);
  const [loading, setLoading] = useState<boolean>(!initialPayslip && Boolean(payslipId || (payrunId && employeeId)));
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    if (!payslip || downloading) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      await payrollApi.downloadPayslipPdf(payslip.payslipId);
    } catch (err: any) {
      console.error('[DetailedPayslipModal] Download PDF failed:', err);
      setDownloadError(err?.message || 'Failed to generate payslip PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const fetchPayslip = useCallback(async () => {
    if (!payslipId && (!payrunId || !employeeId)) return;
    setLoading(true);
    setError(null);

    try {
      let data: DetailedPayslip;
      if (payslipId) {
        data = await payrollApi.getPayslipById(payslipId);
      } else if (payrunId && employeeId) {
        data = await payrollApi.getPayslipByPayrunAndEmployee(payrunId, employeeId);
      } else {
        throw new Error('No payslip identifier provided.');
      }
      setPayslip(data);
    } catch (err: any) {
      console.error('[DetailedPayslipModal] Failed to load payslip:', err);
      if (err instanceof ApiError) {
        if (err.statusCode === 403) {
          setError('Access Denied: You are not authorized to view this employee’s payslip.');
        } else if (err.statusCode === 404) {
          setError('Historical payslip snapshot could not be found.');
        } else {
          setError(err.message || 'Failed to retrieve payslip snapshot.');
        }
      } else {
        setError(err?.message || 'Unable to connect to payroll service. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [payslipId, payrunId, employeeId]);

  useEffect(() => {
    if (!initialPayslip && (payslipId || (payrunId && employeeId))) {
      fetchPayslip();
    }
  }, [initialPayslip, payslipId, payrunId, employeeId, fetchPayslip]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="badge badge-success"><CheckCircle2 size={12} style={{ marginRight: '4px' }} /> PAID</span>;
      case 'VALIDATED':
        return <span className="badge badge-info"><CheckCircle2 size={12} style={{ marginRight: '4px' }} /> VALIDATED</span>;
      case 'COMPUTED':
        return <span className="badge badge-info">COMPUTED</span>;
      case 'DRAFT':
      default:
        return <span className="badge badge-warning">DRAFT</span>;
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 1100 }}
    >
      <div className="modal-content" style={{ maxWidth: '720px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Modal Header */}
        <div className="modal-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 className="modal-title" style={{ fontSize: '18px', fontWeight: 700 }}>
              Official Payslip Breakdown
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
              Immutable historical payroll snapshot persisted from compute engine
            </p>
          </div>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={onClose}
            aria-label="Close payslip modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-500)' }}>
            <Loader2 size={32} className="spin" style={{ margin: '0 auto 16px', display: 'block', color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--slate-800)', marginBottom: '4px' }}>
              Retrieving Persisted Snapshot…
            </div>
            <div style={{ fontSize: '13px', color: 'var(--slate-500)' }}>
              Loading historical earnings, deductions, and audit stamps from database.
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ 
              padding: '16px', 
              backgroundColor: 'var(--danger-bg)', 
              border: '1px solid var(--danger-border)', 
              borderRadius: 'var(--radius)', 
              color: 'var(--danger-text)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '14px'
            }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button className="btn btn-primary" onClick={fetchPayslip}>
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && !payslip && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-400)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
              Payslip Snapshot Not Found
            </div>
            <div style={{ fontSize: '13px', color: 'var(--slate-500)', marginBottom: '20px' }}>
              No persisted payroll record was found for this reference.
            </div>
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {/* Detailed Content — Real Historical Data */}
        {!loading && !error && payslip && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Warning Banner if present in snapshot */}
            {payslip.warning && (
              <div style={{ 
                padding: '10px 14px', 
                backgroundColor: 'var(--warning-bg)', 
                border: '1px solid var(--warning-border)', 
                borderRadius: '6px', 
                color: 'var(--warning-text)', 
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span><strong>Notice:</strong> {payslip.warning}</span>
              </div>
            )}

            {/* Voucher Card */}
            <div style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: 'var(--radius)', 
              padding: '20px',
              background: 'var(--bg-card)'
            }}>
              {/* Top Banner: Company & Payrun Meta */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '12px',
                borderBottom: '1px solid var(--border-color)', 
                paddingBottom: '16px', 
                marginBottom: '16px' 
              }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em' }}>
                    PeoplePay360 Inc.
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                    Deterministic Enterprise Payroll System
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {payslip.payrunName || 'Payrun Cycle'}
                    </span>
                    {getStatusBadge(payslip.status)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                    Payslip Ref: <strong>#{payslip.payslipId}</strong>
                  </div>
                </div>
              </div>

              {/* Employee & Period Grid */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '12px', 
                padding: '12px',
                backgroundColor: 'var(--slate-50)',
                borderRadius: '6px',
                marginBottom: '18px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--slate-500)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={12} /> Employee
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    {payslip.employee.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                    ID: {payslip.employee.employeeId}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--slate-500)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Building size={12} /> Department & Role
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                    {payslip.employee.department}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                    {payslip.employee.position}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--slate-500)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> Payroll Period
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                    {payslip.payrollPeriod.start && payslip.payrollPeriod.end ? (
                      `${formatDate(payslip.payrollPeriod.start)} – ${formatDate(payslip.payrollPeriod.end)}`
                    ) : (
                      'Regular Cycle'
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                    Base: {formatCurrency(payslip.baseSalary)}
                  </div>
                </div>
              </div>

              {/* Itemized Columns: Earnings & Deductions */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '16px', 
                marginBottom: '18px' 
              }}>
                {/* Earnings Section */}
                <div style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '6px', 
                  overflow: 'hidden' 
                }}>
                  <div style={{ 
                    padding: '8px 12px', 
                    background: 'var(--slate-100)', 
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--slate-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Earnings Breakdown
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
                      {payslip.earnings?.length || 0} Components
                    </span>
                  </div>

                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Explicit Base Salary item */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--slate-700)' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>Contract Base Salary</span>
                        <span style={{ fontSize: '11px', color: 'var(--slate-400)', display: 'block' }}>Monthly Wage Baseline</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(payslip.baseSalary)}</span>
                    </div>

                    {/* Persisted Earning Rules */}
                    {payslip.earnings && payslip.earnings.length > 0 ? (
                      payslip.earnings.map((e, idx) => (
                        <div key={`${e.ruleCode}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px dashed var(--slate-200)', paddingTop: '6px' }}>
                          <div>
                            <span style={{ fontWeight: 500 }}>{e.ruleName}</span>
                            <span style={{ fontSize: '11px', color: 'var(--slate-400)', display: 'block' }}>Rule: {e.ruleCode}</span>
                          </div>
                          <span style={{ fontWeight: 600, color: '#047857' }}>+{formatCurrency(e.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--slate-400)', fontStyle: 'italic', padding: '4px 0' }}>
                        No additional allowances computed.
                      </div>
                    )}

                    {/* Gross Subtotal */}
                    <div style={{ 
                      marginTop: '8px', 
                      paddingTop: '8px', 
                      borderTop: '2px solid var(--border-color)', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>GROSS SALARY</span>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>{formatCurrency(payslip.grossSalary)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions Section */}
                <div style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '6px', 
                  overflow: 'hidden' 
                }}>
                  <div style={{ 
                    padding: '8px 12px', 
                    background: 'var(--slate-100)', 
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--slate-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Deductions Breakdown
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
                      {payslip.deductions?.length || 0} Components
                    </span>
                  </div>

                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {payslip.deductions && payslip.deductions.length > 0 ? (
                      payslip.deductions.map((d, idx) => (
                        <div key={`${d.ruleCode}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: idx > 0 ? '1px dashed var(--slate-200)' : 'none', paddingTop: idx > 0 ? '6px' : '0' }}>
                          <div>
                            <span style={{ fontWeight: 500 }}>{d.ruleName}</span>
                            <span style={{ fontSize: '11px', color: 'var(--slate-400)', display: 'block' }}>Rule: {d.ruleCode}</span>
                          </div>
                          <span style={{ fontWeight: 600, color: '#be123c' }}>-{formatCurrency(d.amount)}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: '12px', color: 'var(--slate-400)', fontStyle: 'italic', padding: '12px 0' }}>
                        No deductions recorded for this cycle.
                      </div>
                    )}

                    {/* Total Deductions Subtotal */}
                    <div style={{ 
                      marginTop: 'auto', 
                      paddingTop: '8px', 
                      borderTop: '2px solid var(--border-color)', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center' 
                    }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#be123c' }}>TOTAL DEDUCTIONS</span>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: '#be123c' }}>-{formatCurrency(payslip.totalDeductions)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Payout Banner */}
              <div style={{ 
                background: 'var(--primary-light)', 
                border: '1px solid rgba(99, 102, 241, 0.3)', 
                padding: '16px', 
                borderRadius: '6px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Net Salary Disbursement
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--slate-600)', marginTop: '2px' }}>
                    Calculated deterministically: Gross ({formatCurrency(payslip.grossSalary)}) − Deductions ({formatCurrency(payslip.totalDeductions)})
                  </div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>
                  {formatCurrency(payslip.netSalary)}
                </div>
              </div>

              {/* Audit & Lifecycle Footer Strip */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                gap: '8px', 
                fontSize: '11px', 
                color: 'var(--slate-500)',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)'
              }}>
                <div>
                  <Clock size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                  <strong>Calculated:</strong> {formatDateTime(payslip.calculatedAt)}
                </div>
                <div>
                  <CheckCircle2 size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                  <strong>Validated:</strong> {payslip.validatedAt ? formatDateTime(payslip.validatedAt) : 'Pending'}
                </div>
                <div>
                  <CreditCard size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                  <strong>Disbursed:</strong> {payslip.paidAt ? formatDateTime(payslip.paidAt) : 'Unpaid'}
                </div>
                {payslip.paymentReference && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>Ref:</strong> {payslip.paymentReference}
                  </div>
                )}
              </div>
            </div>

            {/* Download Error Alert */}
            {downloadError && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: '6px',
                color: 'var(--danger-text)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{downloadError}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="modal-footer" style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={downloading}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={handleDownloadPdf}
                disabled={downloading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {downloading ? (
                  <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Download size={14} />
                )}
                <span>{downloading ? 'Generating PDF…' : 'Download PDF'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
