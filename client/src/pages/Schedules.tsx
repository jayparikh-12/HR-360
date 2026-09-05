import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Plus,
  X,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { schedulesApi, type ScheduleRecord, type CreateSchedulePayload } from '../api/schedules';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface SchedulesProps {
  onNavigateTab?: (tab: string) => void;
}

// ── Schedule Detail Modal ───────────────────────────────────────────────────

interface ScheduleDetailModalProps {
  scheduleId: string;
  onClose: () => void;
}

export const ScheduleDetailModal: React.FC<ScheduleDetailModalProps> = ({ scheduleId, onClose }) => {
  const [schedule, setSchedule] = useState<ScheduleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const data = await schedulesApi.getById(scheduleId);
        if (!cancelled) setSchedule(data);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.statusCode === 404 ? 'Working schedule not found.' : err.message);
          } else {
            setError('Failed to load schedule details.');
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
  }, [scheduleId]);

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
          width: '100%', maxWidth: '480px', background: '#fff',
          borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)' }}>
              Working Schedule Details
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
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--slate-500)', fontSize: '13px' }}>
            <RefreshCw size={20} className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
            <div>Loading schedule…</div>
          </div>
        ) : error ? (
          <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #f87171', borderRadius: '8px', color: '#b91c1c', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : schedule ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--slate-100)' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--slate-900)' }}>
                  {schedule.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--slate-500)' }}>
                  ID: {schedule.id}
                </div>
              </div>
              <span className="badge badge-success">
                <span className="badge-dot" />
                Active
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)' }}>Weekly Hours</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                  {schedule.weeklyHours} hrs / week
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)' }}>Working Hours Definition</span>
                <span style={{ fontWeight: 600 }}>{schedule.workingHours}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--slate-500)' }}>Standard Shift Structure</span>
                <span style={{ fontWeight: 500, color: 'var(--slate-700)' }}>Monday – Friday (Core Hours)</span>
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

// ── Create Schedule Modal ───────────────────────────────────────────────────

interface CreateScheduleModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export const CreateScheduleModal: React.FC<CreateScheduleModalProps> = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [workingHours, setWorkingHours] = useState('40h');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedHours = workingHours.trim();

    if (!trimmedName) {
      setError('Schedule name is required.');
      return;
    }
    if (!trimmedHours) {
      setError('Working hours definition is required.');
      return;
    }
    if (!/^[a-zA-Z0-9\s-]+$/.test(trimmedHours)) {
      setError('Working hours may only contain alphanumeric characters, spaces, and hyphens.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateSchedulePayload = {
        name: trimmedName,
        workingHours: trimmedHours,
      };

      await schedulesApi.create(payload);
      onCreated();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setError('A schedule with this name already exists.');
        } else if (err.statusCode === 400) {
          setError(err.message || 'Validation error. Please check form inputs.');
        } else if (err.statusCode === 401) {
          setError('Session expired or unauthorized. Please sign in again.');
        } else {
          setError(err.message || 'Failed to create working schedule.');
        }
      } else {
        setError('Failed to create schedule. Please check connection and try again.');
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
          width: '100%', maxWidth: '460px', background: '#fff',
          borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-900)' }}>
              Create Working Schedule
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
            <label style={labelStyle}>Schedule Name *</label>
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. Standard 40h Full-Time"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle}>Working Hours Definition *</label>
            <input
              type="text"
              style={inputStyle}
              placeholder="e.g. 40h, 37.5h, or Standard 40h"
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--slate-400)', marginTop: '2px' }}>
              Defines standard weekly hours for attendance & payroll pro-rata calculations.
            </span>
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
              {submitting ? 'Creating…' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Schedules View ─────────────────────────────────────────────────────

export const Schedules: React.FC<SchedulesProps> = () => {
  const { displayRole } = useAuth();
  const canCreateSchedule = displayRole === 'Admin' || displayRole === 'HR Manager';
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await schedulesApi.getAll();
      setSchedules(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to connect to schedules service. Please verify server is running.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  return (
    <div>
      {/* Detail Modal */}
      {selectedScheduleId && (
        <ScheduleDetailModal
          scheduleId={selectedScheduleId}
          onClose={() => setSelectedScheduleId(null)}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateScheduleModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadSchedules}
        />
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Working Schedules</h1>
          <p className="page-desc">
            Operational work time models and baseline shift schedules persisted in MySQL.
          </p>
        </div>
        {canCreateSchedule && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> New Schedule
          </button>
        )}
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
            onClick={loadSchedules}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Schedule Cards / States */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 0', color: 'var(--slate-500)', fontSize: '13px' }}>
          <RefreshCw size={22} className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
          <div>Loading working schedules from MySQL…</div>
        </div>
      ) : schedules.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-400)' }}>
          <Clock size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--slate-700)' }}>
            No working schedules found
          </div>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Create your organization's first working schedule to assign to employee contracts.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {schedules.map((s) => (
            <div
              key={s.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s, box-shadow 0.15s',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedScheduleId(s.id)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'var(--primary-light)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Clock size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--slate-900)', fontSize: '15px' }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-400)' }}>
                        ID: {s.id}
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-success">
                    <span className="badge-dot" />
                    Standard
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '14px 0', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--slate-500)' }}>Weekly Work Hours</span>
                    <span style={{ fontWeight: 700, color: 'var(--slate-900)' }}>
                      {s.weeklyHours} hours
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--slate-500)' }}>Definition</span>
                    <span style={{ fontWeight: 500, color: 'var(--slate-700)' }}>
                      {s.workingHours}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: '12px', borderTop: '1px solid var(--slate-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--slate-500)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> Standard Workweek
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedScheduleId(s.id);
                  }}
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
