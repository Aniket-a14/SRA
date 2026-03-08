/**
 * HARDENED BENCHMARK ORCHESTRATOR (Industry-Grade)
 * 
 * 5-Layer Pipeline (mirrors backend architecture):
 * 
 * Layer 1: Prompt Generation (srs_prompt_factory.cjs → section instructions)
 * Layer 2: Model Call + JSON Parse
 * Layer 3: Validation Gate (srs_validator.cjs → schema + rules)
 * Layer 4: Alignment Check (srs_validator.cjs → hallucination detection)
 * Layer 5: Reflection Retry (inject errors into regeneration prompt)
 * 
 * Features:
 *   - Contextual Chain-of-Generation (Section N depends on Sections 0..N-1)
 *   - Parallel Batching (Concurrency control)
 *   - Granular Metric Tracking (Tokens, Errors, Compliance)
 *   - Reflection-style retry with error feedback injection
 */

const fs = require('fs');
const path = require('path');
const { callModel, MODELS } = require('./model_clients.cjs');
const { getTemplateConfig } = require('./srs_skeleton.cjs');
const { validateSection, checkAlignment } = require('./srs_validator.cjs');
const { getSystemPrompt, getUserPrompt } = require('./srs_prompt_factory.cjs');
const projects = require('./benchmark_projects.json');

const CONCURRENCY_LIMIT = parseInt(process.env.BENCHMARK_CONCURRENCY) || 2;
const MAX_SECTION_RETRIES = parseInt(process.env.MAX_SECTION_RETRIES) || 3;
const ACTIVE_TEMPLATE = process.env.SRS_TEMPLATE || "IEEE_830";

/**
 * RUNNING IN NVIDIA LABS: 
 * Set BENCHMARK_CONCURRENCY in .env to increase speed if your rate limits allow.
 * Set SRS_TEMPLATE to "ISO_29148", "AGILE_USER_STORIES", "VOLERE", or "IEEE_830".
 */

/**
 * Runs the benchmark for a single model on all projects.
 */
async function runModelBenchmark(modelName) {
    console.log(`\n>>> Starting Benchmarking for: ${modelName} [Template: ${ACTIVE_TEMPLATE}] <<<`);
    const projectResults = [];

    // Batch projects based on concurrency limit
    for (let i = 0; i < projects.length; i += CONCURRENCY_LIMIT) {
        const batch = projects.slice(i, i + CONCURRENCY_LIMIT);
        console.log(`  Processing Batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(projects.length / CONCURRENCY_LIMIT)}...`);

        const batchPromises = batch.map(project => processProject(modelName, project));
        const batchResults = await Promise.all(batchPromises);
        projectResults.push(...batchResults);
    }

    return {
        model: modelName,
        template: ACTIVE_TEMPLATE,
        projects: projectResults
    };
}

/**
 * Generates a full SRS for a project using a specific model.
 * Implements the 5-layer pipeline per section.
 */
async function processProject(modelName, project) {
    const { skeleton, sections } = getTemplateConfig(ACTIVE_TEMPLATE);
    const result = {
        projectId: project.id,
        projectName: project.name,
        template: ACTIVE_TEMPLATE,
        sections: {},
        metrics: {
            totalLatency: 0,
            promptTokens: 0,
            completionTokens: 0,
            regenerationCount: 0,
            validationErrors: [],
            alignmentMismatches: [],
            errors: []
        },
        isValid: true
    };

    const fullSrs = JSON.parse(JSON.stringify(skeleton));
    fullSrs.projectTitle = project.name;

    const generatedSections = {}; // Chained context for subsequent sections

    for (const section of sections) {
        let success = false;
        let attempt = 0;
        let lastErrors = []; // Track errors for reflection-style retry

        while (attempt < MAX_SECTION_RETRIES && !success) {
            attempt++;

            // --- LAYER 1: Prompt Generation ---
            const systemPrompt = getSystemPrompt(section, ACTIVE_TEMPLATE);
            let userPrompt = getUserPrompt(section, project.name, project.description, generatedSections, ACTIVE_TEMPLATE);

            // LAYER 5: Reflection — inject previous errors into retry prompt
            if (attempt > 1 && lastErrors.length > 0) {
                const errorFeedback = lastErrors.map((e, i) => `${i + 1}. ${e}`).join('\n');
                userPrompt += `\n\n---\nPREVIOUS ATTEMPT FAILED. You must fix these issues:\n${errorFeedback}\n---`;
            }

            // --- LAYER 2: Model Call + JSON Parse ---
            const response = await callModel(modelName, userPrompt, systemPrompt);

            result.metrics.totalLatency += response.latency;
            if (response.usage) {
                result.metrics.promptTokens += response.usage.prompt_tokens;
                result.metrics.completionTokens += response.usage.completion_tokens;
            }

            if (response.success) {
                try {
                    const content = JSON.parse(response.content);

                    // --- LAYER 3: Validation Gate ---
                    const validation = validateSection(section, content, ACTIVE_TEMPLATE);

                    if (validation.errors.length > 0) {
                        // Validation failed — track errors for reflection retry
                        lastErrors = validation.errors;
                        result.metrics.regenerationCount++;
                        result.metrics.validationErrors.push(...validation.errors.map(e => `[${section}] ${e}`));
                        result.metrics.errors.push(`[${section}] Validation failed (Attempt ${attempt}): ${validation.errors.join(', ')}`);
                        continue; // Retry with reflection
                    }

                    // Log warnings (non-blocking)
                    if (validation.warnings.length > 0) {
                        result.metrics.validationErrors.push(...validation.warnings.map(w => `[WARN][${section}] ${w}`));
                    }

                    // --- LAYER 4: Alignment Check ---
                    const alignment = checkAlignment(section, content, project.name, project.description);
                    if (!alignment.aligned) {
                        result.metrics.alignmentMismatches.push(...alignment.mismatches.map(m => `[${section}] ${m}`));
                        // Alignment mismatches are warnings, not blockers
                    }

                    // --- SUCCESS: Store section ---
                    success = true;
                    fullSrs[section] = content;
                    generatedSections[section] = content;

                } catch (e) {
                    lastErrors = [`JSON Parse Error: ${e.message}`];
                    result.metrics.regenerationCount++;
                    result.metrics.errors.push(`[${section}] JSON Parse error (Attempt ${attempt}): ${e.message}`);
                }
            } else {
                lastErrors = [`API Error: ${response.error}`];
                result.metrics.regenerationCount++;
                result.metrics.errors.push(`[${section}] API error (Attempt ${attempt}): ${response.error}`);
            }
        }

        result.sections[section] = { success, attempts: attempt };
        if (!success) {
            result.isValid = false;
            break; // Stop if a prerequisite section fails
        }
    }

    // Save the final artifacts
    const outputDir = path.join(__dirname, 'benchmarks', 'artifacts', modelName.replace(/ /g, '_'));
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `srs_${project.id}.json`), JSON.stringify(fullSrs, null, 2));

    return result;
}

async function main() {
    const start = Date.now();
    const allResults = [];

    console.log(`\n=================================================`);
    console.log(`SRA-PRO BENCHMARK [NVIDIA LABS MODE]`);
    console.log(`Template: ${ACTIVE_TEMPLATE} | Concurrency: ${CONCURRENCY_LIMIT}`);
    console.log(`Projects: ${projects.length} | Models: ${MODELS.length}`);
    console.log(`=================================================\n`);

    for (const model of MODELS) {
        const modelData = await runModelBenchmark(model);
        allResults.push(modelData);
    }

    const duration = (Date.now() - start) / 1000;

    // Summary Aggregation
    const summary = allResults.map(m => {
        const total = m.projects.length;
        const valid = m.projects.filter(p => p.isValid).length;
        const totalRegens = m.projects.reduce((s, p) => s + p.metrics.regenerationCount, 0);
        const totalLat = m.projects.reduce((s, p) => s + p.metrics.totalLatency, 0);
        const totalPT = m.projects.reduce((s, p) => s + p.metrics.promptTokens, 0);
        const totalCT = m.projects.reduce((s, p) => s + p.metrics.completionTokens, 0);
        const totalAlignIssues = m.projects.reduce((s, p) => s + p.metrics.alignmentMismatches.length, 0);

        return {
            model: m.model,
            template: m.template,
            validity: `${((valid / total) * 100).toFixed(1)}%`,
            avgRegen: (totalRegens / total).toFixed(2),
            avgLatency: `${(totalLat / total / 1000).toFixed(2)}s`,
            avgTokens: Math.round((totalPT + totalCT) / total),
            alignmentIssues: totalAlignIssues,
            successCount: valid
        };
    });

    console.log("\n=== CONSOLIDATED BENCHMARK RESULTS ===");
    console.table(summary);
    console.log(`Total Duration: ${Math.round(duration)}s`);

    const reportPath = path.join(__dirname, 'benchmarks', 'hardened_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ summary, details: allResults, timestamp: new Date() }, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);
}

main().catch(console.error);
