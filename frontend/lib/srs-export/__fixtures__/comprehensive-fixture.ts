import type { AnalysisResult } from "@/types/analysis";

/**
 * One fixture per format id, each populated to exercise every section kind and every
 * group-field kind that format actually uses (see lib/formats/specs.ts), including both
 * plain-string and shell-object variants of requirement lists, and both populated and
 * empty branches. Used by renderer-parity.test.ts to verify the shared section-walker
 * refactor (markdown/latex/typst) produces byte-identical output to the pre-refactor
 * per-format switch statements it replaced.
 */

const sharedDiagrams = {
    appendices: {
        analysisModels: {
            flowchartDiagram: { code: "flowchart TD\n  A[Start] --> B[Process] --> C[End]", syntaxExplanation: "Core flow" },
            sequenceDiagram: { code: "sequenceDiagram\n  User->>System: Request\n  System-->>User: Response", syntaxExplanation: "Interaction" },
            entityRelationshipDiagram: "erDiagram\n  USER ||--o{ ORDER : places",
        },
    },
};

export const ieee830Fixture = {
    projectTitle: "Payment Gateway",
    revisionHistory: [{ version: "1.0.0", date: "2026-01-01", description: "Initial baseline", author: "SRA Engine" }],
    qualityAudit: { score: 92, ieeeCompliance: { status: "COMPLIANT" } },
    contradictions: ["Section 3.2 conflicts with Section 5.1 on retry timeout."],
    missingLogic: ["No handling specified for a declined card mid-transaction."],
    introduction: {
        purpose: "Provide a secure payment processing infrastructure.",
        documentConventions: "IEEE 830-1998 standard conventions.",
        intendedAudience: "Engineering, QA, and compliance stakeholders.",
        productScope: "",
        references: ["IEEE Std 830-1998", "PCI DSS v4.0"],
    },
    overallDescription: {
        productPerspective: "A standalone payment microservice.",
        productFunctions: ["Authorize card", "Capture funds", "Issue refund"],
        userClassesAndCharacteristics: [
            { userClass: "Merchant Admin", characteristics: "Configures payment methods." },
            { name: "Support Agent", description: "Investigates failed transactions." },
        ],
        operatingEnvironment: "",
        designAndImplementationConstraints: [],
        userDocumentation: ["API reference"],
        assumptionsAndDependencies: ["Assumes a reachable card network gateway."],
    },
    externalInterfaceRequirements: {
        userInterfaces: "None — this is a backend service.",
        hardwareInterfaces: "",
        softwareInterfaces: "REST API over HTTPS.",
        communicationsInterfaces: "TLS 1.3.",
    },
    systemFeatures: [
        {
            name: "Credit Card Processing",
            description: "Processes Visa and Mastercard transactions.",
            stimulusResponseSequences: ["User submits card details", "System returns authorization result"],
            functionalRequirements: [
                "The system shall validate the 16-digit card number using the Luhn algorithm.",
                {
                    id: "FR-CUSTOM-1",
                    description: "The system shall verify CVV with the card issuing network.",
                    rationale: "Reduces card-not-present fraud.",
                    fitCriterion: "99.9% of invalid CVVs rejected in under 500ms.",
                    verificationMethod: "Test",
                    source: "PCI DSS 3.2",
                },
            ],
        },
        { name: "Empty Feature", description: "", functionalRequirements: [] },
    ],
    nonFunctionalRequirements: {
        performanceRequirements: ["95th percentile latency under 200ms."],
        safetyRequirements: [],
        securityRequirements: ["All card data encrypted at rest with AES-256."],
        softwareQualityAttributes: ["Availability: 99.95% monthly uptime."],
        businessRules: [],
    },
    otherRequirements: ["Must support PCI DSS re-certification annually."],
    glossary: [
        { term: "PAN", definition: "Primary Account Number" },
        { name: "CVV", description: "Card Verification Value" },
    ],
    ...sharedDiagrams,
} as unknown as AnalysisResult;

export const iso29148Fixture = {
    projectTitle: "Fleet Telemetry Platform",
    introduction: {
        purpose: "Collect and analyze vehicle telemetry in real time.",
        scope: "Covers ingestion, storage, and dashboarding.",
        productPerspective: "A cloud-native streaming pipeline.",
        productFunctions: ["Ingest telemetry", "Detect anomalies"],
        userCharacteristics: [{ userClass: "Fleet Operator", characteristics: "Monitors live vehicle status." }],
        constraints: ["Must run within existing AWS account."],
        assumptionsAndDependencies: [],
    },
    references: ["ISO/IEC/IEEE 29148:2018"],
    specificRequirements: {
        userInterfaces: "Web dashboard.",
        hardwareInterfaces: "OBD-II telemetry units.",
        softwareInterfaces: "Kafka ingestion topic.",
        communicationsInterfaces: "MQTT over TLS.",
    },
    systemFunctions: [
        {
            name: "Anomaly Detection",
            description: "Flags telemetry outside expected ranges.",
            functionalRequirements: [
                { id: "SF-1", description: "The system shall flag readings 3 standard deviations from the rolling mean.", verificationMethod: "Analysis" },
            ],
        },
    ],
    systemAttributes: {
        performance: ["Process 10k events/sec sustained."],
        security: ["mTLS between all internal services."],
        safety: [],
        qualityAttributes: [],
        businessRules: [],
    },
    verification: "Verified via load testing and anomaly-injection drills.",
    glossary: [{ term: "OBD-II", definition: "On-board diagnostics standard." }],
    ...sharedDiagrams,
} as unknown as AnalysisResult;

export const volereFixture = {
    projectTitle: "Volunteer Scheduling Tool",
    purpose: {
        businessProblem: "Volunteer shifts are currently coordinated by spreadsheet.",
        goals: ["Reduce no-show rate", "Cut coordinator admin time by half"],
    },
    stakeholders: [
        { role: "Coordinator", interest: "Fast shift assignment." },
        { role: "Volunteer", interest: "Clear, timely shift reminders." },
    ],
    constraints: {
        solutionConstraints: ["Must integrate with existing SMS provider."],
        implementationEnvironment: "Deployed on the org's existing hosting.",
        assumptions: ["Volunteers have a mobile phone capable of SMS."],
    },
    namingConventions: [{ term: "Shift", definition: "A scheduled volunteer time block." }],
    functionalRequirements: [
        {
            name: "Shift Assignment",
            description: "Assign volunteers to open shifts.",
            functionalRequirements: [
                {
                    description: "The system shall notify a volunteer within 5 minutes of assignment.",
                    rationale: "Timely confirmation reduces no-shows.",
                    fitCriterion: "95% of notifications sent within 5 minutes.",
                },
            ],
        },
    ],
    nonFunctionalRequirements: {
        lookAndFeel: ["The UI shall use the org's existing brand palette."],
        usability: [{ description: "A first-time coordinator shall complete shift setup within 10 minutes unaided.", fitCriterion: "90% success rate in usability testing." }],
        performance: [],
        operational: ["The system shall run on commodity hosting with no dedicated ops staff."],
        maintainability: [],
        security: ["Volunteer phone numbers shall be encrypted at rest."],
        cultural: [],
        legal: ["Must comply with TCPA consent requirements for SMS."],
    },
    projectIssues: [
        { issue: "SMS provider rate limits", impact: "Could delay notifications during peak sign-up.", mitigation: "Queue and backoff." },
    ],
    ...sharedDiagrams,
} as unknown as AnalysisResult;

export const agilePrdFixture = {
    projectTitle: "Team Kudos App",
    overview: {
        vision: "Make peer recognition a two-click habit.",
        problem: "Recognition currently happens ad hoc in Slack and gets lost.",
    },
    objectives: ["Ship an MVP in one quarter.", "Reach 40% weekly active usage."],
    personas: [
        { name: "Priya the Manager", description: "Wants visibility into team morale.", goals: ["See recognition trends", "Nominate for awards"] },
        { name: "Sam the IC", description: "" },
    ],
    userStories: [
        {
            role: "team member",
            action: "give a kudos to a teammate",
            benefit: "I can recognize their help immediately",
            acceptanceCriteria: ["Kudos post appears in the team feed within 1 second.", "Recipient gets a notification."],
        },
        { role: "manager", feature: "export a monthly recognition report" },
    ],
    nonFunctionalRequirements: ["The feed shall load in under 1 second on 4G."],
    openQuestions: ["Should kudos be anonymous by default?"],
    glossary: [{ term: "Kudos", definition: "A short public note of recognition." }],
} as unknown as AnalysisResult;
