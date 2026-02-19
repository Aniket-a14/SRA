import prisma from '../config/prisma.js';
import { getLatestAnalysisByProjectId } from './analysisService.js';

class AuditService {

    /**
     * Gets pending requirements for review across all user projects.
     * @param {string} userId
     */
    async getPendingReviews(userId) {
        // 1. Get all projects for the user
        const projects = await prisma.project.findMany({
            where: { userId },
            select: { id: true, name: true }
        });

        const pending = [];

        // 2. For each project, get the latest analysis
        // Optimally we could do this in one query, but for now loop is safer for logic
        for (const project of projects) {
            const latestAnalysis = await prisma.analysis.findFirst({
                where: { projectId: project.id },
                orderBy: { version: 'desc' }
            });

            if (!latestAnalysis || !latestAnalysis.resultJson) continue;

            const spec = latestAnalysis.resultJson;
            if (spec.systemFeatures) {
                spec.systemFeatures.forEach(feature => {
                    if (feature.functionalRequirements) {
                        feature.functionalRequirements.forEach(r => {
                            let req = r;
                            let reqId = 'UNKNOWN';
                            let status = 'DRAFT_AI';
                            let description = '';

                            if (typeof r === 'string') {
                                // Legacy string format
                                const idMatch = r.match(/^([A-Z]+-[A-Z]+-\d+(\.\d+)?)/);
                                reqId = idMatch ? idMatch[1] : 'UNKNOWN';
                                description = r;
                            } else {
                                // Object format
                                reqId = r.id || reqId;
                                status = r.metadata?.verification_status || 'DRAFT_AI';
                                description = r.description;
                            }

                            if (status !== 'APPROVED_HUMAN') {
                                pending.push({
                                    id: reqId,
                                    description: description,
                                    metadata: { verification_status: status },
                                    // Context for saving
                                    analysisId: latestAnalysis.id,
                                    projectId: project.id,
                                    projectName: project.name,
                                    featureName: feature.name
                                });
                            }
                        });
                    }
                });
            }
        }
        return pending;
    }

    /**
     * Stamps a requirement with human verification in the DB.
     * @param {string} analysisId
     * @param {string} reqId 
     * @param {string} userId 
     * @param {string} status - 'APPROVED_HUMAN' | 'REJECTED_HUMAN'
     */
    async verifyRequirement(analysisId, reqId, userId, status = 'APPROVED_HUMAN') {
        // 1. Fetch Analysis
        const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
        if (!analysis) throw new Error("Analysis not found");

        const resultJson = analysis.resultJson;
        let found = false;

        // 2. Find and Update in Memory
        if (resultJson.systemFeatures) {
            for (const feature of resultJson.systemFeatures) {
                if (feature.functionalRequirements) {

                    // Map to handle string -> object conversion if needed (Auto-Migration)
                    feature.functionalRequirements = feature.functionalRequirements.map(r => {
                        let currentId = 'UNKNOWN';
                        if (typeof r === 'string') {
                            const match = r.match(/^([A-Z]+-[A-Z]+-\d+(\.\d+)?)/);
                            currentId = match ? match[1] : 'UNKNOWN';
                        } else {
                            currentId = r.id;
                        }

                        if (currentId === reqId) {
                            found = true;
                            // Convert to object if string
                            if (typeof r === 'string') {
                                return {
                                    id: currentId,
                                    description: r,
                                    metadata: {
                                        verification_status: status,
                                        verifiedBy: userId,
                                        verifiedAt: new Date().toISOString()
                                    }
                                };
                            } else {
                                // Update existing object
                                return {
                                    ...r,
                                    metadata: {
                                        ...r.metadata,
                                        verification_status: status,
                                        verifiedBy: userId,
                                        verifiedAt: new Date().toISOString()
                                    }
                                };
                            }
                        }
                        return r;
                    });
                }
            }
        }

        if (!found) {
            throw new Error(`Requirement ${reqId} not found in Analysis ${analysisId}`);
        }

        // 3. Save back to DB (In-Place Update for now to avoid version spam on each click)
        await prisma.analysis.update({
            where: { id: analysisId },
            data: { resultJson }
        });

        // 4. Log to Audit Table (if we had one separate, but we store in metadata for now)
        // const action = { action: 'VERIFICATION', actor: userId, reqId, status, timestamp: new Date() };
        // await prisma.auditLog.create(...) 

        return { success: true };
    }
}

export default new AuditService();
