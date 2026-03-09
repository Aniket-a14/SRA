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
            "Introduction",
            "OverallDescription",
            "ExternalInterfaceRequirements",
            "SystemFeatures",
            "OtherNonfunctionalRequirements",
            "OtherRequirements",
            "Appendices"
        ],

        sectionInstructions: {
            Introduction: {
                _self: "This section should provide an overview of the entire SRS.",
                Purpose: "Identify the product whose software requirements are specified in this document, including the revision or release number. Describe the scope of the product that is covered by this SRS, particularly if this SRS describes only part of the system or a single subsystem.",
                DocumentConventions: "Describe any standards or typographical conventions that were followed when writing this SRS, such as fonts or highlighting that have special significance. For example, state whether priorities for higher-level requirements are assumed to be inherited by detailed requirements, or whether every requirement statement is to have its own priority.",
                IntendedAudienceAndReadingSuggestions: "Describe the different types of reader that the document is intended for, such as developers, project managers, marketing staff, users, testers, and documentation writers. Describe what the rest of this SRS contains and how it is organized. Suggest a sequence for reading the document, beginning with the overview sections and proceeding through the sections that are most pertinent to each reader type.",
                ProductScope: "Provide a short description of the software being specified and its purpose, including relevant benefits, objectives, and goals. Relate the software to corporate goals or business strategies. If a separate vision and scope document is available, refer to it rather than duplicating its contents here.",
                References: "List any other documents or Web addresses to which this SRS refers. These may include user interface style guides, contracts, standards, system requirements specifications, use case documents, or a vision and scope document. Provide enough information so that the reader could access a copy of each reference, including title, author, version number, date, and source or location."
            },
            OverallDescription: {
                _self: "This section should describe the general factors that affect the product and its requirements. It does not state specific requirements; instead it provides a background for those requirements.",
                ProductPerspective: "Describe the context and origin of the product being specified in this SRS. For example, state whether this product is a follow-on member of a product family, a replacement for certain existing systems, or a new, self-contained product. If the SRS defines a component of a larger system, relate the requirements of the larger system to the functionality of this software and identify interfaces between the two. A simple diagram that shows the major components of the overall system, subsystem interconnections, and external interfaces can be helpful.",
                ProductFunctions: "Summarize the major functions the product must perform or must let the user perform. Details will be provided in Section 3, so only a high level summary (such as a bullet list) is needed here. Organize the functions to make them understandable to any reader of the SRS. A picture of the major groups of related requirements and how they relate, such as a top level data flow diagram or object class diagram, is often effective.",
                UserClassesAndCharacteristics: "Identify the various user classes that you anticipate will use this product. User classes may be differentiated based on frequency of use, subset of product functions used, technical expertise, security or privilege levels, educational level, or experience. Describe the pertinent characteristics of each user class. Certain requirements may pertain only to certain user classes. Distinguish the most important user classes for this product from those who are less important to satisfy.",
                OperatingEnvironment: "Describe the environment in which the software will operate, including the hardware platform, operating system and versions, and any other software components or applications with which it must peacefully coexist.",
                DesignAndImplementationConstraints: "Describe any items or issues that will limit the options available to the developers. These might include: corporate or regulatory policies; hardware limitations (timing requirements, memory requirements); interfaces to other applications; specific technologies, tools, and databases to be used; parallel operations; language requirements; communications protocols; security considerations; design conventions or programming standards (for example, if the customer’s organization will be responsible for maintaining the delivered software).",
                UserDocumentation: "List the user documentation components (such as user manuals, on-line help, and tutorials) that will be delivered along with the software. Identify any known user documentation delivery formats or standards.",
                AssumptionsAndDependencies: "List any assumed factors (as opposed to known facts) that could affect the requirements stated in the SRS. These could include third-party or commercial components that you plan to use, issues around the development or operating environment, or constraints. The project could be affected if these assumptions are incorrect, are not shared, or change. Also identify any dependencies the project has on external factors, such as software components that you intend to reuse from another project, unless they are already documented elsewhere (for example, in the vision and scope document or the project plan)."
            },
            ExternalInterfaceRequirements: {
                _self: "This section of the SRS should contain all of the software requirements to a level of detail sufficient to enable designers to design a system to satisfy those requirements, and testers to test that the system satisfies those requirements. Throughout this section, every stated requirement should be externally perceivable by users, operators, or other external systems.",
                UserInterfaces: "Describe the logical characteristics of each interface between the software product and the users. This may include sample screen images, any GUI standards or product family style guides that are to be followed, screen layout constraints, standard buttons and functions (e.g., help) that will appear on every screen, keyboard shortcuts, error message display standards, and so on. Define the software components for which a user interface is needed. Details of the user interface design should be documented in a separate user interface specification.",
                HardwareInterfaces: "Describe the logical and physical characteristics of each interface between the software product and the hardware components of the system. This may include the supported device types, the nature of the data and control interactions between the software and the hardware, and communication protocols to be used.",
                SoftwareInterfaces: "Describe the connections between this product and other specific software components (name and version), including databases, operating systems, tools, libraries, and integrated commercial components. Identify the data items or messages coming into the system and going out and describe the purpose of each. Describe the services needed and the nature of communications. Refer to documents that describe detailed application programming interface protocols. Identify data that will be shared across software components. If the data sharing mechanism must be implemented in a specific way (for example, use of a global data area in a multitasking operating system), specify this as an implementation constraint.",
                CommunicationsInterfaces: "Describe the requirements associated with any communications functions required by this product, including e-mail, web browser, network server communications protocols, electronic forms, and so on. Define any pertinent message formatting. Identify any communication standards that will be used, such as FTP or HTTP. Specify any communication security or encryption issues, data transfer rates, and synchronization mechanisms."
            },
            SystemFeatures: {
                _self: "4. System Features: Organize the functional requirements for the product by system features, the major services provided by the product.",
                featureName: "Provide a short description of the feature and indicate whether it is of High, Medium, or Low priority. You could also include specific priority component ratings, such as benefit, penalty, cost, and risk (each rated on a relative scale from a low of 1 to a high of 9).",
                stimulusResponseSequences: "List the sequences of user actions and system responses that stimulate the behavior defined for this feature. These will correspond to the dialog elements associated with use cases.",
                functionalRequirements: "Itemize the detailed functional requirements associated with this feature. These are the software capabilities that must be present in order for the user to carry out the services provided by the feature, or to execute the use case. Include how the product should respond to anticipated error conditions or invalid inputs. Requirements should be concise, complete, unambiguous, verifiable, and necessary. Use 'TBD' as a placeholder to indicate when necessary information is not yet available. Each requirement should be uniquely identified (e.g., REQ-1, REQ-2)."
            },
            OtherNonfunctionalRequirements: {
                _self: "This section should specify all of the other nonfunctional requirements that are required by the product.",
                PerformanceRequirements: "Specify response times, throughput, and capacity constraints.",
                SafetyRequirements: "Requirements concerned with loss, damage, or harm safeguards.",
                SecurityRequirements: "User authentication, privacy, and data protection requirements.",
                SoftwareQualityAttributes: {
                    _self: "Specify availability, reliability, maintainability, etc.",
                    reliability: "The ability of a system or component to perform its required functions under stated conditions for a specified period of time.",
                    availability: "The degree to which a system or component is operational and accessible when required for use.",
                    security: "The degree to which a system or component protects information and data.",
                    maintainability: "The ease with which a product can be modified to correct defects or improve performance.",
                    portability: "The ease with which a product can be transferred from one hardware or software environment to another."
                },
                BusinessRules: "Operating principles about the product (e.g., role-based access)."
            },
            OtherRequirements: {
                _self: "Define any other requirements not covered elsewhere in the SRS. This might include database requirements, internationalization requirements, legal requirements, reuse objectives for the project, and so on. Add any new sections that are pertinent to the project."
            },
            Appendices: {
                _self: "The appendices are not always considered part of the actual SRS. They may include sample input/output formats, descriptions of cost analysis studies, results of user surveys, supporting or background information, a description of the problems to be solved by the software, special packaging instructions for the code and the media.",
                Glossary: "Define all the terms necessary to properly interpret the SRS, including acronyms and abbreviations. You may wish to build a separate glossary that spans multiple projects or the entire organization, and just include terms specific to a single project in each SRS.",
                AnalysisModels: "Include any analysis models created for the system, such as data flow diagrams, class diagrams, state-transition diagrams, or entity-relationship diagrams. Use Mermaid syntax.",
                ToBeDeterminedList: "Collect a numbered list of all TBD (to be determined) references in the SRS so they can be tracked to closure."
            }
        },

        skeleton: {
            Introduction: {
                Purpose: "",
                DocumentConventions: "",
                IntendedAudienceAndReadingSuggestions: "",
                ProductScope: "",
                References: []
            },
            OverallDescription: {
                ProductPerspective: "",
                ProductFunctions: [],
                UserClassesAndCharacteristics: [],
                OperatingEnvironment: "",
                DesignAndImplementationConstraints: [],
                UserDocumentation: [],
                AssumptionsAndDependencies: []
            },
            ExternalInterfaceRequirements: {
                UserInterfaces: "",
                HardwareInterfaces: "",
                SoftwareInterfaces: "",
                CommunicationsInterfaces: ""
            },
            SystemFeatures: [
                {
                    featureName: "",
                    stimulusResponseSequences: [],
                    functionalRequirements: []
                }
            ],
            OtherNonfunctionalRequirements: {
                PerformanceRequirements: [],
                SafetyRequirements: [],
                SecurityRequirements: [],
                SoftwareQualityAttributes: {
                    reliability: "",
                    availability: "",
                    security: "",
                    maintainability: "",
                    portability: ""
                },
                BusinessRules: []
            },
            OtherRequirements: [],
            Appendices: {
                Glossary: [],
                AnalysisModels: {
                    flowchartDiagram: { code: "", caption: "" },
                    sequenceDiagram: { code: "", caption: "" },
                    entityRelationshipDiagram: { code: "", caption: "" }
                },
                ToBeDeterminedList: []
            }
        },

        rules: {
            requirementPrefix: "The system shall",
            requiresQuantification: ["OtherNonfunctionalRequirements"],
            forbiddenTerms: FORBIDDEN_TERMS
        }
    },

    // ========================================================================
    // ISO/IEC/IEEE 29148:2018 — Modern Requirements Engineering
    // ========================================================================
    "ISO_29148_SRS": {
        name: "ISO/IEC/IEEE 29148:2011 (SRS)",
        description: "The international standard for Software Requirements Specification. Follows the exact structure from Section 9.5 and mandatory meta-content from 9.2.",

        systemPromptDirective: `You are a requirements engineer writing an ISO/IEC/IEEE 29148:2011 compliant Software Requirements Specification (SRS). You must follow the structure defined in Section 9.5 and the general items from 9.2. Focus on clear, verifiable requirements using the "The system shall" prefix. Ensure all external interfaces, functional units, and quality requirement (usability, performance, reliability) are addressed with measurable criteria.`,

        sections: [
            "Identification",
            "FrontMatter",
            "Definitions",
            "References",
            "AcronymsAndAbbreviations",
            "Purpose",
            "Scope",
            "ProductPerspective",
            "ProductFunctions",
            "UserCharacteristics",
            "Limitations",
            "AssumptionsAndDependencies",
            "ApportioningOfRequirements",
            "ExternalInterfaces",
            "Functions",
            "UsabilityRequirements",
            "PerformanceRequirements",
            "LogicalDatabaseRequirements",
            "DesignConstraints",
            "StandardsCompliance",
            "SoftwareSystemAttributes",
            "Verification",
            "SupportingInformation"
        ],

        sectionInstructions: {
            Identification: {
                _self: "9.2.1 Identification: Provide the title, date, version, issuing organization, and status of the document."
            },
            FrontMatter: {
                _self: "9.2.2 Front matter: Include a table of contents, list of figures, and list of tables."
            },
            Definitions: {
                _self: "9.2.3 Definitions: Define key terms and phrases used within the specification to ensure common understanding among stakeholders."
            },
            References: {
                _self: "9.2.4 References: List all external documents, standards, or related items referenced in this SRS."
            },
            AcronymsAndAbbreviations: {
                _self: "9.2.5 Acronyms and abbreviations: Provide an alphabetized list of all acronyms and their expansions."
            },
            Purpose: {
                _self: "9.5.1 Purpose: Describe the purpose of the software product and its intended use."
            },
            Scope: {
                _self: "9.5.2 Scope: Identify the software product(s) by name, explain what it will/will not do, and describe benefits and goals."
            },
            ProductPerspective: {
                _self: "9.5.3 Product perspective: Summary of context for the software product.",
                SystemInterfaces: "9.5.3.1 Interfaces with the system of which the software is a part.",
                UserInterfaces: "9.5.3.2 Logical characteristics of interfaces between the software and users.",
                HardwareInterfaces: "9.5.3.3 Interfaces between the software and hardware components.",
                SoftwareInterfaces: "9.5.3.4 Use of other required software products or systems.",
                CommunicationsInterfaces: "9.5.3.5 Logical characteristics of communication protocols.",
                MemoryConstraints: "9.5.3.6 Limits on primary and secondary memory.",
                Operations: "9.5.3.7 Normal and special operations required by the user.",
                SiteAdaptationRequirements: "9.5.3.8 Data or initialization sequences specific to a site."
            },
            ProductFunctions: {
                _self: "9.5.4 Product functions: A summary of the major functions the software will perform."
            },
            UserCharacteristics: {
                _self: "9.5.5 User characteristics: Types of users classified by function, experience, and expertise."
            },
            Limitations: {
                _self: "9.5.6 Limitations: Items that limit the developer's options."
            },
            AssumptionsAndDependencies: {
                _self: "9.5.7 Assumptions and dependencies: Factors that if changed, would affect the requirements."
            },
            ApportioningOfRequirements: {
                _self: "9.5.8 Apportioning of requirements: Requirements that may be delayed to future releases."
            },
            SpecificRequirements: {
                _self: "9.5.9 Specific requirements: Detailed requirements for the product; each must be uniquely identified."
            },
            ExternalInterfaces: {
                _self: "9.5.10 External interfaces: Detailed requirements for User, Hardware, Software, and Communication interfaces."
            },
            Functions: {
                _self: "9.5.11 Functions: Detailed functional requirements. For each function in the array, specify:",
                purpose: "The goal or intent of the function.",
                inputs: "A list of data items or signals entering the function.",
                operations: "Precise description of the processing logic performed.",
                outputs: "A list of data items or signals resulting from the function."
            },
            UsabilityRequirements: {
                _self: "9.5.12 Usability requirements: Measurable effectiveness, efficiency, and satisfaction targets."
            },
            PerformanceRequirements: {
                _self: "9.5.13 Performance requirements: Static and dynamic numerical requirements (e.g., users, volume, transaction rates)."
            },
            LogicalDatabaseRequirements: {
                _self: "9.5.14 Logical database requirements: Requirements for database entities, relationships, and integrity constraints."
            },
            DesignConstraints: {
                _self: "9.5.15 Design constraints: Constraints imposed by other standards, hardware limits, or regulations."
            },
            StandardsCompliance: {
                _self: "9.5.16 Standards compliance: Identification of specific standards the software must meet."
            },
            SoftwareSystemAttributes: {
                _self: "9.5.17 Software system attributes: Required attributes such as reliability, availability, security, and maintainability."
            },
            Verification: {
                _self: "9.5.18 Verification: Verification criteria and methods for each requirement."
            },
            SupportingInformation: {
                _self: "9.5.19 Supporting information: Sample input/output forms, cost studies, or additional analysis."
            }
        },

        skeleton: {
            Identification: {
                Title: "",
                Date: "",
                Version: "",
                IssuingOrganization: "",
                Status: ""
            },
            FrontMatter: {
                TableOfContents: true,
                ListOfFigures: true,
                ListOfTables: true
            },
            Definitions: [],
            References: [],
            AcronymsAndAbbreviations: [],
            Purpose: "",
            Scope: "",
            ProductPerspective: {
                SystemInterfaces: "",
                UserInterfaces: "",
                HardwareInterfaces: "",
                SoftwareInterfaces: "",
                CommunicationsInterfaces: "",
                MemoryConstraints: "",
                Operations: "",
                SiteAdaptationRequirements: ""
            },
            ProductFunctions: [],
            UserCharacteristics: [],
            Limitations: [],
            AssumptionsAndDependencies: [],
            ApportioningOfRequirements: [],
            SpecificRequirements: [],
            ExternalInterfaces: {
                UserInterfaces: "",
                HardwareInterfaces: "",
                SoftwareInterfaces: "",
                CommunicationsInterfaces: ""
            },
            Functions: [
                {
                    purpose: "",
                    inputs: [],
                    operations: "",
                    outputs: []
                }
            ],
            UsabilityRequirements: [],
            PerformanceRequirements: [],
            LogicalDatabaseRequirements: [],
            DesignConstraints: [],
            StandardsCompliance: [],
            SoftwareSystemAttributes: {
                reliability: "",
                availability: "",
                security: "",
                maintainability: ""
            },
            Verification: [],
            SupportingInformation: []
        },

        rules: {
            requirementPrefix: "The system shall",
            requiresQuantification: ["PerformanceRequirements", "UsabilityRequirements"],
            forbiddenTerms: FORBIDDEN_TERMS
        }
    },

    "ISO_29148_StRS": {
        name: "ISO/IEC/IEEE 29148:2011 (StRS)",
        description: "Stakeholder Requirements Specification (StRS). Focuses on business needs and stakeholder expectations (Section 9.3).",

        systemPromptDirective: `You are a business analyst writing an ISO/IEC/IEEE 29148:2011 compliant Stakeholder Requirements Specification (StRS). Focus on high-level business goals, stakeholder needs, and operational concepts. Use the general header from 9.2 and the detailed stakeholder sections from 9.3. Requirements should reflect value to the business and stakeholders.`,

        sections: [
            "Identification", "FrontMatter", "Definitions", "References", "AcronymsAndAbbreviations",
            "BusinessPurpose", "BusinessScope", "BusinessOverview", "Stakeholders", "BusinessEnvironment",
            "GoalAndObjective", "BusinessModel", "InformationEnvironment", "BusinessProcesses",
            "OperationalPolicies", "OperationalConstraints", "OperationModes", "OperationalQuality",
            "BusinessStructure", "UserRequirements", "OperationalConcept", "OperationalScenarios",
            "ProjectConstraints"
        ],

        sectionInstructions: {
            Identification: { _self: "9.2.1 Identification: Document title, date, version, etc." },
            FrontMatter: { _self: "9.2.2 Front matter: TOC, List of Figures/Tables." },
            Definitions: { _self: "9.2.3 Definitions: Key terms." },
            References: { _self: "9.2.4 References: Supporting docs." },
            AcronymsAndAbbreviations: { _self: "9.2.5 Acronyms: Expansions." },
            BusinessPurpose: { _self: "9.3.1 Business purpose: Why the project exists." },
            BusinessScope: { _self: "9.3.2 Business scope: Boundaries of the business case." },
            BusinessOverview: { _self: "9.3.3 Business overview: Summary of the business landscape." },
            Stakeholders: { _self: "9.3.4 Stakeholders: List and describe stakeholders and their interests." },
            BusinessEnvironment: { _self: "9.3.5 Business environment: External factors affecting the business." },
            GoalAndObjective: { _self: "9.3.6 Goal and Objective: High-level aims." },
            BusinessModel: { _self: "9.3.7 Business model: How value is created/delivered." },
            InformationEnvironment: { _self: "9.3.8 Information environment: Data and info exchange context." },
            BusinessProcesses: { _self: "9.3.9 Business processes: Key workflows and activities." },
            OperationalPolicies: { _self: "9.3.10 Business operational policies and rules." },
            OperationalConstraints: { _self: "9.3.11 Business operational constraints." },
            OperationModes: { _self: "9.3.12 Business operation modes (Normal, Emergency, etc.)." },
            OperationalQuality: { _self: "9.3.13 Business operational quality objectives." },
            BusinessStructure: { _self: "9.3.14 Business structure: Organizational hierarchy involved." },
            UserRequirements: { _self: "9.3.15 User requirements: Specific needs of human users." },
            OperationalConcept: { _self: "9.3.16 Operational concept: How the system fits in the business." },
            OperationalScenarios: { _self: "9.3.17 Operational scenarios: Narratives of system use." },
            ProjectConstraints: { _self: "9.3.18 Project constraints: Budget, schedule, resources." }
        },

        skeleton: {
            Identification: { Title: "", Date: "", Version: "", IssuingOrganization: "", Status: "" },
            FrontMatter: { TableOfContents: true },
            Definitions: [], References: [], AcronymsAndAbbreviations: [],
            BusinessPurpose: "", BusinessScope: "", BusinessOverview: "",
            Stakeholders: [], BusinessEnvironment: "", GoalAndObjective: "",
            BusinessModel: "", InformationEnvironment: "", BusinessProcesses: [],
            OperationalPolicies: [], OperationalConstraints: [], OperationModes: [],
            OperationalQuality: "", BusinessStructure: "", UserRequirements: [],
            OperationalConcept: "", OperationalScenarios: [], ProjectConstraints: []
        },

        rules: {
            requirementPrefix: "Stakeholder needs",
            requiresQuantification: ["OperationalQuality"],
            forbiddenTerms: FORBIDDEN_TERMS
        }
    },

    "ISO_29148_SyRS": {
        name: "ISO/IEC/IEEE 29148:2011 (SyRS)",
        description: "System Requirements Specification (SyRS). For complex systems where software is one component (Section 9.4).",

        systemPromptDirective: `You are a systems engineer writing an ISO/IEC/IEEE 29148:2011 compliant System Requirements Specification (SyRS). You must address the multi-disciplinary aspects of the system (hardware, software, humans). Follow the Section 9.4 structure.`,

        sections: [
            "Identification", "FrontMatter", "Definitions", "References", "AcronymsAndAbbreviations",
            "SystemPurpose", "SystemScope", "SystemOverview", "FunctionalRequirements",
            "UsabilityRequirements", "PerformanceRequirements", "SystemInterfaces",
            "SystemOperations", "ModesAndStates", "PhysicalCharacteristics",
            "EnvironmentalConditions", "SystemSecurity", "InformationManagement",
            "PoliciesAndRegulations", "LifeCycleSustainment", "PackagingHandling",
            "Verification", "AssumptionsAndDependencies"
        ],

        sectionInstructions: {
            Identification: { _self: "9.2.1 Identification: Document metadata." },
            FrontMatter: { _self: "9.2.2 Front matter." },
            Definitions: { _self: "9.2.3 Definitions." },
            References: { _self: "9.2.4 References." },
            AcronymsAndAbbreviations: { _self: "9.2.5 Acronyms." },
            SystemPurpose: { _self: "9.4.1 System purpose: High-level system goals." },
            SystemScope: { _self: "9.4.2 System scope: Boundaries of the entire system." },
            SystemOverview: { _self: "9.4.3 System overview: Architecture/context summary." },
            FunctionalRequirements: { _self: "9.4.4 Functional requirements: System-level functions." },
            UsabilityRequirements: { _self: "9.4.5 Usability: Effectiveness and satisfaction." },
            PerformanceRequirements: { _self: "9.4.6 Performance: Numerical/dynamic constraints." },
            SystemInterfaces: { _self: "9.4.7 System interfaces: Internal and external sys interfaces." },
            SystemOperations: { _self: "9.4.8 System Operations: User and admin operations." },
            ModesAndStates: { _self: "9.4.9 System modes and states." },
            PhysicalCharacteristics: { _self: "9.4.10 Physical characteristics: Size, weight, form factor." },
            EnvironmentalConditions: { _self: "9.4.11 Environmental conditions: Temp, humidity, etc." },
            SystemSecurity: { _self: "9.4.12 System security: Assets protection, access control." },
            InformationManagement: { _self: "9.4.13 Information management: Data logging, storage, archival." },
            PoliciesAndRegulations: { _self: "9.4.14 Policies and regulations: Legal, governing standards." },
            LifeCycleSustainment: { _self: "9.4.15 System life cycle sustainment: Maintenance, EOL." },
            PackagingHandling: { _self: "9.4.16 Packaging, handling, shipping and transportation." },
            Verification: { _self: "9.4.17 Verification: Test/Inspect/Analyze methods." },
            AssumptionsAndDependencies: { _self: "9.4.18 Assumptions and dependencies." }
        },

        skeleton: {
            Identification: { Title: "", Date: "", Version: "", IssuingOrganization: "" },
            FrontMatter: {}, Definitions: [], References: [], AcronymsAndAbbreviations: [],
            SystemPurpose: "", SystemScope: "", SystemOverview: "",
            FunctionalRequirements: [], UsabilityRequirements: [], PerformanceRequirements: [],
            SystemInterfaces: [], SystemOperations: [], ModesAndStates: [],
            PhysicalCharacteristics: "", EnvironmentalConditions: "", SystemSecurity: "",
            InformationManagement: "", PoliciesAndRegulations: [], LifeCycleSustainment: "",
            PackagingHandling: "", Verification: [], AssumptionsAndDependencies: []
        },

        rules: {
            requirementPrefix: "The system shall",
            requiresQuantification: ["PerformanceRequirements", "UsabilityRequirements"],
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
        name: "Volere Requirements Template (Edition 16)",
        description: "The definitive Robertson & Robertson template for requirements engineering. 27 discrete sections providing a complete framework for project drivers, constraints, functional/non-functional requirements, and project issues.",

        systemPromptDirective: `You are a requirements analyst specializing in the Volere methodology (Edition 16) by James and Suzanne Robertson. Every atomic requirement MUST be written using the Volere Requirement Shell format. This shell is mandatory for all functional and non-functional requirements. 

Key Shell Components:
1. Requirement #: Unique ID.
2. Description: One sentence statement of the intention.
3. Rationale: Justification for why the requirement exists.
4. Fit Criterion: A measurable, testable measurement of success. If you cannot write a Fit Criterion, the requirement is too vague.
5. Customer Satisfaction/Dissatisfaction: Scale of 1 to 5.

Focus on the distinction between the Scope of the Work (business) and the Scope of the Product (software). Ensure traceability to stakeholders and business goals.`,

        sections: [
            "Section1_PurposeOfProject",
            "Section2_Stakeholders",
            "Section3_MandatedConstraints",
            "Section4_NamingConventions",
            "Section5_FactsAndAssumptions",
            "Section6_ScopeOfWork",
            "Section7_BusinessDataModel",
            "Section8_ScopeOfProduct",
            "Section9_FunctionalRequirements",
            "Section10_LookAndFeel",
            "Section11_Usability",
            "Section12_Performance",
            "Section13_Operational",
            "Section14_Maintainability",
            "Section15_Security",
            "Section16_Cultural",
            "Section17_Legal",
            "Section18_OpenIssues",
            "Section19_OffTheShelf",
            "Section20_NewProblems",
            "Section21_Tasks",
            "Section22_Migration",
            "Section23_Risks",
            "Section24_Costs",
            "Section25_Documentation",
            "Section26_WaitingRoom",
            "Section27_IdeasForSolutions"
        ],

        sectionInstructions: {
            Section1_PurposeOfProject: "1. The Purpose of the Project: Describe the user business problem or background of the project effort. State the measurable, quantified goals of the project.",
            Section2_Stakeholders: "2. The Stakeholders: Identify the Client (who pays), Customer (who decides), and Hands-on Users. Include personas and other interested parties.",
            Section3_MandatedConstraints: "3. Mandated Constraints: Describe solution restrictions, environmental constraints, partner systems, and budget/schedule limits.",
            Section4_NamingConventions: "4. Naming Conventions and Terminology: Project glossary defining all terms, acronyms, and abbreviations used by stakeholders.",
            Section5_FactsAndAssumptions: "5. Relevant Facts and Assumptions: External factors influencing the product and developer assumptions.",
            Section6_ScopeOfWork: "6. The Scope of the Work: Define the business area context. Include a Context Diagram and Work Partitioning table (Business Events and Data Flows).",
            Section7_BusinessDataModel: "7. Business Data Model & Data Dictionary: Specify essential business objects (ERD) and define each data element formally.",
            Section8_ScopeOfProduct: "8. The Scope of the Product: Define the software boundaries using a Product Use Case Diagram and Use Case Table.",
            Section9_FunctionalRequirements: "9. Functional Requirements: List each capability using the Atomic Requirement Shell: {requirementId, description, rationale, fitCriterion, originator, customerSatisfaction, customerDissatisfaction, priority, conflicts, history}.",
            Section10_LookAndFeel: "10. Look and Feel Requirements: Appearance, style, and branding metrics.",
            Section11_Usability: "11. Usability and Humanity Requirements: Ease of use, learning, accessibility, and personalization.",
            Section12_Performance: "12. Performance Requirements: Speed, safety, reliability, availability, and capacity.",
            Section13_Operational: "13. Operational and Environmental Requirements: Physical environment and interface constraints.",
            Section14_Maintainability: "14. Maintainability and Support Requirements: Ease of change and support levels.",
            Section15_Security: "15. Security Requirements: Access control, data integrity, privacy, and audit requirements.",
            Section16_Cultural: "16. Cultural Requirements: Cultural suitability and behavioral expectations.",
            Section17_Legal: "17. Legal Requirements: Compliance with laws, standards, and IP rights.",
            Section18_OpenIssues: "18. Open Issues: Unresolved requirements gathering questions.",
            Section19_OffTheShelf: "19. Off-the-Shelf Solutions: Ready-made software or reusable components to be used.",
            Section20_NewProblems: "20. New Problems: Potential side effects or problems introducted by the new product.",
            Section21_Tasks: "21. Tasks: High-level development and implementation steps.",
            Section22_Migration: "22. Migration to the New Product: Data translation and cut-over requirements.",
            Section23_Risks: "23. Risks: Assessment of project risks with probability and impact.",
            Section24_Costs: "24. Costs: Monetary and time estimates.",
            Section25_Documentation: "25. User Documentation and Training: Required manuals and training deliverables.",
            Section26_WaitingRoom: "26. Waiting Room: Requirements postponed to future releases.",
            Section27_IdeasForSolutions: "27. Ideas for Solutions: Design or implementation ideas that are not requirements."
        },

        skeleton: {
            Section1_PurposeOfProject: { businessProblem: "", background: "", measurableGoals: [] },
            Section2_Stakeholders: { client: "", customer: "", users: [], otherInterestedParties: [] },
            Section3_MandatedConstraints: { solutionConstraints: [], environmentalConstraints: [], budgetSchedule: "" },
            Section4_NamingConventions: [],
            Section5_FactsAndAssumptions: { facts: [], assumptions: [] },
            Section6_ScopeOfWork: { contextDiagram: "", workPartitioning: [] },
            Section7_BusinessDataModel: { erd: "", dataDictionary: [] },
            Section8_ScopeOfProduct: { useCaseDiagram: "", productUseCases: [] },
            Section9_FunctionalRequirements: [
                {
                    requirementId: "",
                    type: "Functional",
                    description: "",
                    rationale: "",
                    originator: "",
                    fitCriterion: "",
                    customerSatisfaction: 3,
                    customerDissatisfaction: 3,
                    priority: "",
                    conflicts: [],
                    history: ""
                }
            ],
            Section10_LookAndFeel: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
            Section11_Usability: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
            Section12_Performance: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
            Section13_Operational: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
            Section14_Maintainability: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
            Section15_Security: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
            Section16_Cultural: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
            Section17_Legal: [{ requirementId: "", description: "", fitCriterion: "", priority: "" }],
            Section18_OpenIssues: [],
            Section19_OffTheShelf: [],
            Section20_NewProblems: [],
            Section21_Tasks: [],
            Section22_Migration: "",
            Section23_Risks: [{ description: "", probability: "", impact: "", contingency: "" }],
            Section24_Costs: "",
            Section25_Documentation: [],
            Section26_WaitingRoom: [],
            Section27_IdeasForSolutions: []
        },

        rules: {
            requirementPrefix: "The product shall",
            requiresQuantification: [
                "Section10_LookAndFeel",
                "Section11_Usability",
                "Section12_Performance",
                "Section13_Operational",
                "Section14_Maintainability",
                "Section15_Security",
                "Section16_Cultural",
                "Section17_Legal"
            ],
            forbiddenTerms: FORBIDDEN_TERMS
        }
    }
};

module.exports = { TEMPLATES, FORBIDDEN_TERMS };
