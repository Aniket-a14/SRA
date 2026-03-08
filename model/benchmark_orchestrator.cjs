/**
 * HARDENED BENCHMARK ORCHESTRATOR
 * Features:
 * 1. Contextual Chain-of-Generation (Section N depends on Sections 0..N-1).
 * 2. Parallel Batching (Concurrency control).
 * 3. Granular Metric Tracking (Tokens, Errors, Compliance).
 * 4. Automatic Retry Logic per Section.
 */

const fs = require('fs');
const path = require('path');
const { callModel, MODELS } = require('./model_clients.cjs');
const { SRS_SKELETON, SRS_SECTIONS } = require('./srs_skeleton.cjs');
const { validateSection } = require('./srs_validator.cjs');
const { getSystemPrompt, getUserPrompt } = require('./srs_prompt_factory.cjs');
const projects = require('./benchmark_projects.json');

const CONCURRENCY_LIMIT = parseInt(process.env.BENCHMARK_CONCURRENCY) || 2;
const MAX_SECTION_RETRIES = parseInt(process.env.MAX_SECTION_RETRIES) || 3;

/**
 * RUNNING IN NVIDIA LABS: 
 * Set BENCHMARK_CONCURRENCY in .env to increase speed if your rate limits allow.
 */

/**
 * Runs the benchmark for a single model on all projects.
 */
async function runModelBenchmark(modelName) {
    console.log(`\n>>> Starting Benchmarking for: ${modelName} <<<`);
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
        projects: projectResults
    };
}

/**
 * Generates a full SRS for a project using a specific model.
 */
async function processProject(modelName, project) {
    const result = {
        projectId: project.id,
        projectName: project.name,
        sections: {},
        metrics: {
            totalLatency: 0,
            promptTokens: 0,
            completionTokens: 0,
            regenerationCount: 0,
            errors: []
        },
        isValid: true
    };

    const fullSrs = JSON.parse(JSON.stringify(SRS_SKELETON));
    fullSrs.projectTitle = project.name;

    const generatedSections = {}; // To pass as context to the next section

    for (const section of SRS_SECTIONS) {
        let success = false;
        let attempt = 0;

        while (attempt < MAX_SECTION_RETRIES && !success) {
            attempt++;
            const systemPrompt = getSystemPrompt(section);
            const userPrompt = getUserPrompt(section, project.name, project.description, generatedSections);

            const response = await callModel(modelName, userPrompt, systemPrompt);

            result.metrics.totalLatency += response.latency;
            if (response.usage) {
                result.metrics.promptTokens += response.usage.prompt_tokens;
                result.metrics.completionTokens += response.usage.completion_tokens;
            }

            if (response.success) {
                try {
                    const content = JSON.parse(response.content);
                    const validation = validateSection(section, content);

                    if (validation.success) {
                        success = true;
                        fullSrs[section] = content;
                        generatedSections[section] = content; // Update context for next section
                    } else {
                        result.metrics.regenerationCount++;
                        result.metrics.errors.push(`[${section}] Validation failed (Attempt ${attempt}): ${validation.errors.join(', ')}`);
                    }
                } catch (e) {
                    result.metrics.regenerationCount++;
                    result.metrics.errors.push(`[${section}] JSON Parse error (Attempt ${attempt}): ${e.message}`);
                }
            } else {
                result.metrics.regenerationCount++;
                result.metrics.errors.push(`[${section}] API error (Attempt ${attempt}): ${response.error}`);
            }
        }

        result.sections[section] = { success, attempts: attempt };
        if (!success) {
            result.isValid = false;
            break; // Optimization: Stop if a prerequisite section fails
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
    console.log(`SRA-PRO BENCHMARK STARTING [NVIDIA LABS MODE]`);
    console.log(`Concurrency: ${CONCURRENCY_LIMIT} | Projects: ${projects.length} | Models: ${MODELS.length}`);
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

        return {
            model: m.model,
            validity: `${((valid / total) * 100).toFixed(1)}%`,
            avgRegen: (totalRegens / total).toFixed(2),
            avgLatency: `${(totalLat / total / 1000).toFixed(2)}s`,
            avgTokens: Math.round((totalPT + totalCT) / total),
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
