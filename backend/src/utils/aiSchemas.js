import { SchemaType } from "@google/generative-ai";

export const RefinedIntentSchema = {
    type: SchemaType.OBJECT,
    description: "Refined user intent for a project.",
    properties: {
        projectTitle: { type: SchemaType.STRING },
        scopeSummary: { type: SchemaType.STRING },
        features: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING },
                    priority: { type: SchemaType.STRING }
                },
                required: ["name", "description", "priority"]
            }
        },
        userStories: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    role: { type: SchemaType.STRING },
                    action: { type: SchemaType.STRING },
                    benefit: { type: SchemaType.STRING },
                    acceptanceCriteria: {
                        type: SchemaType.ARRAY,
                        items: { type: SchemaType.STRING }
                    }
                },
                required: ["role", "action", "benefit", "acceptanceCriteria"]
            }
        }
    },
    required: ["projectTitle", "scopeSummary", "features", "userStories"]
};

export const ArchitectSchema = {
    type: SchemaType.OBJECT,
    description: "Technology-agnostic logical architecture and product blueprint.",
    properties: {
        logicalComponents: {
            type: SchemaType.ARRAY,
            description: "The core logical parts or subsystems of the product.",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING, description: "e.g., Firmware, Data Engine, UI Shell, Sensor Array" },
                    role: { type: SchemaType.STRING, description: "The primary responsibility of this component." }
                },
                required: ["name", "role"]
            }
        },
        entityModel: {
            type: SchemaType.ARRAY,
            description: "Core logical entities/data objects and their relationships.",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    entity: { type: SchemaType.STRING, description: "Entity name (e.g., User, Transaction, SensorReading)" },
                    attributes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    relationships: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                },
                required: ["entity", "attributes", "relationships"]
            }
        },
        logicalPrinciples: {
            type: SchemaType.ARRAY,
            description: "Agnostic architectural principles and technical requirements.",
            items: { type: SchemaType.STRING }
        }
    },
    required: ["logicalComponents", "entityModel", "logicalPrinciples"]
};

export const ArchitectFoundationSchema = {
    type: SchemaType.OBJECT,
    description: "Identifies the core logical components of the product.",
    properties: {
        logicalComponents: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING },
                    role: { type: SchemaType.STRING }
                },
                required: ["name", "role"]
            }
        }
    },
    required: ["logicalComponents"]
};

export const ArchitectDataSchema = {
    type: SchemaType.OBJECT,
    description: "Defines the logical entity structure and data lifecycle.",
    properties: {
        entityModel: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    entity: { type: SchemaType.STRING },
                    attributes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    relationships: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                },
                required: ["entity", "attributes", "relationships"]
            }
        }
    },
    required: ["entityModel"]
};

export const ArchitectPrinciplesSchema = {
    type: SchemaType.OBJECT,
    description: "Identifies product-level technical principles.",
    properties: {
        logicalPrinciples: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        }
    },
    required: ["logicalPrinciples"]
};

export const ReviewSchema = {
    type: SchemaType.OBJECT,
    description: "Audit review of an SRS draft.",
    properties: {
        status: { type: SchemaType.STRING },
        score: { type: SchemaType.NUMBER, description: "A quality score from 0 to 100." },
        feedback: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    issue: { type: SchemaType.STRING },
                    category: { type: SchemaType.STRING },
                    severity: { type: SchemaType.STRING },
                    suggestion: { type: SchemaType.STRING }
                },
                required: ["issue", "category", "severity"]
            }
        },
        securityAudit: {
            type: SchemaType.OBJECT,
            properties: {
                vulnerabilities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                recommendations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            }
        },
        summary: { type: SchemaType.STRING }
    },
    required: ["status", "feedback", "score"]
};

export const AuditSchema = {
    type: SchemaType.OBJECT,
    description: "Detailed quality score and IEEE compliance audit.",
    properties: {
        overallScore: { type: SchemaType.NUMBER, description: "Total quality score from 0 to 100." },
        scores: {
            type: SchemaType.OBJECT,
            properties: {
                clarity: { type: SchemaType.NUMBER, description: "Score 0-100" },
                completeness: { type: SchemaType.NUMBER, description: "Score 0-100" },
                conciseness: { type: SchemaType.NUMBER, description: "Score 0-100" },
                consistency: { type: SchemaType.NUMBER, description: "Score 0-100" },
                correctness: { type: SchemaType.NUMBER, description: "Score 0-100" },
                context: { type: SchemaType.NUMBER, description: "Score 0-100" }
            },
            required: ["clarity", "completeness", "conciseness", "consistency", "correctness", "context"]
        },
        ieeeCompliance: {
            type: SchemaType.OBJECT,
            properties: {
                status: { type: SchemaType.STRING },
                missingSections: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                standardAdherence: { type: SchemaType.STRING }
            }
        },
        criticalIssues: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        },
        suggestions: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
        }
    },
    required: ["overallScore", "scores", "criticalIssues", "suggestions"]
};

export const SRSShellSchema = {
    type: SchemaType.OBJECT,
    description: "SRS Header, Intro and Overview.",
    properties: {
        projectTitle: { type: SchemaType.STRING },
        revisionHistory: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    version: { type: SchemaType.STRING },
                    date: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING },
                    author: { type: SchemaType.STRING }
                }
            }
        },
        introduction: {
            type: SchemaType.OBJECT,
            properties: {
                purpose: { type: SchemaType.STRING },
                documentConventions: { type: SchemaType.STRING },
                intendedAudience: { type: SchemaType.STRING },
                productScope: { type: SchemaType.STRING },
                references: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            }
        },
        overallDescription: {
            type: SchemaType.OBJECT,
            properties: {
                productPerspective: { type: SchemaType.STRING },
                productFunctions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                userClassesAndCharacteristics: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            userClass: { type: SchemaType.STRING },
                            characteristics: { type: SchemaType.STRING }
                        }
                    }
                },
                operatingEnvironment: { type: SchemaType.STRING },
                designAndImplementationConstraints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                userDocumentation: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                assumptionsAndDependencies: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            }
        }
    },
    required: [
        "projectTitle", 
        "revisionHistory", 
        "introduction", 
        "overallDescription"
    ]
};

export const SRSFeaturesSchema = {
    type: SchemaType.OBJECT,
    description: "SRS System Features section.",
    properties: {
        systemFeatures: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING },
                    stimulusResponseSequences: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    functionalRequirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                },
                required: ["name", "description", "functionalRequirements"]
            }
        }
    },
    required: ["systemFeatures"]
};

export const SRSRequirementsSchema = {
    type: SchemaType.OBJECT,
    description: "SRS Non-Functional, Interface and Appendices.",
    properties: {
        externalInterfaceRequirements: {
            type: SchemaType.OBJECT,
            properties: {
                userInterfaces: { type: SchemaType.STRING },
                hardwareInterfaces: { type: SchemaType.STRING },
                softwareInterfaces: { type: SchemaType.STRING },
                communicationsInterfaces: { type: SchemaType.STRING }
            }
        },
        nonFunctionalRequirements: {
            type: SchemaType.OBJECT,
            properties: {
                performanceRequirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                safetyRequirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                securityRequirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                softwareQualityAttributes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                businessRules: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            }
        },
        otherRequirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        glossary: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    term: { type: SchemaType.STRING },
                    definition: { type: SchemaType.STRING }
                }
            }
        }
    },
    required: [
        "externalInterfaceRequirements",
        "nonFunctionalRequirements",
        "otherRequirements",
        "glossary"
    ]
};

export const SRSAppendicesSchema = {
    type: SchemaType.OBJECT,
    description: "SRS Appendices containing structural technical diagrams and TBD lists.",
    properties: {
        appendices: {
            type: SchemaType.OBJECT,
            properties: {
                analysisModels: {
                    type: SchemaType.OBJECT,
                    description: "Structural Mermaid diagrams for the architecture.",
                    properties: {
                        flowchartDiagram: {
                            type: SchemaType.OBJECT,
                            properties: {
                                syntaxExplanation: { type: SchemaType.STRING },
                                code: { type: SchemaType.STRING },
                                caption: { type: SchemaType.STRING }
                            }
                        },
                        sequenceDiagram: {
                            type: SchemaType.OBJECT,
                            properties: {
                                syntaxExplanation: { type: SchemaType.STRING },
                                code: { type: SchemaType.STRING },
                                caption: { type: SchemaType.STRING }
                            }
                        },
                        entityRelationshipDiagram: {
                            type: SchemaType.OBJECT,
                            properties: {
                                syntaxExplanation: { type: SchemaType.STRING },
                                code: { type: SchemaType.STRING },
                                caption: { type: SchemaType.STRING }
                            }
                        }
                    }
                },
                tbdList: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            }
        }
    },
    required: ["appendices"]
};

export const SRSSchema = {
    type: SchemaType.OBJECT,
    description: "IEEE 830-1998 compliant SRS document.",
    properties: {
        projectTitle: { type: SchemaType.STRING },
        revisionHistory: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    version: { type: SchemaType.STRING },
                    date: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING },
                    author: { type: SchemaType.STRING }
                }
            }
        },
        introduction: {
            type: SchemaType.OBJECT,
            properties: {
                purpose: { type: SchemaType.STRING },
                documentConventions: { type: SchemaType.STRING },
                intendedAudience: { type: SchemaType.STRING },
                productScope: { type: SchemaType.STRING },
                references: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            }
        },
        overallDescription: {
            type: SchemaType.OBJECT,
            properties: {
                productPerspective: { type: SchemaType.STRING },
                productFunctions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                userClassesAndCharacteristics: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            userClass: { type: SchemaType.STRING },
                            characteristics: { type: SchemaType.STRING }
                        }
                    }
                },
                operatingEnvironment: { type: SchemaType.STRING },
                designAndImplementationConstraints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                userDocumentation: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                assumptionsAndDependencies: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            }
        },
        externalInterfaceRequirements: {
            type: SchemaType.OBJECT,
            properties: {
                userInterfaces: { type: SchemaType.STRING },
                hardwareInterfaces: { type: SchemaType.STRING },
                softwareInterfaces: { type: SchemaType.STRING },
                communicationsInterfaces: { type: SchemaType.STRING }
            }
        },
        systemFeatures: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING },
                    description: { type: SchemaType.STRING },
                    stimulusResponseSequences: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                    functionalRequirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                }
            }
        },
        nonFunctionalRequirements: {
            type: SchemaType.OBJECT,
            properties: {
                performanceRequirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                safetyRequirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                securityRequirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                softwareQualityAttributes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                businessRules: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            }
        },
        otherRequirements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        glossary: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    term: { type: SchemaType.STRING },
                    definition: { type: SchemaType.STRING }
                }
            }
        },
        appendices: {
            type: SchemaType.OBJECT,
            properties: {
                analysisModels: {
                    type: SchemaType.OBJECT,
                    properties: {
                        flowchartDiagram: {
                            type: SchemaType.OBJECT,
                            properties: {
                                syntaxExplanation: { type: SchemaType.STRING },
                                code: { type: SchemaType.STRING },
                                caption: { type: SchemaType.STRING }
                            }
                        },
                        sequenceDiagram: {
                            type: SchemaType.OBJECT,
                            properties: {
                                syntaxExplanation: { type: SchemaType.STRING },
                                code: { type: SchemaType.STRING },
                                caption: { type: SchemaType.STRING }
                            }
                        },
                        entityRelationshipDiagram: {
                            type: SchemaType.OBJECT,
                            properties: {
                                syntaxExplanation: { type: SchemaType.STRING },
                                code: { type: SchemaType.STRING },
                                caption: { type: SchemaType.STRING }
                            }
                        }
                    }
                },
                tbdList: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            }
        }
    },
    required: ["projectTitle", "introduction", "overallDescription", "systemFeatures"]
};
