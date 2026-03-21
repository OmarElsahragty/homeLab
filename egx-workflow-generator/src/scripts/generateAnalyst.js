#!/usr/bin/env node
/**
 * index.js — EGX Deep Analyst Workflow Generator
 *
 * Master orchestrator that imports all modular node generators
 * and assembles a complete n8n workflow JSON file.
 *
 * Pipeline: Schedule → Schema Init → Yahoo → TA → Enrichment →
 *           Embed Market States → Smart Context Search → Merge Smart Context →
 *           AI Analysis → Discord → Build Archive → Write To Journal
 *
 * Usage:
 *   node index.js                    # outputs to stdout
 *   node index.js > workflow.json    # write to file
 *   node index.js --pretty           # pretty-printed output
 */

const { resetNodeIds, mergeConnections } = require('../lib/utils');
const { buildScheduleNodes } = require('../builders/scheduleNode');
const { buildYahooFetchNodes } = require('../builders/yahooFetchNode');
const { buildTAEngineNode } = require('../builders/taEngineNode');
const { buildEnrichmentNodes } = require('../builders/dataEnrichmentNodes');
const { buildAIAnalysisNode } = require('../builders/aiAnalysisNode');
const { buildDiscordNode } = require('../builders/discordNode');
const {
  buildSchemaInitNode,
  buildSemanticRetrievalNodes,
  buildArchiveNodes,
  resetPgNodeIds,
} = require('../builders/databaseNodes');

// ---------------------------------------------------------------------------
// Assemble the full workflow
// ---------------------------------------------------------------------------
function generateWorkflow() {
  // Reset deterministic ID counters
  resetNodeIds();
  resetPgNodeIds();

  // 1. Schedule + Manual Trigger + Holiday Gate
  const schedule = buildScheduleNodes();

  // 2. Schema Init (CREATE TABLE IF NOT EXISTS, runs after Holiday Gate)
  const schemaInit = buildSchemaInitNode({
    prevNodeName: 'Holiday Gate',
    startX: 400,
    startY: 300,
  });

  // 3. Yahoo OHLCV Fetch (Loop + Wait + Fetch per TF) — after Schema Init
  const yahoo = buildYahooFetchNodes({
    prevNodeName: schemaInit.lastNodeName,
    startX: 600,
    startY: 300,
  });

  // 4. TA Engine (compute all indicators per stock)
  const ta = buildTAEngineNode({
    prevNodeName: yahoo.lastNodeName,
    startX: 1000,
    startY: 300,
  });

  // 5. Data Enrichment (News + CBE + Breadth + Institutional Flow → Merge → Compress)
  const enrichment = buildEnrichmentNodes({
    prevNodeName: ta.lastNodeName,
    startX: 1200,
    startY: 300,
  });

  // 6. Embed Market States (Code: build market-state text, call Ollama per stock)
  // 7. Smart Context Search (Postgres: pgvector cosine similarity LIMIT 2)
  // 8. Merge Smart Context (Code: re-join DB rows with pipeline items)
  const semantic = buildSemanticRetrievalNodes({
    prevNodeName: enrichment.lastNodeName,
    startX: 1600,
    startY: 300,
  });

  // 9. AI Analysis Per Stock (GLM-5 calls) — after Merge Smart Context
  const ai = buildAIAnalysisNode({
    prevNodeName: semantic.lastNodeName,
    startX: 2200,
    startY: 300,
  });

  // 10. Format & Send to Discord
  const discord = buildDiscordNode({
    prevNodeName: ai.lastNodeName,
    startX: 2600,
    startY: 300,
  });

  // 11. Build Archive (Code: prepare INSERT SQL with embedding literals)
  // 12. Write To Journal (Postgres: INSERT ON CONFLICT UPDATE)
  const archive = buildArchiveNodes({
    prevNodeName: discord.lastNodeName,
    startX: 3000,
    startY: 300,
  });

  // Collect all nodes
  const allNodes = [
    ...schedule.nodes,
    ...schemaInit.nodes,
    ...yahoo.nodes,
    ...ta.nodes,
    ...enrichment.nodes,
    ...semantic.nodes,
    ...ai.nodes,
    ...discord.nodes,
    ...archive.nodes,
  ];

  // Collect and merge all connections
  const allConnections = mergeConnections(
    schedule.connections,
    schemaInit.connections,
    yahoo.connections,
    ta.connections,
    enrichment.connections,
    semantic.connections,
    ai.connections,
    discord.connections,
    archive.connections
  );

  // n8n workflow envelope
  const workflow = {
    name: 'EGX Deep Analyst',
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
      instanceId: 'egx-deep-analyst',
    },
    tags: [
      { name: 'EGX', id: '1' },
      { name: 'Trading', id: '2' },
      { name: 'Semantic RAG', id: '3' },
    ],
  };

  return workflow;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
if (require.main === module) {
  const pretty = process.argv.includes('--pretty');
  const workflow = generateWorkflow();
  const json = JSON.stringify(workflow, null, pretty ? 2 : undefined);
  process.stdout.write(json + '\n');
}

module.exports = { generateWorkflow };
