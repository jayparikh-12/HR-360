import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  FileCode,
  Plus,
  Search,
  X,
  AlertCircle,
  RefreshCw,
  IndianRupee,
  Percent,
  Calculator,
  Eye,
} from 'lucide-react';
import {
  salaryStructuresApi,
  type SalaryStructure,
  type CreateSalaryStructurePayload,
} from '../api/salaryStructures';
import {
  salaryRulesApi,
  type SalaryRule,
  type CreateSalaryRulePayload,
} from '../api/salaryRules';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface SalaryStructuresProps {
  onNavigateTab?: (tab: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryBadge(category: string) {
  const cat = (category || '').toUpperCase();
  switch (cat) {
    case 'BASIC':
      return { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe', label: 'Basic' };
    case 'ALLOWANCE':
      return { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', label: 'Allowance' };
    case 'GROSS':
      return { bg: '#fef3c7', color: '#b45309', border: '#fde68a', label: 'Gross' };
    case 'DEDUCTION':
      return { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca', label: 'Deduction' };
    case 'NET':
      return { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff', label: 'Net' };
    default:
      return { bg: 'var(--slate-100)', color: 'var(--slate-700)', border: 'var(--slate-200)', label: category };
  }
}

function getCalculationTypeBadge(type: string) {
  const t = (type || '').toUpperCase();
  switch (t) {
    case 'FIXED':
      return { icon: IndianRupee, label: 'Fixed Amount', bg: '#f8fafc', color: '#334155' };
    case 'PERCENTAGE':
      return { icon: Percent, label: 'Percentage', bg: '#eff6ff', color: '#1d4ed8' };
    case 'FORMULA':
      return { icon: Calculator, label: 'Formula', bg: '#faf5ff', color: '#6b21a8' };
    default:
      return { icon: FileCode, label: type, bg: '#f8fafc', color: '#334155' };
  }
}

function formatRuleValue(rule: SalaryRule): string {
  if (rule.calculationType === 'FIXED') {
    return rule.amount !== null && rule.amount !== undefined
      ? `₹${rule.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : 'Fixed';
  }
  if (rule.calculationType === 'PERCENTAGE') {
    return rule.percentage !== null && rule.percentage !== undefined
      ? `${rule.percentage}%`
      : 'Percentage';
  }
  if (rule.calculationType === 'FORMULA') {
    return rule.formula || 'Formula';
  }
  return '—';
}

// ── Structure Detail Modal ───────────────────────────────────────────────────

interface StructureDetailModalProps {
  structureId: string;
  onClose: () => void;
  onSelectStructureForRules: (id: string) => void;
}

export const StructureDetailModal: React.FC<StructureDetailModalProps> = ({
  structureId,
  onClose,
  onSelectStructureForRules,
}) => {
  const [structure, setStructure] = useState<SalaryStructure | null>(null);
  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [structData, rulesData] = await Promise.all([
          salaryStructuresApi.getById(structureId),
          salaryRulesApi.getAll(structureId),
        ]);
        if (!cancelled) {
          setStructure(structData);
          setRules(rulesData);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.statusCode === 404) {
            setError('Salary structure not found in database.');
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load structure details.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [structureId]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)' }}>
              Salary Structure Details
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
            <div>Loading structure details…</div>
          </div>
        ) : error ? (
          <div
            style={{
              padding: '14px',
              background: '#fef2f2',
              border: '1px solid #f87171',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : structure ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--slate-100)' }}>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--slate-900)', margin: 0 }}>
                  {structure.name}
                </h4>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--slate-100)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, color: 'var(--slate-700)' }}>
                    ID: {structure.id}
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    CODE: {structure.code}
                  </span>
                </div>
              </div>
              <span className="status-pill status-active">Active</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--slate-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: '11px', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Assigned Contracts
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)', marginTop: '4px' }}>
                  {structure.contractCount} {structure.contractCount === 1 ? 'Contract' : 'Contracts'}
                </div>
              </div>
              <div style={{ background: 'var(--slate-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: '11px', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Configured Rules
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)', marginTop: '4px' }}>
                  {rules.length} {rules.length === 1 ? 'Rule' : 'Rules'}
                </div>
              </div>
            </div>

            {/* Rules Sequence Preview */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h5 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--slate-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Sequential Calculation Rules
                </h5>
                <button
                  onClick={() => {
                    onSelectStructureForRules(structure.id);
                    onClose();
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  Manage in Rules Tab
                </button>
              </div>

              {rules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', background: 'var(--slate-50)', borderRadius: '8px', border: '1px dashed var(--slate-200)', color: 'var(--slate-500)', fontSize: '13px' }}>
                  No salary rules attached to this structure yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {rules.map((r, idx) => {
                    const badge = getCategoryBadge(r.category);
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: '#fff',
                          border: '1px solid var(--slate-200)',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', width: '20px' }}>
                            #{r.sequence || idx + 1}
                          </span>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{r.name}</span>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--slate-500)', marginLeft: '6px' }}>
                              ({r.code})
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              background: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            {badge.label}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--slate-700)', fontSize: '12px' }}>
                            {formatRuleValue(r)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--slate-100)' }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ── Rule Detail Modal ────────────────────────────────────────────────────────

interface RuleDetailModalProps {
  ruleId: string;
  onClose: () => void;
}

export const RuleDetailModal: React.FC<RuleDetailModalProps> = ({ ruleId, onClose }) => {
  const [rule, setRule] = useState<SalaryRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const ruleData = await salaryRulesApi.getById(ruleId);
        if (!cancelled) setRule(ruleData);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.statusCode === 404) {
            setError('Salary rule not found in database.');
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load rule details.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [ruleId]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCode size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)' }}>
              Salary Rule Details
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
            <div>Loading rule details…</div>
          </div>
        ) : error ? (
          <div
            style={{
              padding: '14px',
              background: '#fef2f2',
              border: '1px solid #f87171',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : rule ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--slate-100)' }}>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--slate-900)', margin: 0 }}>
                  {rule.name}
                </h4>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--slate-100)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, color: 'var(--slate-700)' }}>
                    ID: {rule.id}
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    CODE: {rule.code}
                  </span>
                  <span style={{ fontSize: '11px', background: 'var(--slate-100)', color: 'var(--slate-600)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Sequence: #{rule.sequence}
                  </span>
                </div>
              </div>
              {(() => {
                const badge = getCategoryBadge(rule.category);
                return (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      padding: '3px 10px',
                      borderRadius: '999px',
                    }}
                  >
                    {badge.label}
                  </span>
                );
              })()}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--slate-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--slate-200)' }}>
                <div style={{ fontSize: '11px', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                  Associated Structure
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-900)', marginTop: '4px' }}>
                  {rule.structureName || rule.salaryStructure?.name || rule.structureId || 'None'}
                </div>
                {rule.structureCode && (
                  <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '2px' }}>
                    Code: {rule.structureCode}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'var(--slate-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Calculation Type
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--slate-900)', marginTop: '4px' }}>
                    {rule.calculationType}
                  </div>
                </div>
                <div style={{ background: 'var(--slate-50)', padding: '12px', borderRadius: '8px', border: '1px solid var(--slate-200)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--slate-500)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Computed Value / Rate
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)', marginTop: '4px' }}>
                    {formatRuleValue(rule)}
                  </div>
                </div>
              </div>

              {rule.formula && (
                <div style={{ background: '#0f172a', color: '#e2e8f0', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
                  <div style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Deterministic Formula
                  </div>
                  <code>{rule.formula}</code>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--slate-100)' }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

// ── Create Structure Modal ───────────────────────────────────────────────────

interface CreateStructureModalProps {
  onClose: () => void;
  onSuccess: (newStructure: SalaryStructure) => void;
}

export const CreateStructureModal: React.FC<CreateStructureModalProps> = ({ onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [customId, setCustomId] = useState('');
  const [baseWage, setBaseWage] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!name.trim()) {
      setError('Structure name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Structure code is required.');
      return;
    }

    let parsedWage: number | undefined = undefined;
    if (baseWage.trim() !== '') {
      const num = Number(baseWage);
      if (isNaN(num) || num < 0) {
        setError('Base wage must be a non-negative number.');
        return;
      }
      parsedWage = num;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: CreateSalaryStructurePayload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        id: customId.trim() || undefined,
        baseWage: parsedWage,
      };
      const created = await salaryStructuresApi.create(payload);
      onSuccess(created);
    } catch (err) {
      console.error('[CreateStructureModal] Error:', err instanceof Error ? err.message : String(err));
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setError(err.message || 'Salary structure with this code or ID already exists.');
        } else if (err.statusCode === 400) {
          setError(err.message || 'Validation error. Please check your inputs.');
        } else {
          setError(err.message || 'Failed to create salary structure.');
        }
      } else {
        setError('Failed to create salary structure. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)' }}>
              New Salary Structure
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
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #f87171',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
              Structure Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              className="role-select"
              style={{ width: '100%', padding: '8px 12px' }}
              placeholder="e.g. Standard Executive Compensation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
                Structure Code <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="role-select"
                style={{ width: '100%', padding: '8px 12px', textTransform: 'uppercase' }}
                placeholder="e.g. EXEC_STD"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
                Custom ID <span style={{ fontSize: '11px', color: 'var(--slate-400)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                type="text"
                className="role-select"
                style={{ width: '100%', padding: '8px 12px' }}
                placeholder="Auto-generated if blank"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
              Default Base Wage <span style={{ fontSize: '11px', color: 'var(--slate-400)', fontWeight: 400 }}>(optional, INR)</span>
            </label>
            <input
              type="number"
              min="0"
              step="100"
              className="role-select"
              style={{ width: '100%', padding: '8px 12px' }}
              placeholder="e.g. 60000.00"
              value={baseWage}
              onChange={(e) => setBaseWage(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--slate-100)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Create Structure</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Create Rule Modal ────────────────────────────────────────────────────────

interface CreateRuleModalProps {
  structures: SalaryStructure[];
  preselectedStructureId?: string;
  onClose: () => void;
  onSuccess: (newRule: SalaryRule) => void;
}

export const CreateRuleModal: React.FC<CreateRuleModalProps> = ({
  structures,
  preselectedStructureId,
  onClose,
  onSuccess,
}) => {
  const [structureId, setStructureId] = useState<string>(
    preselectedStructureId || (structures[0]?.id || '')
  );
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sequence, setSequence] = useState<number>(1);
  const [category, setCategory] = useState<'BASIC' | 'ALLOWANCE' | 'GROSS' | 'DEDUCTION' | 'NET'>('ALLOWANCE');
  const [calculationType, setCalculationType] = useState<'FIXED' | 'PERCENTAGE' | 'FORMULA'>('FIXED');
  const [amount, setAmount] = useState<string>('');
  const [percentage, setPercentage] = useState<string>('');
  const [formula, setFormula] = useState<string>('');
  const [customId, setCustomId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!structureId.trim()) {
      setError('Salary structure is required.');
      return;
    }
    if (!name.trim()) {
      setError('Rule name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Rule code is required.');
      return;
    }
    if (sequence < 1) {
      setError('Sequence must be an integer >= 1.');
      return;
    }

    let parsedAmount: number | null = null;
    let parsedPercentage: number | null = null;

    if (calculationType === 'FIXED') {
      if (amount.trim() === '') {
        setError('Fixed amount is required.');
        return;
      }
      const num = Number(amount);
      if (isNaN(num) || num < 0) {
        setError('Amount must be a non-negative number.');
        return;
      }
      parsedAmount = num;
    } else if (calculationType === 'PERCENTAGE') {
      if (percentage.trim() === '') {
        setError('Percentage value is required.');
        return;
      }
      const num = Number(percentage);
      if (isNaN(num) || num < 0 || num > 100) {
        setError('Percentage must be a number between 0 and 100.');
        return;
      }
      parsedPercentage = num;
    } else if (calculationType === 'FORMULA') {
      if (!formula.trim()) {
        setError('Formula expression is required.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload: CreateSalaryRulePayload = {
        structureId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        sequence,
        category,
        calculationType,
        amount: parsedAmount,
        percentage: parsedPercentage,
        formula: calculationType === 'FORMULA' ? formula.trim() : null,
        id: customId.trim() || undefined,
      };

      const created = await salaryRulesApi.create(payload);
      onSuccess(created);
    } catch (err) {
      console.error('[CreateRuleModal] Error:', err instanceof Error ? err.message : String(err));
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setError(err.message || 'Rule code or ID already exists in this structure.');
        } else if (err.statusCode === 404) {
          setError(err.message || 'Referenced salary structure does not exist.');
        } else if (err.statusCode === 400) {
          setError(err.message || 'Validation error. Please check your inputs.');
        } else {
          setError(err.message || 'Failed to create salary rule.');
        }
      } else {
        setError('Failed to create salary rule. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileCode size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)' }}>
              New Salary Rule
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
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #f87171',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Structure Selector */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
              Assign to Structure <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              className="role-select"
              style={{ width: '100%', padding: '8px 12px' }}
              value={structureId}
              onChange={(e) => setStructureId(e.target.value)}
              required
            >
              <option value="" disabled>Select Salary Structure…</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
              Rule Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              className="role-select"
              style={{ width: '100%', padding: '8px 12px' }}
              placeholder="e.g. Conveyance Allowance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
                Rule Code <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="role-select"
                style={{ width: '100%', padding: '8px 12px', textTransform: 'uppercase' }}
                placeholder="e.g. CONVEYANCE"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
                Sequence <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                className="role-select"
                style={{ width: '100%', padding: '8px 12px' }}
                value={sequence}
                onChange={(e) => setSequence(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
                Category <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                className="role-select"
                style={{ width: '100%', padding: '8px 12px' }}
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                required
              >
                <option value="BASIC">Basic</option>
                <option value="ALLOWANCE">Allowance</option>
                <option value="GROSS">Gross</option>
                <option value="DEDUCTION">Deduction</option>
                <option value="NET">Net</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
                Calculation Type <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                className="role-select"
                style={{ width: '100%', padding: '8px 12px' }}
                value={calculationType}
                onChange={(e) => setCalculationType(e.target.value as any)}
                required
              >
                <option value="FIXED">Fixed Amount</option>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FORMULA">Formula</option>
              </select>
            </div>
          </div>

          {/* Dynamic Value Input */}
          {calculationType === 'FIXED' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
                Fixed Amount (₹ / INR) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="0"
                step="50"
                className="role-select"
                style={{ width: '100%', padding: '8px 12px' }}
                placeholder="e.g. 2500.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          )}

          {calculationType === 'PERCENTAGE' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
                Percentage Rate (%) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="role-select"
                style={{ width: '100%', padding: '8px 12px' }}
                placeholder="e.g. 20.0"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                required
              />
            </div>
          )}

          {calculationType === 'FORMULA' && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
                Formula Expression <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                className="role-select"
                rows={2}
                style={{ width: '100%', padding: '8px 12px', fontFamily: 'monospace', fontSize: '12px' }}
                placeholder="e.g. BASIC * 0.40"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                required
              />
              <div style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '4px' }}>
                Supported symbols: BASIC, GROSS, NET, contract.wage
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '4px' }}>
              Custom ID <span style={{ fontSize: '11px', color: 'var(--slate-400)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              className="role-select"
              style={{ width: '100%', padding: '8px 12px' }}
              placeholder="e.g. RUL-99"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--slate-100)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Plus size={14} />
                  <span>Create Salary Rule</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page Component ──────────────────────────────────────────────────────

export const SalaryStructures: React.FC<SalaryStructuresProps> = () => {
  const { displayRole } = useAuth();
  const isAdmin = displayRole === 'Admin';
  const [activeTab, setActiveTab] = useState<'structures' | 'rules'>('structures');

  // Data states
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [rules, setRules] = useState<SalaryRule[]>([]);
  const [loadingStructures, setLoadingStructures] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStructureFilter, setSelectedStructureFilter] = useState<string>('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Modals
  const [createStructureModalOpen, setCreateStructureModalOpen] = useState(false);
  const [createRuleModalOpen, setCreateRuleModalOpen] = useState(false);
  const [detailStructureId, setDetailStructureId] = useState<string | null>(null);
  const [detailRuleId, setDetailRuleId] = useState<string | null>(null);

  // Load all structures
  const loadStructures = useCallback(async () => {
    setLoadingStructures(true);
    setError(null);
    try {
      const data = await salaryStructuresApi.getAll();
      setStructures(data);
    } catch (err) {
      console.error('[SalaryStructures] Failed to load structures:', err instanceof Error ? err.message : String(err));
      setError(err instanceof ApiError ? err.message : 'Unable to load salary structures from server.');
    } finally {
      setLoadingStructures(false);
    }
  }, []);

  // Load rules (with optional structure filter)
  const loadRules = useCallback(async (structureId?: string) => {
    setLoadingRules(true);
    setError(null);
    try {
      const queryId = structureId && structureId !== 'ALL' ? structureId : undefined;
      const data = await salaryRulesApi.getAll(queryId);
      setRules(data);
    } catch (err) {
      console.error('[SalaryStructures] Failed to load rules:', err instanceof Error ? err.message : String(err));
      setError(err instanceof ApiError ? err.message : 'Unable to load salary rules from server.');
    } finally {
      setLoadingRules(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadStructures();
    loadRules();
  }, [loadStructures, loadRules]);

  // Handle structure filter change on rules tab
  const handleStructureFilterChange = (newStructureId: string) => {
    setSelectedStructureFilter(newStructureId);
    loadRules(newStructureId);
  };

  // Filtered Structures list
  const filteredStructures = structures.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  // Filtered Rules list
  const filteredRules = rules.filter((r) => {
    const matchesCategory =
      selectedCategoryFilter === 'ALL' || r.category.toUpperCase() === selectedCategoryFilter.toUpperCase();
    if (!matchesCategory) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.structureName && r.structureName.toLowerCase().includes(q))
    );
  });

  // Quick stats
  const totalStructures = structures.length;
  const totalRules = rules.length;
  const allowancesCount = rules.filter((r) => r.category === 'ALLOWANCE').length;
  const deductionsCount = rules.filter((r) => r.category === 'DEDUCTION').length;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Salary Structures & Rules</h1>
          <p className="page-desc">
            Define hierarchical compensation templates, calculation formulas, and deterministic rule execution sequences.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              loadStructures();
              loadRules(selectedStructureFilter);
            }}
            title="Refresh from MySQL"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          {isAdmin && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setCreateRuleModalOpen(true)}
                disabled={structures.length === 0}
              >
                <Plus size={14} />
                <span>New Salary Rule</span>
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setCreateStructureModalOpen(true)}
              >
                <Plus size={14} />
                <span>New Structure</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: '8px',
            color: '#b91c1c',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
            onClick={() => {
              loadStructures();
              loadRules(selectedStructureFilter);
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>
            <Layers size={18} />
          </div>
          <div>
            <div className="stat-value">{totalStructures}</div>
            <div className="stat-label">Salary Structures</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>
            <FileCode size={18} />
          </div>
          <div>
            <div className="stat-value">{totalRules}</div>
            <div className="stat-label">Total Rules Configured</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
            <IndianRupee size={18} />
          </div>
          <div>
            <div className="stat-value">{allowancesCount}</div>
            <div className="stat-label">Allowance Rules</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
            <Calculator size={18} />
          </div>
          <div>
            <div className="stat-value">{deductionsCount}</div>
            <div className="stat-label">Deduction Rules</div>
          </div>
        </div>
      </div>

      {/* Tabs / View Switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--slate-200)', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('structures')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'structures' ? 'var(--primary)' : 'var(--slate-500)',
            borderBottom: activeTab === 'structures' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: '-1px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Layers size={16} />
          <span>Salary Structures ({totalStructures})</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'rules' ? 'var(--primary)' : 'var(--slate-500)',
            borderBottom: activeTab === 'rules' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: '-1px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FileCode size={16} />
          <span>Salary Rules ({totalRules})</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div className="search-box" style={{ width: '300px' }}>
          <Search size={16} color="var(--slate-400)" />
          <input
            type="text"
            placeholder={activeTab === 'structures' ? 'Search structures by name or code…' : 'Search rules by name or code…'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--slate-400)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {activeTab === 'rules' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Structure Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-500)' }}>Structure:</span>
              <select
                className="role-select"
                value={selectedStructureFilter}
                onChange={(e) => handleStructureFilterChange(e.target.value)}
              >
                <option value="ALL">All Structures</option>
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-500)' }}>Category:</span>
              <select
                className="role-select"
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="ALL">All Categories</option>
                <option value="BASIC">Basic</option>
                <option value="ALLOWANCE">Allowance</option>
                <option value="GROSS">Gross</option>
                <option value="DEDUCTION">Deduction</option>
                <option value="NET">Net</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: SALARY STRUCTURES */}
      {activeTab === 'structures' && (
        <div className="card" style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
          {loadingStructures ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-500)' }}>
              <RefreshCw size={24} className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
              <div>Loading salary structures from database…</div>
            </div>
          ) : filteredStructures.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-500)' }}>
              <Layers size={36} color="var(--slate-300)" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '4px' }}>
                No Salary Structures Found
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--slate-500)', marginBottom: '16px' }}>
                {searchQuery ? 'Try adjusting your search query.' : 'Create your first compensation structure to get started.'}
              </p>
              {!searchQuery && (
                <button className="btn btn-primary" onClick={() => setCreateStructureModalOpen(true)}>
                  <Plus size={14} />
                  <span>Create Structure</span>
                </button>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Structure ID</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Structure Name</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Code</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Contracts</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStructures.map((struct) => (
                    <tr
                      key={struct.id}
                      style={{ borderBottom: '1px solid var(--slate-100)', transition: 'background 0.15s' }}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--slate-600)' }}>
                        {struct.id}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{struct.name}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: '#e0e7ff',
                            color: '#4338ca',
                          }}
                        >
                          {struct.code}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--slate-700)' }}>
                        <span style={{ fontWeight: 600 }}>{struct.contractCount}</span>{' '}
                        <span style={{ color: 'var(--slate-400)', fontSize: '12px' }}>
                          {struct.contractCount === 1 ? 'active contract' : 'active contracts'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="status-pill status-active">Active</span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => {
                              setSelectedStructureFilter(struct.id);
                              setActiveTab('rules');
                              loadRules(struct.id);
                            }}
                            title="View Rules for this structure"
                          >
                            <FileCode size={13} />
                            <span>View Rules</span>
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => setDetailStructureId(struct.id)}
                            title="View Structure Details"
                          >
                            <Eye size={13} />
                            <span>Details</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SALARY RULES */}
      {activeTab === 'rules' && (
        <div className="card" style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden' }}>
          {selectedStructureFilter !== 'ALL' && (
            <div
              style={{
                padding: '10px 16px',
                background: '#eef2ff',
                borderBottom: '1px solid #c7d2fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#3730a3',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={15} />
                <span>
                  Filtering rules for structure:{' '}
                  <strong>
                    {structures.find((s) => s.id === selectedStructureFilter)?.name || selectedStructureFilter}
                  </strong>
                </span>
              </div>
              <button
                onClick={() => handleStructureFilterChange('ALL')}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#4338ca',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Clear Filter (Show All)
              </button>
            </div>
          )}

          {loadingRules ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-500)' }}>
              <RefreshCw size={24} className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
              <div>Loading salary rules from database…</div>
            </div>
          ) : filteredRules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-500)' }}>
              <FileCode size={36} color="var(--slate-300)" style={{ marginBottom: '12px' }} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--slate-800)', marginBottom: '4px' }}>
                {selectedStructureFilter !== 'ALL'
                  ? 'No Rules Configured for This Structure'
                  : 'No Salary Rules Found'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--slate-500)', marginBottom: '16px' }}>
                {selectedStructureFilter !== 'ALL'
                  ? 'This structure has no associated calculation rules yet.'
                  : searchQuery
                  ? 'No rules match your search criteria.'
                  : 'Configure calculation rules to establish deterministic payroll pipelines.'}
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setCreateRuleModalOpen(true)}
                disabled={structures.length === 0}
              >
                <Plus size={14} />
                <span>Create Salary Rule</span>
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--slate-50)', borderBottom: '1px solid var(--slate-200)' }}>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', width: '60px' }}>Seq</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Code</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Rule Name</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Calculation</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Amount / Rate</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Structure</th>
                    <th style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((rule) => {
                    const categoryBadge = getCategoryBadge(rule.category);
                    const calcBadge = getCalculationTypeBadge(rule.calculationType);
                    const CalcIcon = calcBadge.icon;

                    return (
                      <tr
                        key={rule.id}
                        style={{ borderBottom: '1px solid var(--slate-100)', transition: 'background 0.15s' }}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--slate-400)' }}>
                          #{rule.sequence}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: '#f1f5f9',
                              color: '#334155',
                            }}
                          >
                            {rule.code}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{rule.name}</div>
                          <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--slate-400)' }}>ID: {rule.id}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: categoryBadge.bg,
                              color: categoryBadge.color,
                              border: `1px solid ${categoryBadge.border}`,
                            }}
                          >
                            {categoryBadge.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: calcBadge.bg,
                              color: calcBadge.color,
                            }}
                          >
                            <CalcIcon size={12} />
                            <span>{calcBadge.label}</span>
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--slate-900)' }}>
                          {formatRuleValue(rule)}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--slate-600)' }}>
                          <div>{rule.structureName || rule.salaryStructure?.name || rule.structureId}</div>
                          {rule.structureCode && (
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--slate-400)' }}>
                              ({rule.structureCode})
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                            onClick={() => setDetailRuleId(rule.id)}
                            title="View Rule Details"
                          >
                            <Eye size={13} />
                            <span>Details</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Structure Detail Modal */}
      {detailStructureId && (
        <StructureDetailModal
          structureId={detailStructureId}
          onClose={() => setDetailStructureId(null)}
          onSelectStructureForRules={(id) => {
            setSelectedStructureFilter(id);
            setActiveTab('rules');
            loadRules(id);
          }}
        />
      )}

      {/* Rule Detail Modal */}
      {detailRuleId && (
        <RuleDetailModal
          ruleId={detailRuleId}
          onClose={() => setDetailRuleId(null)}
        />
      )}

      {/* Create Structure Modal */}
      {createStructureModalOpen && (
        <CreateStructureModal
          onClose={() => setCreateStructureModalOpen(false)}
          onSuccess={(newStruct) => {
            setCreateStructureModalOpen(false);
            setStructures((prev) => [...prev, newStruct]);
            loadStructures();
          }}
        />
      )}

      {/* Create Rule Modal */}
      {createRuleModalOpen && (
        <CreateRuleModal
          structures={structures}
          preselectedStructureId={selectedStructureFilter !== 'ALL' ? selectedStructureFilter : undefined}
          onClose={() => setCreateRuleModalOpen(false)}
          onSuccess={(newRule) => {
            setCreateRuleModalOpen(false);
            setRules((prev) => [...prev, newRule]);
            loadRules(selectedStructureFilter);
          }}
        />
      )}
    </div>
  );
};
export default SalaryStructures;
