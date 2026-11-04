import { test, expect } from '@playwright/test';

// Requires #33, #37 and #30. Missing features must fail, never silently skip.
for (const skipCleanWash of [false, true]) {
  test(`PRD §6: ${skipCleanWash ? 'SKIP_CLEAN_WASH' : 'FULL_PROCESS'} through handover`, async ({
    request,
  }) => {
    const api = 'http://127.0.0.1:3101';
    const fixture = await (await request.get(`${api}/__fixtures`)).json();
    const call = async (method: 'get' | 'post', path: string, token: string, data?: unknown) => {
      const response = await request[method](`${api}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        ...(data === undefined ? {} : { data }),
      });
      expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy();
      return response.json();
    };
    const planner = fixture.tokens.PRODUCTION_PLANNER;
    const qc = fixture.tokens.QC_INSPECTOR;
    const order = await call('post', '/orders', planner, {
      styleId: fixture.styleId,
      fabricTypeId: fixture.fabricTypeId,
      colorId: fixture.colorId,
      washTypeId: fixture.washTypeId,
      skipCleanWash,
      dueDate: '2026-12-31',
      sizeLines: [{ size: '30', plannedQty: 100 }],
    });
    await call('post', `/orders/${order.id}/bom/calculate`, planner);
    const lines = await call('get', `/orders/${order.id}/bom`, planner);
    const fabric = lines.find((l: { materialType: string }) => l.materialType === 'FABRIC');
    await call('post', '/inventory/allocate', fixture.tokens.WAREHOUSE_KEEPER, {
      orderId: order.id,
      bomLineId: fabric.id,
      fabricLotId: fixture.fabricLotId,
      quantity: Number(fabric.requiredQty),
    });
    if (skipCleanWash) {
      const blocked = await request.post(`${api}/orders/${order.id}/confirm`, {
        headers: { Authorization: `Bearer ${planner}` },
        data: {},
      });
      expect(blocked.status()).toBe(409);
      await call('post', `/orders/${order.id}/acknowledgement`, planner, {
        acknowledgedByName: 'Demo Brand',
        filePath: `orders/${order.id}/acknowledgement/demo.pdf`,
      });
    }
    const confirmed = await call('post', `/orders/${order.id}/confirm`, planner);
    expect(confirmed.skippedStepCodes.includes('CLEAN_WASH')).toBe(skipCleanWash);
    let reworked = false;
    for (let iteration = 0; iteration < 40; iteration++) {
      const detail = await call('get', `/orders/${order.id}`, planner);
      const steps = detail.workflowInstance.stepInstances;
      const current = steps.find((s: { status: string }) =>
        ['READY', 'REWORK', 'WAITING_QC'].includes(s.status),
      );
      expect(current, 'workflow must have an executable next step').toBeTruthy();
      const definition = current.stepDefinition;
      if (definition.code === 'PACK_HANDOVER') break;
      const worker =
        definition.responsibleRole === 'STATION_OPERATOR'
          ? fixture.operators[definition.stationType]
          : fixture.tokens[definition.responsibleRole];
      if (current.status !== 'WAITING_QC')
        await call('post', `/steps/${current.id}/start`, worker, {});
      if (definition.responsibleRole === 'STATION_OPERATOR') {
        const panel = await call('get', `/steps/${current.id}/quantities`, worker);
        if (panel.mode === 'CUTTING' && panel.qtyIn === 0) {
          const tooMany = await request.post(`${api}/steps/${current.id}/quantities`, {
            headers: { Authorization: `Bearer ${worker}` },
            data: { size: '30', qtyGood: 106 },
          });
          expect(tooMany.status()).toBe(409);
          await call('post', `/steps/${current.id}/quantities`, worker, {
            size: '30',
            qtyGood: 100,
          });
        } else if (panel.qtyIn === 0) {
          for (const bundle of panel.bundles)
            await call('post', `/steps/${current.id}/quantities`, worker, {
              bundleId: bundle.id,
              qtyGood: bundle.availableQty,
              ...(panel.isOutsourced
                ? { qtySent: bundle.availableQty, qtyReceived: bundle.availableQty }
                : {}),
            });
        }
      }
      if (definition.requiresEvidence) {
        const signed = await call('post', `/steps/${current.id}/evidence/upload-url`, worker, {
          mimeType: 'application/pdf',
          sizeBytes: 100,
        });
        await call('post', `/steps/${current.id}/evidence`, worker, { filePath: signed.filePath });
      }
      if (definition.stepType === 'QC' || current.status === 'WAITING_QC') {
        const target = steps.find(
          (s: { stepDefinition: { code: string } }) => s.stepDefinition.code === 'FINISHING',
        );
        if (definition.code === 'FINAL_QC' && !reworked && !skipCleanWash) {
          await call('post', `/steps/${current.id}/qc/inspections`, qc, {
            sampleSize: 20,
            result: 'REWORK',
            measuredShrinkagePercent: 4,
            measuredColorFadingLevel: 2,
            reworkTargetStepId: target.id,
            reason: 'Demo: sửa độ co',
          });
          reworked = true;
        } else
          await call('post', `/steps/${current.id}/qc/inspections`, qc, {
            sampleSize: 20,
            result: 'PASS',
            measuredShrinkagePercent: skipCleanWash ? 4 : 2,
            measuredColorFadingLevel: skipCleanWash ? 2 : 1,
          });
      } else await call('post', `/steps/${current.id}/complete`, worker, {});
    }
    expect(reworked).toBe(!skipCleanWash);
    const handover = await call('post', `/orders/${order.id}/handover`, planner, {});
    expect(handover).toMatchObject({
      qcProfileType: skipCleanWash ? 'SKIP_CLEAN_WASH' : 'FULL_PROCESS',
      totalQty: 100,
      orderStatus: 'COMPLETED',
    });
    const dashboard = await call('get', '/dashboard/wip', fixture.tokens.MANAGER);
    expect(dashboard.ordersByStatus.COMPLETED).toBeGreaterThan(0);
  });
}
