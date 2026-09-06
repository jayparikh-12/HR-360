import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CreditCard,
  Clock,
  Calendar,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Zap,
  Check,
  FileText,
  Lock,
  Sun,
  Moon,
  ChevronRight,
  TrendingUp,
  Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDefaultWorkspacePath } from '../utils/routes';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activePreviewTab, setActivePreviewTab] = useState<'metrics' | 'payruns' | 'activity'>('metrics');

  const handleCtaClick = () => {
    if (isAuthenticated) {
      navigate(getDefaultWorkspacePath(user?.role, true));
    } else {
      navigate('/login');
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-container">
      {/* ── Ambient Background Gradients ───────────────────────────────── */}
      <div className="landing-ambient-orb landing-orb-1" />
      <div className="landing-ambient-orb landing-orb-2" />

      {/* ── 1. NAVBAR ─────────────────────────────────────────────────── */}
      <header className="landing-navbar">
        <div className="landing-navbar-inner">
          <div className="landing-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="landing-logo-badge">P</div>
            <div className="landing-brand-text">
              <span className="landing-brand-title">PeoplePay360</span>
              <span className="landing-brand-tag">Platform</span>
            </div>
          </div>

          <nav className="landing-nav-links">
            <button type="button" onClick={() => scrollToSection('features')} className="landing-nav-link">
              Features
            </button>
            <button type="button" onClick={() => scrollToSection('preview')} className="landing-nav-link">
              Workspace Preview
            </button>
            <button type="button" onClick={() => scrollToSection('benefits')} className="landing-nav-link">
              Enterprise Value
            </button>
            <button type="button" onClick={() => scrollToSection('security')} className="landing-nav-link">
              Security
            </button>
          </nav>

          <div className="landing-nav-actions">
            <button
              type="button"
              className="landing-theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={16} color="#f59e0b" /> : <Moon size={16} color="#0f766e" />}
            </button>

            {isAuthenticated ? (
              <button
                type="button"
                className="btn btn-primary btn-sm landing-cta-nav"
                onClick={() => navigate(getDefaultWorkspacePath(user?.role, true))}
              >
                <span>Go to Workspace</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate('/login')}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm landing-cta-nav"
                  onClick={handleCtaClick}
                >
                  <span>Get Started</span>
                  <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. HERO SECTION ────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-pill-badge">
            <Sparkles size={13} color="var(--primary)" />
            <span>Built for ODOO Hackathon 2026 • Enterprise HR Operating System</span>
          </div>

          <h1 className="landing-hero-title">
            The Unified HR &amp; Payroll Platform <br className="hidden-mobile" />
            <span className="landing-hero-gradient">Engineered for Modern Enterprise</span>
          </h1>

          <p className="landing-hero-desc">
            Streamline your complete workforce lifecycle. From 360 employee records and automated geofenced
            attendance to mathematical, deterministic payruns and instant compliance disbursement — all in one centralized system.
          </p>

          <div className="landing-hero-actions">
            <button
              type="button"
              className="btn btn-primary landing-hero-btn-main"
              onClick={handleCtaClick}
            >
              <span>{isAuthenticated ? 'Open Workspace' : 'Get Started Free'}</span>
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="btn btn-secondary landing-hero-btn-secondary"
              onClick={() => scrollToSection('preview')}
            >
              <span>Explore Live Platform</span>
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="landing-trust-bar">
            <div className="landing-trust-item">
              <CheckCircle2 size={14} color="#059669" />
              <span>100% Deterministic Payroll Engine</span>
            </div>
            <div className="landing-trust-dot" />
            <div className="landing-trust-item">
              <CheckCircle2 size={14} color="#059669" />
              <span>Role-Based Access Control (RBAC)</span>
            </div>
            <div className="landing-trust-dot" />
            <div className="landing-trust-item">
              <CheckCircle2 size={14} color="#059669" />
              <span>Real-Time Attendance Sync</span>
            </div>
            <div className="landing-trust-dot" />
            <div className="landing-trust-item">
              <CheckCircle2 size={14} color="#059669" />
              <span>Zero Spreadsheets Needed</span>
            </div>
          </div>

          {/* ── Hero Window Mockup Graphic ── */}
          <div className="landing-hero-mockup-wrapper">
            <div className="landing-hero-mockup">
              <div className="mockup-window-bar">
                <div className="mockup-window-controls">
                  <span className="mockup-dot dot-red" />
                  <span className="mockup-dot dot-yellow" />
                  <span className="mockup-dot dot-green" />
                </div>
                <div className="mockup-window-address">
                  <Lock size={11} color="var(--primary)" />
                  <span>app.peoplepay360.internal/dashboard</span>
                </div>
                <div className="mockup-badge-live">
                  <span className="mockup-pulse-dot" />
                  <span>OCTOBER CYCLE LIVE</span>
                </div>
              </div>

              <div className="mockup-body">
                {/* Mini Stats Banner */}
                <div className="mockup-stats-grid">
                  <div className="mockup-stat-card">
                    <div className="mockup-stat-label">Total Gross Payroll</div>
                    <div className="mockup-stat-value">₹38,20,000.00</div>
                    <div className="mockup-stat-trend positive">↑ 4.2% vs last cycle</div>
                  </div>
                  <div className="mockup-stat-card">
                    <div className="mockup-stat-label">Net Disbursement</div>
                    <div className="mockup-stat-value highlight">₹32,67,200.00</div>
                    <div className="mockup-stat-trend">100% Verified</div>
                  </div>
                  <div className="mockup-stat-card">
                    <div className="mockup-stat-label">Active Headcount</div>
                    <div className="mockup-stat-value">284 Employees</div>
                    <div className="mockup-stat-trend positive">97.8% On-time</div>
                  </div>
                </div>

                {/* Mini Stepper Demo */}
                <div className="mockup-stepper-container">
                  <div className="mockup-stepper-title">
                    <span>Payrun State Engine: <strong>October 2026 Regular Cycle</strong></span>
                    <span className="badge badge-info">VALIDATED</span>
                  </div>
                  <div className="mockup-stepper-track">
                    <div className="mockup-step active">1. Draft</div>
                    <div className="mockup-step-line active" />
                    <div className="mockup-step active">2. Computed</div>
                    <div className="mockup-step-line active" />
                    <div className="mockup-step active">3. Validated</div>
                    <div className="mockup-step-line" />
                    <div className="mockup-step">4. Disbursed</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. KEY FEATURES SECTION ───────────────────────────────────── */}
      <section id="features" className="landing-section">
        <div className="landing-section-header">
          <div className="landing-section-tag">COMPREHENSIVE CAPABILITIES</div>
          <h2 className="landing-section-title">Everything You Need to Run Modern People Operations</h2>
          <p className="landing-section-desc">
            Designed for high-growth enterprise teams requiring mathematical reliability, strict audit trails, and effortless employee self-service.
          </p>
        </div>

        <div className="landing-features-grid">
          {/* Card 1 */}
          <div className="landing-feature-card">
            <div className="landing-feature-icon-box" style={{ background: 'rgba(15, 118, 110, 0.1)', color: '#0f766e' }}>
              <Users size={22} />
            </div>
            <h3 className="landing-feature-title">Employee 360 Hub</h3>
            <p className="landing-feature-text">
              Comprehensive employee records with contracts, compensation history, emergency contacts, banking credentials, and department org hierarchies.
            </p>
            <div className="landing-feature-footer">
              <span>Department trees &amp; role history</span>
              <Check size={14} color="#059669" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="landing-feature-card">
            <div className="landing-feature-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
              <CreditCard size={22} />
            </div>
            <h3 className="landing-feature-title">Deterministic Payroll</h3>
            <p className="landing-feature-text">
              Infallible 4-stage payrun state machine (`DRAFT` → `COMPUTED` → `VALIDATED` → `PAID`) calculating gross, allowances, deductions, and net salary.
            </p>
            <div className="landing-feature-footer">
              <span>Arithmetic guarantee formula</span>
              <Check size={14} color="#059669" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="landing-feature-card">
            <div className="landing-feature-icon-box" style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0284c7' }}>
              <Clock size={22} />
            </div>
            <h3 className="landing-feature-title">Smart Attendance</h3>
            <p className="landing-feature-text">
              Automated daily punch-in/out records, scheduled working shift adherence, overtime calculations, and instant sync to monthly pay runs.
            </p>
            <div className="landing-feature-footer">
              <span>Shift matching &amp; overtime audit</span>
              <Check size={14} color="#059669" />
            </div>
          </div>

          {/* Card 4 */}
          <div className="landing-feature-card">
            <div className="landing-feature-icon-box" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
              <Calendar size={22} />
            </div>
            <h3 className="landing-feature-title">Leave &amp; Time-Off</h3>
            <p className="landing-feature-text">
              Intuitive self-service time-off requests with manager approval queues, annual quota balances, and automatic unpaid leave deduction synchronization.
            </p>
            <div className="landing-feature-footer">
              <span>Automated quota deductions</span>
              <Check size={14} color="#059669" />
            </div>
          </div>

          {/* Card 5 */}
          <div className="landing-feature-card">
            <div className="landing-feature-icon-box" style={{ background: 'rgba(14, 116, 144, 0.1)', color: '#0e7490' }}>
              <FileText size={22} />
            </div>
            <h3 className="landing-feature-title">Contracts &amp; Salary Rules</h3>
            <p className="landing-feature-text">
              Manage employment contracts, structured wage grades, custom allowances, fixed/percentage/formula deduction rules, and schedule calendars.
            </p>
            <div className="landing-feature-footer">
              <span>Flexible formula configuration</span>
              <Check size={14} color="#059669" />
            </div>
          </div>

          {/* Card 6 */}
          <div className="landing-feature-card">
            <div className="landing-feature-icon-box" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#e11d48' }}>
              <BarChart3 size={22} />
            </div>
            <h3 className="landing-feature-title">Analytics &amp; Payslips</h3>
            <p className="landing-feature-text">
              Real-time executive KPI metrics, departmental budget visualizations, instant PDF voucher generation, and historical salary archives.
            </p>
            <div className="landing-feature-footer">
              <span>One-click encrypted PDF vouchers</span>
              <Check size={14} color="#059669" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. DASHBOARD PREVIEW SECTION ──────────────────────────────── */}
      <section id="preview" className="landing-section landing-section-alt">
        <div className="landing-section-header">
          <div className="landing-section-tag">LIVE PLATFORM EXPERIENCE</div>
          <h2 className="landing-section-title">The Enterprise Command Center</h2>
          <p className="landing-section-desc">
            Explore how PeoplePay360 delivers total operational clarity for executives, HR managers, and employees.
          </p>
        </div>

        <div className="landing-preview-container">
          {/* Interactive Preview Switcher Bar */}
          <div className="landing-preview-tabs">
            <button
              type="button"
              className={`landing-preview-tab ${activePreviewTab === 'metrics' ? 'active' : ''}`}
              onClick={() => setActivePreviewTab('metrics')}
            >
              <TrendingUp size={15} />
              <span>Executive KPIs</span>
            </button>
            <button
              type="button"
              className={`landing-preview-tab ${activePreviewTab === 'payruns' ? 'active' : ''}`}
              onClick={() => setActivePreviewTab('payruns')}
            >
              <CreditCard size={15} />
              <span>Payroll State Machine</span>
            </button>
            <button
              type="button"
              className={`landing-preview-tab ${activePreviewTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActivePreviewTab('activity')}
            >
              <Activity size={15} />
              <span>Real-Time Audit Feed</span>
            </button>
          </div>

          {/* Interactive Preview Content Box */}
          <div className="landing-preview-display card">
            {activePreviewTab === 'metrics' && (
              <div className="preview-metrics-view">
                <div className="preview-view-header">
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>Live Organization Telemetry</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Aggregated directly from verified MySQL database records</p>
                  </div>
                  <span className="badge badge-success">
                    <span className="badge-dot" /> All Systems Operational
                  </span>
                </div>

                <div className="preview-cards-row">
                  <div className="preview-mini-card">
                    <div className="preview-mini-title">Total Active Employees</div>
                    <div className="preview-mini-val">284 Staff</div>
                    <div className="preview-mini-sub" style={{ color: '#059669' }}>Across 8 Departments</div>
                  </div>
                  <div className="preview-mini-card">
                    <div className="preview-mini-title">Monthly Gross Committed</div>
                    <div className="preview-mini-val">₹38.2 Lakhs</div>
                    <div className="preview-mini-sub">Standard Cycle</div>
                  </div>
                  <div className="preview-mini-card">
                    <div className="preview-mini-title">Average Attendance Health</div>
                    <div className="preview-mini-val" style={{ color: '#059669' }}>98.4%</div>
                    <div className="preview-mini-sub">Present or Approved</div>
                  </div>
                  <div className="preview-mini-card">
                    <div className="preview-mini-title">Pending Leave Requests</div>
                    <div className="preview-mini-val" style={{ color: '#d97706' }}>3 Requests</div>
                    <div className="preview-mini-sub">Awaiting Signoff</div>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === 'payruns' && (
              <div className="preview-payruns-view">
                <div className="preview-view-header">
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>Strict Lifecycle State Engine</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Every payrun undergoes sequential authorization guards before disbursement</p>
                  </div>
                  <span className="badge badge-info">Cycle: October 2026</span>
                </div>

                <div className="preview-stepper-full">
                  <div className="preview-node completed">
                    <div className="preview-node-circle"><Check size={14} /></div>
                    <div className="preview-node-label">1. DRAFT</div>
                    <div className="preview-node-desc">Headcount locked</div>
                  </div>
                  <div className="preview-line completed" />
                  <div className="preview-node completed">
                    <div className="preview-node-circle"><Check size={14} /></div>
                    <div className="preview-node-label">2. COMPUTED</div>
                    <div className="preview-node-desc">Rules calculated</div>
                  </div>
                  <div className="preview-line completed" />
                  <div className="preview-node active">
                    <div className="preview-node-circle">3</div>
                    <div className="preview-node-label">3. VALIDATED</div>
                    <div className="preview-node-desc">Manager approved</div>
                  </div>
                  <div className="preview-line" />
                  <div className="preview-node">
                    <div className="preview-node-circle">4</div>
                    <div className="preview-node-label">4. PAID</div>
                    <div className="preview-node-desc">Disbursement ready</div>
                  </div>
                </div>
              </div>
            )}

            {activePreviewTab === 'activity' && (
              <div className="preview-activity-view">
                <div className="preview-view-header">
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>Live Audit Trail</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Immutable chronological event logging across HR, Payroll, and Attendance</p>
                  </div>
                  <span className="badge badge-neutral">Real-time Stream</span>
                </div>

                <div className="preview-feed-list">
                  <div className="preview-feed-item">
                    <span className="feed-dot success" />
                    <div className="feed-info">
                      <div className="feed-title">Payrun #PR-2026-10 validated by Payroll Manager</div>
                      <div className="feed-time">2 minutes ago • Elena Vance</div>
                    </div>
                  </div>
                  <div className="preview-feed-item">
                    <span className="feed-dot info" />
                    <div className="feed-info">
                      <div className="feed-title">Time-off request approved for Sarah Jenkins (3 days Annual Leave)</div>
                      <div className="feed-time">14 minutes ago • Sarah Miller</div>
                    </div>
                  </div>
                  <div className="preview-feed-item">
                    <span className="feed-dot teal" />
                    <div className="feed-info">
                      <div className="feed-title">New contract generated: Senior Full-Stack Engineer (CTR-2026-042)</div>
                      <div className="feed-time">1 hour ago • Admin Workspace</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 5. BENEFITS / VALUE PROPOSITION SECTION ───────────────────── */}
      <section id="benefits" className="landing-section">
        <div className="landing-section-header">
          <div className="landing-section-tag">BUSINESS IMPACT</div>
          <h2 className="landing-section-title">Built to Eliminate Friction in Enterprise Payroll</h2>
          <p className="landing-section-desc">
            Discover why PeoplePay360 is the preferred choice for streamlined workforce administration.
          </p>
        </div>

        <div className="landing-benefits-grid">
          <div className="landing-benefit-card">
            <div className="benefit-stat-num">80%</div>
            <h3 className="benefit-title">Faster Cycle Execution</h3>
            <p className="benefit-text">
              Automate multi-step payroll computations. Reduce manual spreadsheet entry from days to seconds with zero calculation errors.
            </p>
          </div>

          <div className="landing-benefit-card">
            <div className="benefit-stat-num">100%</div>
            <h3 className="benefit-title">Mathematical Determinism</h3>
            <p className="benefit-text">
              Eliminate payroll disputes. Every payslip enforces strict Gross - Deductions = Net arithmetic with verified formula logic.
            </p>
          </div>

          <div className="landing-benefit-card">
            <div className="benefit-stat-num">1 Hub</div>
            <h3 className="benefit-title">Centralized Workforce Ops</h3>
            <p className="benefit-text">
              Stop juggling isolated apps. Connect staff onboarding, contracts, schedules, attendance, time-off, and banking in one system.
            </p>
          </div>

          <div className="landing-benefit-card">
            <div className="benefit-stat-num">RBAC</div>
            <h3 className="benefit-title">Enterprise Security First</h3>
            <p className="benefit-text">
              Strict 5-tier role-based access control protecting confidential salary figures, contract details, and administrative workflows.
            </p>
          </div>
        </div>
      </section>

      {/* ── 6. CALL TO ACTION SECTION ─────────────────────────────────── */}
      <section className="landing-cta-section">
        <div className="landing-cta-box">
          <div className="landing-cta-content">
            <div className="landing-pill-badge" style={{ margin: '0 auto 16px', background: 'rgba(255,255,255,0.15)', color: '#ffffff' }}>
              <Zap size={13} />
              <span>Ready for Live Hackathon Demonstration</span>
            </div>
            <h2 className="landing-cta-title">
              Ready to Transform Your Workforce Operations?
            </h2>
            <p className="landing-cta-desc">
              Experience the power of PeoplePay360. Launch the platform, test the payroll state machine, and explore real-time workforce analytics.
            </p>
            <div className="landing-cta-buttons">
              <button
                type="button"
                className="btn landing-cta-btn-white"
                onClick={handleCtaClick}
              >
                <span>{isAuthenticated ? 'Open Workspace' : 'Get Started Now'}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FOOTER ─────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-brand">
              <div className="landing-logo-badge">P</div>
              <span className="landing-brand-title">PeoplePay360</span>
            </div>
            <p className="landing-footer-tagline">
              Enterprise Integrated HR &amp; Deterministic Payroll Platform. Designed for modern high-performance organizations.
            </p>
            <div className="landing-footer-status">
              <span className="mockup-pulse-dot" />
              <span>Hackathon Live v2.4 • ODOO 2026</span>
            </div>
          </div>

          <div className="landing-footer-links-group">
            <div className="landing-footer-col">
              <h4>Platform</h4>
              <button type="button" onClick={() => scrollToSection('features')} className="footer-link">Features</button>
              <button type="button" onClick={() => scrollToSection('preview')} className="footer-link">Workspace Preview</button>
              <button type="button" onClick={() => scrollToSection('benefits')} className="footer-link">Business Value</button>
            </div>

            <div className="landing-footer-col">
              <h4>Workflows</h4>
              <span className="footer-text">Employee 360</span>
              <span className="footer-text">Deterministic Payroll</span>
              <span className="footer-text">Smart Attendance</span>
              <span className="footer-text">Time-Off Sync</span>
            </div>

            <div className="landing-footer-col">
              <h4>Security</h4>
              <span className="footer-text">Role-Based Control (RBAC)</span>
              <span className="footer-text">Encrypted Session Security</span>
              <span className="footer-text">Audit Trail Logging</span>
              <span className="footer-text">Encrypted PDF Vouchers</span>
            </div>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <div>&copy; {new Date().getFullYear()} PeoplePay360. All rights reserved. Built for ODOO Hackathon 2026.</div>
          <div className="landing-footer-legal">
            <span>Enterprise Grade</span>
            <span>•</span>
            <span>Production Ready</span>
            <span>•</span>
            <span>Zero Data Loss</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
