/**
 * FIXED IEEE 830 JSON SKELETON
 * This structure is immutable.
 * The model only fills the predefined fields.
 */

const SRS_SKELETON = {
    projectTitle: "",
    revisionHistory: [
        {
            version: "1.0",
            date: new Date().toISOString().split('T')[0],
            description: "Initial generation by SRA-Pro Pipeline",
            author: "SRA-Pro Autonomous Orchestrator"
        }
    ],
    introduction: {
        purpose: "",
        documentConventions: "",
        intendedAudience: "",
        productScope: "",
        references: []
    },
    overallDescription: {
        productPerspective: "",
        productFunctions: [],
        userClassesAndCharacteristics: [],
        operatingEnvironment: "",
        designAndImplementationConstraints: [],
        userDocumentation: [],
        assumptionsAndDependencies: []
    },
    externalInterfaceRequirements: {
        userInterfaces: "",
        hardwareInterfaces: "",
        softwareInterfaces: "",
        communicationsInterfaces: ""
    },
    systemFeatures: [
        {
            name: "",
            description: "",
            stimulusResponseSequences: [],
            functionalRequirements: []
        }
    ],
    nonFunctionalRequirements: {
        performanceRequirements: [],
        safetyRequirements: [],
        securityRequirements: [],
        softwareQualityAttributes: [],
        businessRules: []
    },
    otherRequirements: [],
    glossary: [],
    appendices: {
        analysisModels: {
            flowchartDiagram: { code: "", caption: "", syntaxExplanation: "" },
            sequenceDiagram: { code: "", caption: "", syntaxExplanation: "" },
            entityRelationshipDiagram: { code: "", caption: "", syntaxExplanation: "" }
        },
        tbdList: []
    }
};

const SRS_SECTIONS = [
    "introduction",
    "overallDescription",
    "externalInterfaceRequirements",
    "systemFeatures",
    "nonFunctionalRequirements",
    "appendices"
];

module.exports = { SRS_SKELETON, SRS_SECTIONS };
