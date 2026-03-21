#!/usr/bin/env node
/**
 * index.js — EGX Deep Analyst & Auditor Workflow Generator
 *
 * Master generator that produces BOTH workflow JSONs:
 * 1. EGX_Deep_Analyst.json — Daily stock analysis workflow
 * 2. EGX_Auditor.json — Daily post-market audit workflow
 *
 * Outputs generated workflows to:
 *   - output/EGX_Deep_Analyst.json
 *   - output/EGX_Auditor.json
 *
 * Usage:
 *   node index.js                    # generate both (default)
 *   node index.js --pretty           # pretty-printed output (debugging)
 *   node index.js --analyst-only     # only Deep Analyst
 *   node index.js --auditor-only     # only Auditor
 */

const fs = require('fs');
const path = require('path');

// Load .env BEFORE requiring builders — they bake env vars into workflow strings at require-time
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Validate required env vars
const REQUIRED_ENV = ['ZAI_API_KEY', 'DISCORD_WEBHOOK_URL'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error('✗ Missing required environment variables: ' + missing.join(', '));
    console.error('  Copy .env.example → .env and fill in the values.');
    process.exit(1);
}

// Import both generators (AFTER dotenv so env vars are available for template interpolation)
const { generateWorkflow } = require('./src/scripts/generateAnalyst');
const { generateAuditorWorkflow } = require('./src/scripts/generateAuditor');

// Paths
const OUTPUT_DIR = path.join(__dirname, 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Parse CLI arguments
const args = process.argv.slice(2);
const pretty = args.includes('--pretty');
const analystOnly = args.includes('--analyst-only');
const auditorOnly = args.includes('--auditor-only');
const generateBoth = !analystOnly && !auditorOnly;

/**
 * Write workflow JSON to output/ directory
 */
function writeWorkflow(filename, workflow, isPretty) {
    const json = JSON.stringify(workflow, null, isPretty ? 2 : undefined);

    // Write to output/
    const outputPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outputPath, json + '\n', 'utf8');
    console.log(`✓ ${filename} (${json.length} bytes) → ${outputPath}`);
}

/**
 * Main entry point
 */
function main() {
    console.log('\n================================================================');
    console.log('EGX Deep Analyst & Auditor Workflow Generator');
    console.log(`================================================================\n`);

    const timestamp = new Date().toISOString();
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Output directory: ${OUTPUT_DIR}\n`);

    if (generateBoth || analystOnly) {
        console.log('Generating EGX Deep Analyst workflow...');
        try {
            const workflow = generateWorkflow();
            writeWorkflow('EGX_Deep_Analyst.json', workflow, pretty);
            console.log('');
        } catch (err) {
            console.error('✗ Error generating Deep Analyst:', err.message);
            process.exit(1);
        }
    }

    if (generateBoth || auditorOnly) {
        console.log('Generating EGX Auditor workflow...');
        try {
            const workflow = generateAuditorWorkflow();
            writeWorkflow('EGX_Auditor.json', workflow, pretty);
            console.log('');
        } catch (err) {
            console.error('✗ Error generating Auditor:', err.message);
            process.exit(1);
        }
    }

    console.log('================================================================');
    console.log('✓ All workflows generated successfully!');
    console.log('================================================================');
    console.log('\nNext steps:');
    console.log('  1. Review workflows in output/ directory');
    console.log('  2. Import into n8n: Settings → Import → select JSON file');
    console.log('  3. Configure credentials (Postgres, Discord, etc.)');
    console.log('  4. Activate workflows in n8n UI');
    console.log('');
}

// Entry point
if (require.main === module) {
    main();
}

module.exports = { generateWorkflow, generateAuditorWorkflow };
