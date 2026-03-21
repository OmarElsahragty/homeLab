#!/usr/bin/env node
/**
 * generateAuditor.js — EGX Auditor Workflow Generator
 *
 * Generates a standalone n8n workflow that:
 *   1. Runs daily at 4:00 PM Cairo (after market close)
 *   2. Queries the trading journal for un-audited predictions
 *   3. Fetches current Yahoo prices for each ticker
 *   4. Computes direction accuracy and price accuracy
 *   5. Updates the journal with audit results
 *
 * Two parallel branches: 24h audit + 5d audit
 *
 * Usage:
 *   node generateAuditor.js                    # outputs to stdout
 *   node generateAuditor.js --pretty           # pretty-printed output
 *   node generateAuditor.js > auditor.json     # write to file
 */

const {
    resetNodeIds,
    mergeConnections,
    createScheduleTrigger,
    createManualTrigger,
    createConnection,
} = require('../lib/utils');
const { buildAuditorNodes, resetPgNodeIds } = require('../builders/databaseNodes');

function generateAuditorWorkflow() {
    resetNodeIds();
    resetPgNodeIds();

    // Schedule Trigger: 4:00 PM Cairo, Sun–Thu (EGX trading days)
    const scheduleTrigger = createScheduleTrigger(
        'Auditor Schedule',
        { hour: 16, minute: 0, daysOfWeek: [0, 1, 2, 3, 4] },
        [100, 300]
    );

    // Manual Trigger for on-demand runs
    const manualTrigger = createManualTrigger('Manual Trigger', [100, 500]);

    // Auditor nodes (24h + 5d parallel branches)
    const auditor = buildAuditorNodes({
        startX: 500,
        startY: 300,
    });

    // Connect both triggers to both query nodes (parallel fan-out)
    const triggerConnections = {};
    for (const target of auditor.triggerTargets) {
        const schedConn = createConnection('Auditor Schedule', target);
        const manualConn = createConnection('Manual Trigger', target);
        Object.assign(triggerConnections, schedConn, manualConn);
    }

    // Merge trigger connections with auditor internal connections
    // Need to handle the fan-out: each trigger connects to BOTH query nodes
    const scheduleOutputs = auditor.triggerTargets.map(target => ({
        node: target,
        type: 'main',
        index: 0,
    }));
    const manualOutputs = auditor.triggerTargets.map(target => ({
        node: target,
        type: 'main',
        index: 0,
    }));

    const fanOutConnections = {
        'Auditor Schedule': { main: [scheduleOutputs] },
        'Manual Trigger': { main: [manualOutputs] },
    };

    const allNodes = [scheduleTrigger, manualTrigger, ...auditor.nodes];

    const allConnections = mergeConnections(
        fanOutConnections,
        auditor.connections
    );

    const workflow = {
        name: 'EGX Auditor',
        nodes: allNodes,
        connections: allConnections,
        active: false,
        settings: {
            executionOrder: 'v1',
            saveManualExecutions: true,
            callerPolicy: 'workflowsFromSameOwner',
        },
        versionId: '1',
        meta: {
            templateCredsSetupCompleted: true,
            instanceId: 'egx-auditor',
        },
        tags: [
            { name: 'EGX', id: '1' },
            { name: 'Auditor', id: '2' },
        ],
    };

    return workflow;
}

if (require.main === module) {
    const pretty = process.argv.includes('--pretty');
    const workflow = generateAuditorWorkflow();
    const json = JSON.stringify(workflow, null, pretty ? 2 : undefined);
    process.stdout.write(json + '\n');
}

module.exports = { generateAuditorWorkflow };
