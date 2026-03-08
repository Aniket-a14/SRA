/**
 * SRA-PRO TEMPLATE REGISTRY (Industry-Grade)
 * 
 * Each template follows the EXACT structure from official sources:
 * - IEEE 830-1998 (from IEEE Recommended Practice)
 * - ISO/IEC/IEEE 29148:2018 (from ISO standard)
 * - Volere (from Robertson & Robertson, Atlantic Systems Guild)
 * - Agile (from Connextra format, INVEST criteria, BDD)
 * 
 * Each template contains:
 *   - sections: ordered list of top-level section keys
 *   - sectionInstructions: official guidance text per section (what to write)
 *   - skeleton: JSON schema per section (structure to fill)
 *   - rules: requirement prefix, quantification, forbidden terms
 *   - systemPromptDirective: role-based persona for the LLM
 */

const FORBIDDEN_TERMS = [
    "easy to use", "user-friendly", "robust", "flexible", "efficient",
    "optimal", "powerful", "high-performance", "state-of-the-art", "seamless",
    "intuitive", "scalable", "reliable", "fast", "simple", "cutting-edge",
    "best-in-class", "world-class", "next-generation", "innovative"
];

const TEMPLATES = {

    // ========================================================================
    // IEEE 830-1998 — Recommended Practice for SRS
    // ========================================================================
    "IEEE_830": {
        name: "IEEE 830-1998",
        description: "The classic IEEE standard for Software Requirements Specifications. Three main sections: Introduction, Overall Description, Specific Requirements.",

        systemPromptDirective: `You are a senior systems engineer writing a formal IEEE 830-1998 compliant Software Requirements Specification. You must write in the third person, using precise technical language. Every functional requirement MUST use the "The system shall" prefix. Non-functional requirements MUST include quantifiable metrics (response times in ms, uptime percentages, throughput numbers). Do not use marketing language or vague qualitative terms.`,

        sections: [
            "introduction",
            "overallDescription",
            "specificRequirements",
            "appendices"
        ],

        sectionInstructions: {
            introduction: {
                _self: "This section should provide an overview of the entire SRS.",
                purpose: "This subsection should: a) Delineate the purpose of the SRS; b) Specify the intended audience for the SRS.",
                scope: "This subsection should: a) Identify the software product(s) to be produced by name (e.g., Host DBMS, Report Generator, etc.); b) Explain what the software product(s) will, and, if necessary, will not do; c) Describe the application of the software being specified, including relevant benefits, objectives, and goals. Be consistent with similar statements in higher-level specifications if they exist.",
                definitionsAcronymsAbbreviations: "This subsection should provide the definitions of all terms, acronyms, and abbreviations required to properly interpret the SRS. This information may be provided by reference to one or more appendices in the SRS or by reference to other documents.",
                references: "This subsection should: a) Provide a complete list of all documents referenced elsewhere in the SRS; b) Identify each document by title, report number (if applicable), date, and publishing organization; c) Specify the sources from which the references can be obtained.",
                overview: "This subsection should: a) Describe what the rest of the SRS contains; b) Explain how the SRS is organized."
            },
            overallDescription: {
                _self: "This section should describe the general factors that affect the product and its requirements. It does not state specific requirements; instead it provides a background for those requirements.",
                productPerspective: "This subsection should put the product into perspective with other related products. If the product is independent and totally self-contained, it should be so stated here. If the SRS defines a product that is a component of a larger system, this subsection should relate the requirements of the larger system to the functionality of the software and should identify interfaces between that system and the software.",
                productFunctions: "This subsection should provide a summary of the major functions that the software will perform. Sometimes the function summary that is necessary for this part can be taken directly from the section of the higher-level specification (if one exists) that allocates particular functions to the software product.",
                userCharacteristics: "Describe those general characteristics of the intended users of the product including educational level, experience, and technical expertise. It should not be used to state specific requirements.",
                constraints: "Provide a general description of any other items that will limit the developer's options. These include regulatory policies, hardware limitations, interfaces to other applications, parallel operation, audit functions, control functions, higher-order language requirements, signal handshake protocols, reliability requirements, criticality of the application, safety and security considerations.",
                assumptionsAndDependencies: "This subsection should list each of the factors that affect the requirements stated in the SRS. These factors are not design constraints on the software but are, rather, any changes to them that can affect the requirements in the SRS. For example, an assumption may be that a specific operating system will be available on the hardware designated for the software product. If, in fact, the operating system is not available, the SRS would then have to change accordingly.",
                apportioningOfRequirements: "Identify requirements that may be delayed until future versions of the system."
            },
            specificRequirements: {
                _self: "This section of the SRS should contain all of the software requirements to a level of detail sufficient to enable designers to design a system to satisfy those requirements, and testers to test that the system satisfies those requirements. Throughout this section, every stated requirement should be externally perceivable by users, operators, or other external systems.",
                externalInterfaces: "This should be a detailed description of all inputs into and outputs from the software system. It should complement the interface descriptions in Section 2.1 (Product Perspective) and should not repeat information there. Each interface described should include: name of item, description of purpose, source of input or destination of output, valid range/accuracy/tolerance of values, units of measure, timing, relationships to other inputs/outputs, screen formats/organization, window formats/organization, data formats, command formats, end messages.",
                functions: "Functional requirements should define the fundamental actions that must take place in the software in accepting and processing the inputs and in processing and generating the outputs. These are generally listed as 'shall' statements starting with 'The system shall...' For each functional requirement, describe: a) Validity checks on the inputs; b) Exact sequence of operations; c) Responses to abnormal situations, including overflow, communication facilities, error handling and recovery; d) Effect of parameters; e) Relationship of outputs to inputs, including input/output sequences and formulas for input to output conversion.",
                performanceRequirements: "This subsection should specify both the static and the dynamic numerical requirements placed on the software or on human interaction with the software as a whole. Static numerical requirements may include the number of terminals to be supported, the number of simultaneous users to be supported, the amount and type of information to be handled. Dynamic numerical requirements may include the number of transactions and tasks and the amount of data to be processed within certain time periods for both normal and peak workload conditions.",
                logicalDatabaseRequirements: "Specify the logical requirements for any information that is to be placed into a database. This may include types of information used by various functions, frequency of use, accessing capabilities, data entities and their relationships, integrity constraints, data retention requirements.",
                designConstraints: "This subsection should specify design constraints that can be imposed by other standards, hardware limitations, etc. Specify constraints on the system design imposed by external standards, regulatory requirements, or project limitations.",
                softwareSystemAttributes: "There are a number of attributes of software that can serve as requirements. It is important that required attributes be specified so that their achievement can be objectively verified. The following is a partial list of examples: reliability, availability, security, maintainability, portability.",
                otherRequirements: "Any requirements not covered by the above categories."
            },
            appendices: {
                _self: "The appendices are not always considered part of the actual SRS. They may include sample input/output formats, descriptions of cost analysis studies, results of user surveys, supporting or background information, a description of the problems to be solved by the software, special packaging instructions for the code and the media.",
                analysisModels: "Include any analysis models created for the system, such as data flow diagrams, class diagrams, state-transition diagrams, or entity-relationship diagrams. Use Mermaid syntax.",
                tbdList: "Collect a numbered list of all TBD (to be determined) references in the SRS so they can be tracked to closure."
            }
        },

        skeleton: {
            introduction: {
                purpose: "",
                scope: "",
                definitionsAcronymsAbbreviations: [],
                references: [],
                overview: ""
            },
            overallDescription: {
                productPerspective: "",
                productFunctions: [],
                userCharacteristics: [],
                constraints: [],
                assumptionsAndDependencies: [],
                apportioningOfRequirements: []
            },
            specificRequirements: {
                externalInterfaces: {
                    userInterfaces: "",
                    hardwareInterfaces: "",
                    softwareInterfaces: "",
                    communicationsInterfaces: ""
                },
                functions: [],
                performanceRequirements: [],
                logicalDatabaseRequirements: [],
                designConstraints: [],
                softwareSystemAttributes: {
                    reliability: "",
                    availability: "",
                    security: "",
                    maintainability: "",
                    portability: ""
                },
                otherRequirements: []
            },
            appendices: {
                analysisModels: {
                    flowchartDiagram: { code: "", caption: "" },
                    sequenceDiagram: { code: "", caption: "" },
                    entityRelationshipDiagram: { code: "", caption: "" }
                },
                tbdList: []
            }
        },

        rules: {
            requirementPrefix: "The system shall",
            requiresQuantification: ["specificRequirements"],
            forbiddenTerms: FORBIDDEN_TERMS
        }
    },

    // ========================================================================
    // ISO/IEC/IEEE 29148:2018 — Modern Requirements Engineering
    // ========================================================================
    "ISO_29148": {
        name: "ISO/IEC/IEEE 29148:2018",
        description: "The modern successor to IEEE 830. Adds traceability, verification criteria, and stakeholder focus.",

        systemPromptDirective: `You are a modern solutions architect writing an ISO/IEC/IEEE 29148:2018 compliant specification. Focus on the relationship between stakeholders and the system. Requirements should use "The [System Name] shall" prefix. Emphasize traceability — every requirement must be linkable to a stakeholder need. Include verification methods for each requirement group. Prioritize cloud-readiness and API-first design where applicable.`,

        sections: [
            "introduction",
            "overallDescription",
            "functionalRequirements",
            "nonFunctionalRequirements",
            "verification",
            "appendices"
        ],

        sectionInstructions: {
            introduction: {
                _self: "Provide the context, scope, and purpose of the document.",
                purpose: "Briefly state the purpose of the SRS and identify the system or software product to be developed.",
                scope: "Describe the scope of the product or system, outlining what will and will not be covered by this SRS.",
                intendedAudienceAndDocumentUse: "Identify the stakeholders (developers, testers, project managers, users) and explain how they should use this document.",
                references: "List any external documents, standards, or related system documents referenced within the SRS, including version information.",
                definitionsAcronymsAbbreviations: "Provide definitions for domain-specific terms and expand any acronyms or abbreviations used.",
                documentOverview: "Summarize the structure of the SRS and its major sections."
            },
            overallDescription: {
                _self: "Provide a high-level overview of the product, its context, and general factors influencing it.",
                productPerspective: "Describe the relationship of this product to other systems or products. Include a context diagram if appropriate.",
                productFunctions: "Summarize the major functions the system or software will provide, offering a high-level functional decomposition.",
                userCharacteristics: "Describe the key user roles, their expertise, and other relevant traits.",
                constraintsAssumptionsDependencies: "Outline any technical constraints (platforms, environments), assumptions made during requirements definition, and dependencies on external factors.",
                operationalEnvironment: "Detail the environment in which the system will operate, including hardware, software, and network configurations."
            },
            functionalRequirements: {
                _self: "Detail the specific functions the system must perform. Organize by feature or functional grouping. For each requirement, provide: Description, Inputs, Processing, Outputs, Priority, and Traceability to stakeholder needs.",
            },
            nonFunctionalRequirements: {
                _self: "Describe the quality attributes and characteristics. Each must include measurable acceptance criteria.",
                performance: "Specify throughput, response times, scalability, and other quantitative performance criteria with exact numbers.",
                safetySecurity: "Detail security controls, risk mitigation, data protection, authentication, and authorization requirements.",
                reliabilityAvailability: "Define uptime requirements (e.g., 99.9%), fault-tolerance criteria, MTBF, MTTR, and error handling.",
                usabilityHumanFactors: "Address user interface standards, accessibility (WCAG), and usability goals with measurable targets.",
                maintainabilitySupport: "Cover coding standards, modularity, documentation needs, and support processes.",
                portabilityCompatibility: "Specify supported platforms, integration with legacy systems, and compatibility constraints."
            },
            verification: {
                _self: "Outline how the requirements will be verified. Specify the methods (test, inspection, analysis, demonstration), environments, test artifacts, and traceability back to requirements."
            },
            appendices: {
                _self: "Include supplementary, non-normative materials such as UI prototypes, data models, or algorithms."
            }
        },

        skeleton: {
            introduction: {
                purpose: "",
                scope: "",
                intendedAudienceAndDocumentUse: "",
                references: [],
                definitionsAcronymsAbbreviations: [],
                documentOverview: ""
            },
            overallDescription: {
                productPerspective: "",
                productFunctions: [],
                userCharacteristics: [],
                constraintsAssumptionsDependencies: [],
                operationalEnvironment: ""
            },
            functionalRequirements: [
                {
                    featureName: "",
                    description: "",
                    inputs: [],
                    processing: "",
                    outputs: [],
                    priority: "",
                    traceability: ""
                }
            ],
            nonFunctionalRequirements: {
                performance: [],
                safetySecurity: [],
                reliabilityAvailability: [],
                usabilityHumanFactors: [],
                maintainabilitySupport: [],
                portabilityCompatibility: []
            },
            verification: {
                acceptanceTests: [],
                validationMethods: []
            },
            appendices: {
                analysisModels: {
                    flowchartDiagram: { code: "", caption: "" },
                    sequenceDiagram: { code: "", caption: "" },
                    entityRelationshipDiagram: { code: "", caption: "" }
                }
            }
        },

        rules: {
            requirementPrefix: "The system shall",
            requiresQuantification: ["nonFunctionalRequirements"],
            forbiddenTerms: FORBIDDEN_TERMS
        }
    },

    // ========================================================================
    // AGILE — User Stories with INVEST & BDD
    // ========================================================================
    "AGILE_USER_STORIES": {
        name: "Agile User Stories",
        description: "Industry-standard Agile format using Connextra user stories, Given/When/Then acceptance criteria, INVEST quality checks, and Theme→Epic→Story hierarchy.",

        systemPromptDirective: `You are a senior product manager at a high-growth technology company. Focus on user value and outcomes over implementation details. Every user story MUST follow the Connextra format: "As a [role], I want [goal] so that [benefit]". Acceptance criteria MUST use the Given/When/Then (BDD) format. Stories must satisfy the INVEST criteria: Independent, Negotiable, Valuable, Estimable, Small, Testable. Do not prescribe technical solutions — describe desired behaviors.`,

        sections: [
            "productVision",
            "userPersonas",
            "featureBacklog",
            "technicalConstraints",
            "definitionOfDone"
        ],

        sectionInstructions: {
            productVision: {
                _self: "Define the product's mission, target market, and unique value proposition. This establishes the strategic context for all user stories.",
                mission: "A single sentence stating what the product does and for whom.",
                targetMarket: "Describe the primary market segment, their size, and key characteristics.",
                valueProposition: "Explain the unique benefit this product provides that alternatives do not."
            },
            userPersonas: {
                _self: "Define the distinct user roles who will interact with the system. Each persona must have goals (what they want to achieve) and pain points (what frustrates them today). These personas are referenced in user stories.",
            },
            featureBacklog: {
                _self: "Organize features as Epics containing User Stories. Each user story must follow the Connextra format: 'As a [role], I want [goal] so that [benefit]'. Each story must include acceptance criteria in Given/When/Then format. Stories must satisfy the INVEST criteria: Independent, Negotiable, Valuable, Estimable, Small, Testable.",
            },
            technicalConstraints: {
                _self: "Document any technology stack decisions, architectural constraints, or platform requirements that constrain the implementation. Focus on 'what' constraints exist, not 'how' to build.",
            },
            definitionOfDone: {
                _self: "Define the universal quality gates that every story must pass before it is considered complete. Include code review, testing, documentation, and deployment criteria with measurable thresholds.",
            }
        },

        skeleton: {
            productVision: {
                mission: "",
                targetMarket: "",
                valueProposition: ""
            },
            userPersonas: [
                {
                    role: "",
                    goals: [],
                    painPoints: []
                }
            ],
            featureBacklog: [
                {
                    epic: "",
                    userStories: [
                        {
                            story: "",
                            acceptanceCriteria: [
                                {
                                    given: "",
                                    when: "",
                                    then: ""
                                }
                            ],
                            priority: ""
                        }
                    ]
                }
            ],
            technicalConstraints: {
                stack: [],
                architecturalDecisions: [],
                platformRequirements: []
            },
            definitionOfDone: {
                qualityGates: [],
                testingRequirements: [],
                deploymentCriteria: []
            }
        },

        rules: {
            requirementPrefix: "As a",
            requiresQuantification: ["definitionOfDone"],
            forbiddenTerms: FORBIDDEN_TERMS
        }
    },

    // ========================================================================
    // VOLERE — Robertson & Robertson Shell Template
    // ========================================================================
    "VOLERE": {
        name: "Volere Requirements Template",
        description: "The Volere template from Robertson & Robertson. 27 sections across 5 parts. Each atomic requirement uses a 'Requirement Shell' (snow card) with Fit Criterion for testability.",

        systemPromptDirective: `You are a requirements analyst specializing in the Volere methodology by James and Suzanne Robertson. Every atomic requirement MUST be written using the Volere Requirement Shell format with these fields: requirement number, type, description, rationale, fit criterion, priority. The Fit Criterion is the most critical field — it must be a measurable, quantified acceptance test. If you cannot write a Fit Criterion, the requirement is too vague and must be rewritten. Focus on the distinction between the Scope of the Work (business boundary) and the Scope of the Product (what we are building).`,

        sections: [
            "projectDrivers",
            "projectConstraints",
            "functionalRequirements",
            "nonFunctionalRequirements",
            "projectIssues"
        ],

        sectionInstructions: {
            projectDrivers: {
                _self: "Establish WHY the project exists and WHO has a stake in it.",
                purposeOfProject: "This section deals with the fundamental reason your client asked you to build a new product. Describe the user business problem or background of the project effort. State the measurable, quantified goals of the project, which can be used to assess project success and quantify the business advantage gained.",
                stakeholders: "Identify the client (who pays for the development), the customer (who makes the decisions about the product), and the hands-on users (who operate the product). Include personas for different types of users."
            },
            projectConstraints: {
                _self: "Define the boundaries and givens that restrict the solution.",
                mandatedConstraints: "Describe any design restrictions (e.g., must use specific technology, must comply with regulations). Each constraint should include a description, rationale, and fit criterion.",
                namingConventions: "Define the glossary of all terms, acronyms, and abbreviations used by stakeholders.",
                relevantFactsAndAssumptions: "State external factors influencing the product not covered elsewhere. Clearly separate facts (verified) from assumptions (unverified but believed true)."
            },
            functionalRequirements: {
                _self: "Define WHAT the product must do. Use Volere Requirement Shells.",
                scopeOfWork: "This section determines the boundaries of the business area under study and outlines how it fits within its business environment. Define the business domain under study.",
                businessDataModel: "Specify the essential business objects, entities, or classes, and provide formal definitions for data inputs and outputs. Include a data dictionary defining each entity.",
                scopeOfProduct: "This section describes the scope of the product by means of detailed Product Use Cases. Define the intended product boundaries and the product's connections to adjacent systems.",
                requirements: "List each functional requirement using the Volere Requirement Shell: { requirementId, type, description, rationale, fitCriterion, priority, dependencies, conflicts }. The fitCriterion MUST be a measurable, quantified acceptance criterion against which a solution can be tested. If a fit criterion cannot be written, the requirement is ambiguous and must be rewritten."
            },
            nonFunctionalRequirements: {
                _self: "Define HOW the product should behave. Each uses a Requirement Shell with a measurable Fit Criterion.",
                lookAndFeel: "Appearance and style requirements. Fit Criterion example: 'Users rate the interface attractiveness >= 4/5 in usability testing.'",
                usabilityAndHumanity: "Ease of use, accessibility, learning curve. Fit Criterion example: 'A new user completes the primary task within 3 minutes without assistance.'",
                performance: "Speed, throughput, capacity, response times. Fit Criterion example: 'Response time for search queries < 200ms for 95th percentile under 1000 concurrent users.'",
                operationalAndEnvironmental: "Expected physical environment, OS, partner systems.",
                maintainabilityAndSupport: "How easy to change, fix, extend. Expected maintenance windows.",
                security: "Access control, data privacy, encryption standards, audit trails.",
                cultural: "Localization, language, currency, date format requirements.",
                legal: "Compliance with laws, regulations, standards (GDPR, HIPAA, etc.)."
            },
            projectIssues: {
                _self: "Track unresolved items, risks, and future considerations.",
                openIssues: "Unresolved questions requiring further input or decisions.",
                offTheShelfSolutions: "Existing solutions that could be used, bought, or adapted.",
                newProblems: "Problems the new product might introduce to the current environment.",
                tasks: "High-level effort required to deliver.",
                migration: "Steps to transition from the current system to the new product.",
                risks: "Most likely and most serious risks to the project. Include probability and impact.",
                costs: "Estimated cost to implement the requirements.",
                userDocumentationAndTraining: "Documentation and training deliverables.",
                waitingRoom: "Requirements not yet agreed or deferred to future releases.",
                ideasForSolutions: "Potential solution approaches noted during requirements gathering."
            }
        },

        skeleton: {
            projectDrivers: {
                purposeOfProject: { userProblem: "", measurableGoals: [] },
                stakeholders: { client: "", customer: "", users: [] }
            },
            projectConstraints: {
                mandatedConstraints: [{ description: "", rationale: "", fitCriterion: "" }],
                namingConventions: [],
                relevantFactsAndAssumptions: { facts: [], assumptions: [] }
            },
            functionalRequirements: {
                scopeOfWork: "",
                businessDataModel: [],
                scopeOfProduct: "",
                requirements: [
                    {
                        requirementId: "",
                        type: "functional",
                        description: "",
                        rationale: "",
                        fitCriterion: "",
                        priority: "",
                        dependencies: [],
                        conflicts: []
                    }
                ]
            },
            nonFunctionalRequirements: {
                lookAndFeel: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
                usabilityAndHumanity: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
                performance: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
                operationalAndEnvironmental: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
                maintainabilityAndSupport: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
                security: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
                cultural: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
                legal: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }]
            },
            projectIssues: {
                openIssues: [],
                offTheShelfSolutions: [],
                risks: [{ description: "", probability: "", impact: "" }],
                costs: "",
                waitingRoom: [],
                ideasForSolutions: []
            }
        },

        rules: {
            requirementPrefix: "The product shall",
            requiresQuantification: ["nonFunctionalRequirements"],
            forbiddenTerms: FORBIDDEN_TERMS
        }
    }
};

module.exports = { TEMPLATES, FORBIDDEN_TERMS };
