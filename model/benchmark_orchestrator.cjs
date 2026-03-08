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
 *   - Multi-Template Support (IEEE, ISO, Volere, Agile)
 *   - Contextual Chain-of-Generation
 *   - Parallel Batching (Concurrency control)
 *   - Granular Metric Tracking (Tokens, Errors, Compliance, Score)
 *   - Reflection-style retry with error feedback injection
 */

const fs = require('fs');
const path = require('path');
const { callModel, MODELS } = require('./model_clients.cjs');
const { getTemplateConfig, getAvailableTemplates } = require('./srs_skeleton.cjs');
const { validateSection, checkAlignment } = require('./srs_validator.cjs');
const { getSystemPrompt, getUserPrompt } = require('./srs_prompt_factory.cjs');
const { scoreSRS } = require('./srs_scorer.cjs');
const projects = require('./benchmark_projects.json');

const CONCURRENCY_LIMIT = parseInt(process.env.BENCHMARK_CONCURRENCY) || 2;
const MAX_SECTION_RETRIES = parseInt(process.env.MAX_SECTION_RETRIES) || 3;

// Template selection: comma-separated list or "ALL"
const SRS_TEMPLATE_ENV = process.env.SRS_TEMPLATE || "IEEE_830";
let TEMPLATES_TO_RUN = [];

if (SRS_TEMPLATE_ENV.toUpperCase() === "ALL") {
    TEMPLATES_TO_RUN = getAvailableTemplates().map(t => t.id);
} else {
    TEMPLATES_TO_RUN = SRS_TEMPLATE_ENV.split(',').map(s => s.trim());
}

/**
 * Runs the benchmark for a single model on a specific template.
 */
async function runTemplateBenchmark(modelName, templateId) {
    console.log(`\n>>> Benchmarking Model: ${modelName} | Template: ${templateId} <<<`);
    const projectResults = [];

    // Batch projects based on concurrency limit
    for (let i = 0; i < projects.length; i += CONCURRENCY_LIMIT) {
        const batch = projects.slice(i, i + CONCURRENCY_LIMIT);
        console.log(`  Processing Batch ${Math.floor(i / CONCURRENCY_LIMIT) + 1}/${Math.ceil(projects.length / CONCURRENCY_LIMIT)}...`);

        const batchPromises = batch.map(project => processProject(modelName, project, templateId));
        const batchResults = await Promise.all(batchPromises);
        projectResults.push(...batchResults);
    }

    return {
        model: modelName,
        template: templateId,
        projects: projectResults
    };
}

/**
 * Generates a full SRS for a project using a specific model and template.
 * Implements the 5-layer pipeline per section.
 */
async function processProject(modelName, project, templateId) {
    const { skeleton, sections, name: templateName } = getTemplateConfig(templateId);
    const result = {
        projectId: project.id,
        projectName: project.name,
        template: templateId,
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
            const systemPrompt = getSystemPrompt(section, templateId);
            let userPrompt = getUserPrompt(section, project.name, project.description, generatedSections, templateId);

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
                    const validation = validateSection(section, content, templateId);

                    if (validation.errors.length > 0) {
                        lastErrors = validation.errors;
                        result.metrics.regenerationCount++;
                        result.metrics.validationErrors.push(...validation.errors.map(e => `[${section}] ${e}`));
                        result.metrics.errors.push(`[${section}] Validation failed (Attempt ${attempt}): ${validation.errors.join(', ')}`);
                        continue;
                    }

                    if (validation.warnings.length > 0) {
                        result.metrics.validationErrors.push(...validation.warnings.map(w => `[WARN][${section}] ${w}`));
                    }

                    // --- LAYER 4: Alignment Check ---
                    const alignment = checkAlignment(section, content, project.name, project.description);
                    if (!alignment.aligned) {
                        result.metrics.alignmentMismatches.push(...alignment.mismatches.map(m => `[${section}] ${m}`));
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
            break;
        }
    }

    // Score the generated SRS
    const scoreResult = scoreSRS(fullSrs, templateId, project.name, project.description);
    result.score = scoreResult;

    // Save the final artifacts
    const outputDir = path.join(__dirname, 'benchmarks', 'artifacts', modelName.replace(/ /g, '_'), templateId);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, `srs_${project.id}.json`), JSON.stringify(fullSrs, null, 2));
    fs.writeFileSync(path.join(outputDir, `score_${project.id}.json`), JSON.stringify(scoreResult, null, 2));

    return result;
}

async function main() {
    const start = Date.now();
    const allResults = [];

    console.log(`\n=================================================`);
    console.log(`SRA-PRO BENCHMARK [NVIDIA LABS MODE]`);
    console.log(`Templates: ${TEMPLATES_TO_RUN.join(', ')}`);
    console.log(`Concurrency: ${CONCURRENCY_LIMIT} | Retries: ${MAX_SECTION_RETRIES}`);
    console.log(`Projects: ${projects.length} | Models: ${MODELS.length}`);
    console.log(`=================================================\n`);

    for (const model of MODELS) {
        for (const templateId of TEMPLATES_TO_RUN) {
            const benchmarkData = await runTemplateBenchmark(model, templateId);
            allResults.push(benchmarkData);
        }
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
        const avgScore = total > 0 ? Math.round(m.projects.reduce((s, p) => s + (p.score ? p.score.total : 0), 0) / total) : 0;

        return {
            model: m.model,
            template: m.template,
            validity: `${((valid / total) * 100).toFixed(1)}%`,
            avgScore: `${avgScore}/100`,
            avgGrade: getAvgGrade(avgScore),
            avgRegen: (totalRegens / total).toFixed(2),
            avgLatency: `${(totalLat / total / 1000).toFixed(2)}s`,
            avgTokens: Math.round((totalPT + totalCT) / total),
            alignmentIssues: totalAlignIssues
        };
    });

    console.log("\n=== CONSOLIDATED BENCHMARK RESULTS ===");
    console.table(summary);
    console.log(`Total Duration: ${Math.round(duration)}s`);

    const reportPath = path.join(__dirname, 'benchmarks', 'combined_benchmark_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ summary, details: allResults, timestamp: new Date() }, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);
}

function getAvgGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}

main().catch(console.error);
