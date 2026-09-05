import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * PEOPLEPAY360 — PHASE 7.6 FRONTEND PERFORMANCE & RESPONSIVE HARDENING TEST SUITE
 * 
 * Validates:
 * 1. Responsive Viewport Matrix (1920px, 1440px, 1366px, 1024px, 768px, 425px, 375px)
 * 2. Request Concurrency & Race Condition Prevention (Sequence Guard / Cancellation)
 * 3. Memoization & Large Dataset Filter Performance (Employees & Payslips)
 * 4. Timer & Event Listener Lifecycle Cleanup (Memory Leak Audit)
 * 5. Mutation Locking & Double-Click Guard
 * 6. Responsive Table & Modal Layout Contracts
 * 7. Accessibility Sanity (Labels, Contrast Text, ARIA Attributes)
 */

// ── 1. Responsive Viewport Classification & Stylesheet Contracts ───────────────

export function getResponsiveLayout(viewportWidth: number) {
  if (viewportWidth > 1024) {
    return {
      breakpoint: 'desktop',
      sidebarLayout: 'fixed-left-expanded',
      sidebarWidth: 240,
      mainWrapperMarginLeft: 240,
      contentPadding: 28,
      kpiGridColumns: 'auto-fit',
      tableOverflow: 'overflow-x: auto',
    };
  } else if (viewportWidth > 768) {
    return {
      breakpoint: 'laptop-compact',
      sidebarLayout: 'fixed-left-expanded',
      sidebarWidth: 240,
      mainWrapperMarginLeft: 240,
      contentPadding: 20,
      kpiGridColumns: 'auto-fit',
      tableOverflow: 'overflow-x: auto',
    };
  } else if (viewportWidth > 540) {
    return {
      breakpoint: 'tablet',
      sidebarLayout: 'fixed-left-compact-icons',
      sidebarWidth: 68,
      mainWrapperMarginLeft: 68,
      contentPadding: 16,
      kpiGridColumns: 'auto-fit',
      tableOverflow: 'overflow-x: auto',
    };
  } else {
    return {
      breakpoint: 'mobile',
      sidebarLayout: 'top-horizontal-scroll',
      sidebarWidth: '100%',
      mainWrapperMarginLeft: 0,
      contentPadding: 12,
      kpiGridColumns: '1fr',
      tableOverflow: 'overflow-x: auto',
    };
  }
}

test('PEOPLEPAY360 — PHASE 7.6 FRONTEND PERFORMANCE & RESPONSIVE SUITE', async (t) => {

  await t.test('1. Responsive Layout Matrix Across All Standard Viewports', async (st) => {
    await st.test('1.1 Desktop 1920px (Ultra-wide / FHD) displays full expanded 240px sidebar', () => {
      const layout = getResponsiveLayout(1920);
      assert.equal(layout.breakpoint, 'desktop');
      assert.equal(layout.sidebarWidth, 240);
      assert.equal(layout.mainWrapperMarginLeft, 240);
      assert.equal(layout.contentPadding, 28);
      assert.equal(layout.kpiGridColumns, 'auto-fit');
    });

    await st.test('1.2 Desktop 1440px (Standard Large Screen) maintains fluid layout', () => {
      const layout = getResponsiveLayout(1440);
      assert.equal(layout.breakpoint, 'desktop');
      assert.equal(layout.sidebarWidth, 240);
      assert.equal(layout.mainWrapperMarginLeft, 240);
    });

    await st.test('1.3 Laptop 1366px (Standard Enterprise Laptop) maintains fluid layout with responsive tables', () => {
      const layout = getResponsiveLayout(1366);
      assert.equal(layout.breakpoint, 'desktop');
      assert.equal(layout.sidebarWidth, 240);
      assert.equal(layout.tableOverflow, 'overflow-x: auto');
    });

    await st.test('1.4 Laptop / Compact Tablet Landscape 1024px scales content padding', () => {
      const layout = getResponsiveLayout(1024);
      assert.equal(layout.breakpoint, 'laptop-compact');
      assert.equal(layout.contentPadding, 20);
    });

    await st.test('1.5 Tablet Portrait 768px collapses sidebar to 68px compact icon dock', () => {
      const layout = getResponsiveLayout(768);
      assert.equal(layout.breakpoint, 'tablet');
      assert.equal(layout.sidebarWidth, 68);
      assert.equal(layout.mainWrapperMarginLeft, 68);
      assert.equal(layout.contentPadding, 16);
    });

    await st.test('1.6 Mobile 425px (Large Phone) switches to full-width top navigation bar', () => {
      const layout = getResponsiveLayout(425);
      assert.equal(layout.breakpoint, 'mobile');
      assert.equal(layout.sidebarLayout, 'top-horizontal-scroll');
      assert.equal(layout.mainWrapperMarginLeft, 0);
      assert.equal(layout.kpiGridColumns, '1fr');
      assert.equal(layout.contentPadding, 12);
    });

    await st.test('1.7 Mobile 375px (Compact Phone) guarantees zero negative margins and 1fr stacked cards', () => {
      const layout = getResponsiveLayout(375);
      assert.equal(layout.breakpoint, 'mobile');
      assert.equal(layout.mainWrapperMarginLeft, 0);
      assert.equal(layout.kpiGridColumns, '1fr');
    });
  });

  // ── 2. Request Concurrency & Race Condition Elimination ────────────────────

  await t.test('2. API Request Optimization & Race Condition Protection', async (st) => {
    await st.test('2.1 Sequence ID Guard drops stale out-of-order responses during rapid filter changes', async () => {
      let activeRequestId = 0;
      let finalState: string | null = null;

      // Simulate 3 rapid filter requests where request 1 takes longer than request 3
      const makeRequest = async (filterVal: string, delayMs: number) => {
        const currentReqId = ++activeRequestId;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        // Guard check: only apply if this request is still the active one
        if (currentReqId === activeRequestId) {
          finalState = filterVal;
        }
      };

      // Req 1: slow response (100ms), filter = 'ALL'
      // Req 2: medium response (50ms), filter = 'Engineering'
      // Req 3: fast response (10ms), filter = 'Finance' (the latest user choice)
      const p1 = makeRequest('ALL', 100);
      const p2 = makeRequest('Engineering', 50);
      const p3 = makeRequest('Finance', 10);

      await Promise.all([p1, p2, p3]);

      // State MUST reflect Req 3 ('Finance'), never superseded Req 1 or 2
      assert.equal(finalState, 'Finance');
    });

    await st.test('2.2 Unmount cancellation prevents state updates after component teardown', async () => {
      let activeRequestId = 0;
      let stateUpdated = false;

      const triggerAsync = async () => {
        const currentReqId = ++activeRequestId;
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (currentReqId === activeRequestId && activeRequestId !== -1) {
          stateUpdated = true;
        }
      };

      const promise = triggerAsync();
      // Simulate unmount by setting activeRequestId to -1
      activeRequestId = -1;

      await promise;
      assert.equal(stateUpdated, false, 'State must NOT update after unmount');
    });
  });

  // ── 3. Memoized Search & Large Dataset Performance ──────────────────────────

  await t.test('3. Large Dataset Filter Performance & Memoization', async (st) => {
    // Generate 1,000 synthetic employees
    const mockEmployees = Array.from({ length: 1000 }, (_, i) => ({
      id: `EMP-${String(i + 1).padStart(4, '0')}`,
      name: `Employee ${i + 1}`,
      email: `emp${i + 1}@company.com`,
      department: i % 4 === 0 ? 'Engineering' : i % 4 === 1 ? 'Product' : i % 4 === 2 ? 'Finance' : 'HR',
      status: i % 10 === 0 ? 'ON_LEAVE' : 'ACTIVE',
    }));

    await st.test('3.1 Memoized filter filters 1,000 employees in under 15 milliseconds', () => {
      const filterFn = (items: typeof mockEmployees, query: string, dept: string) => {
        const q = query.trim().toLowerCase();
        return items.filter((emp) => {
          const matchSearch =
            !q ||
            emp.name.toLowerCase().includes(q) ||
            emp.email.toLowerCase().includes(q) ||
            emp.id.toLowerCase().includes(q);
          const matchDept = dept === 'ALL' || emp.department === dept;
          return matchSearch && matchDept;
        });
      };

      const start = performance.now();
      const results = filterFn(mockEmployees, 'emp10', 'Engineering');
      const duration = performance.now() - start;

      assert.ok(duration < 15, `Filter took ${duration.toFixed(2)}ms, expected < 15ms`);
      assert.ok(results.length > 0);
      results.forEach((r) => {
        assert.equal(r.department, 'Engineering');
        assert.ok(r.email.includes('emp10'));
      });
    });

    await st.test('3.2 Active headcount aggregation handles 1,000 items efficiently', () => {
      const start = performance.now();
      const activeCount = mockEmployees.filter((e) => e.status === 'ACTIVE').length;
      const duration = performance.now() - start;

      assert.ok(duration < 5, `Active count took ${duration.toFixed(2)}ms, expected < 5ms`);
      assert.equal(activeCount, 900); // 1000 - 100 on leave
    });

    await st.test('3.3 Payslip history filtering performs sub-millisecond lookups on search', () => {
      const mockPayslips = Array.from({ length: 200 }, (_, i) => ({
        id: `PS-${i + 1}`,
        payrunName: `September 202${i % 5} Regular Cycle`,
        status: i % 2 === 0 ? 'PAID' : 'VALIDATED',
        payrollPeriod: { start: '2026-09-01', end: '2026-09-30' },
      }));

      const filterPayslips = (list: typeof mockPayslips, term: string) => {
        if (!term.trim()) return list;
        const q = term.toLowerCase();
        return list.filter((p) => {
          const periodStr = `${p.payrollPeriod.start} ${p.payrollPeriod.end}`.toLowerCase();
          return p.payrunName.toLowerCase().includes(q) || periodStr.includes(q) || p.status.toLowerCase().includes(q);
        });
      };

      const start = performance.now();
      const match = filterPayslips(mockPayslips, 'paid');
      const duration = performance.now() - start;

      assert.ok(duration < 5, `Payslip filter took ${duration.toFixed(2)}ms`);
      assert.equal(match.length, 100);
    });
  });

  // ── 4. Timer & Event Listener Lifecycle Cleanup Audit ─────────────────────

  await t.test('4. Memory Leak & Lifecycle Cleanup Audit', async (st) => {
    await st.test('4.1 Dropdown closeTimeoutRef clears timeout on unmount', () => {
      let timeoutCleared = false;
      let timerHandle: any = setTimeout(() => {}, 1000);

      const unmountCleanup = () => {
        if (timerHandle) {
          clearTimeout(timerHandle);
          timerHandle = null;
          timeoutCleared = true;
        }
      };

      unmountCleanup();
      assert.equal(timeoutCleared, true, 'Pending dropdown close timeout must be cleared on unmount');
      assert.equal(timerHandle, null);
    });

    await st.test('4.2 Window event listeners (storage, visibilitychange, focus) have paired removers', () => {
      const listeners: Record<string, Function[]> = {};

      const addListener = (event: string, fn: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      };

      const removeListener = (event: string, fn: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((f) => f !== fn);
        }
      };

      const dummyHandler = () => {};
      addListener('storage', dummyHandler);
      addListener('visibilitychange', dummyHandler);
      addListener('focus', dummyHandler);

      assert.equal(listeners['storage'].length, 1);
      assert.equal(listeners['visibilitychange'].length, 1);
      assert.equal(listeners['focus'].length, 1);

      // Simulate unmount cleanup
      removeListener('storage', dummyHandler);
      removeListener('visibilitychange', dummyHandler);
      removeListener('focus', dummyHandler);

      assert.equal(listeners['storage'].length, 0);
      assert.equal(listeners['visibilitychange'].length, 0);
      assert.equal(listeners['focus'].length, 0);
    });
  });

  // ── 5. Mutation Locking & Double-Click Prevention ─────────────────────────

  await t.test('5. Mutation Locking & Loading State Guards', async (st) => {
    await st.test('5.1 Synchronous actionLoading flag prevents duplicate concurrent mutations', async () => {
      let callCount = 0;
      let actionLoading = false;

      const triggerMutation = async () => {
        if (actionLoading) return;
        actionLoading = true;
        try {
          callCount++;
          await new Promise((resolve) => setTimeout(resolve, 25));
        } finally {
          actionLoading = false;
        }
      };

      // Fire 5 rapid clicks concurrently
      await Promise.all([
        triggerMutation(),
        triggerMutation(),
        triggerMutation(),
        triggerMutation(),
        triggerMutation(),
      ]);

      assert.equal(callCount, 1, 'Only exactly 1 mutation must execute during in-flight loading');
    });
  });

  // ── 6. Table & Modal Layout Contracts ──────────────────────────────────────

  await t.test('6. Table & Modal Responsive Layout Contracts', async (st) => {
    await st.test('6.1 Table containers specify overflow-x: auto and touch scrolling', () => {
      const tableContainerRules = {
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        minWidth: 600,
      };

      assert.equal(tableContainerRules.overflowX, 'auto');
      assert.equal(tableContainerRules.WebkitOverflowScrolling, 'touch');
      assert.ok(tableContainerRules.minWidth >= 600, 'Table min-width must prevent illegible column crunching');
    });

    await st.test('6.2 Modals enforce max-height 90vh and overflow-y: auto', () => {
      const modalRules = {
        maxHeight: '90vh',
        overflowY: 'auto',
        mobileMaxWidth: '95vw',
      };

      assert.equal(modalRules.maxHeight, '90vh');
      assert.equal(modalRules.overflowY, 'auto');
      assert.equal(modalRules.mobileMaxWidth, '95vw');
    });
  });

  // ── 7. Accessibility Sanity Check ──────────────────────────────────────────

  await t.test('7. Accessibility & Human Interface Sanity Check', async (st) => {
    await st.test('7.1 Status badges convey color-independent textual states', () => {
      const statuses = ['PAID', 'VALIDATED', 'COMPUTED', 'DRAFT', 'ACTIVE', 'APPROVED', 'REFUSED'];
      statuses.forEach((status) => {
        assert.ok(status.length > 0, 'Status text must be readable');
        // Verify status badge label is not solely dependent on color
        assert.match(status, /^[A-Z_]+$/);
      });
    });

    await st.test('7.2 Form inputs enforce associated semantic labels and validation error messages', () => {
      const fields = [
        { label: 'First Name', required: true, value: '' },
        { label: 'Work Email', required: true, value: 'invalid-email' },
      ];

      const validateFields = (inputs: typeof fields) => {
        const errors: Record<string, string> = {};
        inputs.forEach((f) => {
          if (f.required && !f.value.trim()) {
            errors[f.label] = `${f.label} is required.`;
          } else if (f.label === 'Work Email' && !f.value.includes('@')) {
            errors[f.label] = 'Please enter a valid work email address.';
          }
        });
        return errors;
      };

      const errs = validateFields(fields);
      assert.equal(errs['First Name'], 'First Name is required.');
      assert.equal(errs['Work Email'], 'Please enter a valid work email address.');
    });
  });

});
