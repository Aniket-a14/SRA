/**
 * SRA-PRO FEW-SHOT EXAMPLES
 * 
 * One GOOD and one BAD example per template type.
 * Used by the prompt factory to inject into the system prompt.
 * 
 * Purpose: Show the model exactly what quality output looks like
 * vs. what to avoid. This is the single highest-impact prompt
 * engineering technique for structured output quality.
 * 
 * Each example is kept minimal (one requirement) to avoid
 * consuming too many tokens in the system prompt.
 */

const FEW_SHOT_EXAMPLES = {

    // ====================================================================
    // IEEE 830 (Wiegers)
    // ====================================================================
    "IEEE_830": {
        good: {
            label: "GOOD EXAMPLE — SystemFeatures (correct format):",
            content: [
                {
                    featureName: "Real-Time Inventory Tracking",
                    descriptionAndPriority: "High priority. The system provides continuous, real-time tracking of all warehouse items using RFID sensor integration. Benefit: 9, Penalty: 8, Cost: 5, Risk: 4.",
                    stimulusResponseSequences: [
                        "Stimulus: RFID reader detects an item tag within its 10-meter range.",
                        "Response: The system shall log the item ID, location, and timestamp within 200ms.",
                        "Stimulus: Detected item location is within a restricted geo-fence zone.",
                        "Response: The system shall trigger a high-priority alert to the shift supervisor's dashboard within 500ms.",
                        "Stimulus: Dashboard operator requests a location update for a specific item ID.",
                        "Response: The system shall highlight the item's current position on the warehouse floor map."
                    ],
                    functionalRequirements: [
                        "REQ-INV-001: The system shall update the inventory database within 200ms of receiving an RFID scan event.",
                        "REQ-INV-002: The system shall support a minimum of 10,000 simultaneous RFID tag readings per second.",
                        "REQ-INV-003: The system shall maintain inventory accuracy of 99.9% or higher, measured monthly.",
                        "REQ-INV-004: The system shall generate an alert within 500ms when an item enters a geo-fenced restricted zone."
                    ]
                }
            ]
        },
        bad: {
            label: "BAD EXAMPLE — DO NOT generate output like this:",
            content: [
                {
                    featureName: "Tracking",
                    descriptionAndPriority: "This feature tracks items. It is important.",
                    stimulusResponseSequences: [],
                    functionalRequirements: [
                        "The system should be able to track items efficiently.",
                        "The system should be fast and reliable.",
                        "Make sure the system is user-friendly."
                    ]
                }
            ],
            issues: [
                "Missing array wrapper [] for the list of features",
                "featureName too vague — must be descriptive",
                "No priority rating (High/Medium/Low or benefit/penalty/cost/risk)",
                "Empty stimulusResponseSequences",
                "Uses 'should' instead of 'shall'",
                "Requirements are not quantified — 'fast', 'reliable', 'user-friendly' are forbidden terms",
                "No requirement IDs (REQ-XXX)"
            ]
        }
    },

    // ====================================================================
    // ISO 29148 SRS
    // ====================================================================
    "ISO_29148_SRS": {
        good: {
            label: "GOOD EXAMPLE — Functions (correct format per §9.5.11):",
            content: [
                {
                    purpose: "Authenticate users via multi-factor authentication before granting system access.",
                    inputs: [
                        "Username (string, 3-64 characters, alphanumeric)",
                        "Password (string, minimum 12 characters, must include uppercase, lowercase, digit, and special character)",
                        "TOTP code (6-digit numeric, 30-second validity window)"
                    ],
                    operations: "The system shall validate the username/password pair against the credential store using bcrypt (cost factor 12). Upon password match, the system shall verify the TOTP code against the user's registered secret. The system shall lock the account after 5 consecutive failed attempts for a duration of 15 minutes.",
                    outputs: [
                        "Authentication token (JWT, RS256, 1-hour expiry)",
                        "Session record (user ID, IP address, timestamp, device fingerprint)",
                        "Audit log entry (success/failure, attempt count, source IP)"
                    ]
                }
            ]
        },
        bad: {
            label: "BAD EXAMPLE — DO NOT generate output like this:",
            content: {
                purpose: "Handle login",
                inputs: ["credentials"],
                operations: "Check if user is valid and let them in.",
                outputs: ["access granted"]
            },
            issues: [
                "Missing array wrapper [] for the list of functions",
                "Purpose too vague — 'Handle login' does not describe the function",
                "Inputs not specified (data types, formats, constraints missing)",
                "Operations have no algorithmic detail, no error handling",
                "Outputs not structured (no token format, no audit trail)"
            ]
        }
    },

    // ====================================================================
    // ISO 29148 StRS
    // ====================================================================
    "ISO_29148_StRS": {
        good: {
            label: "GOOD EXAMPLE — BusinessPurpose (correct format per §9.3.1):",
            content: "The organization currently processes 5,000 patient records per day using a paper-based system that results in an average 12% error rate in prescription transcription. The proposed system aims to digitize the entire patient intake workflow, reducing transcription errors to below 0.1% and decreasing average patient wait time from 45 minutes to under 15 minutes. The expected annual cost savings from reduced errors and improved throughput is $2.4M."
        },
        bad: {
            label: "BAD EXAMPLE — DO NOT generate output like this:",
            content: "We need a better system because the current one is old and inefficient. The new system will be modern and improve things.",
            issues: [
                "No quantified metrics (no error rates, no time savings, no cost figures)",
                "Uses forbidden vague terms: 'efficient', 'modern'",
                "No measurable goals — cannot verify project success"
            ]
        }
    },

    // ====================================================================
    // ISO 29148 SyRS
    // ====================================================================
    "ISO_29148_SyRS": {
        good: {
            label: "GOOD EXAMPLE — PerformanceRequirements (correct format per §9.4.6):",
            content: [
                "SYSREQ-PERF-001: The system shall process a minimum of 10,000 sensor data points per second with end-to-end latency not exceeding 50ms (measured from sensor input to actuator output).",
                "SYSREQ-PERF-002: The system shall support 500 concurrent operator sessions while maintaining dashboard refresh rates of at least 2Hz.",
                "SYSREQ-PERF-003: The system shall complete a full system state backup within 30 seconds for datasets up to 500GB."
            ]
        },
        bad: {
            label: "BAD EXAMPLE — DO NOT generate output like this:",
            content: [
                "The system should be fast.",
                "The system should handle many users.",
                "Backups should be quick."
            ],
            issues: [
                "No requirement IDs",
                "No quantified metrics",
                "Uses 'should' instead of 'shall'",
                "Forbidden terms: 'fast', 'quick'"
            ]
        }
    },

    // ====================================================================
    // Agile User Stories
    // ====================================================================
    "AGILE_USER_STORIES": {
        good: {
            label: "GOOD EXAMPLE — featureBacklog (correct hierarchy):",
            content: [
                {
                    epic: "User Authentication",
                    userStories: [
                        {
                            story: "As a returning customer, I want to log in using my fingerprint so that I can access my account without remembering a password.",
                            acceptanceCriteria: [
                                {
                                    given: "the user has previously enrolled their fingerprint on the device",
                                    when: "the user places their registered finger on the biometric sensor",
                                    then: "the system authenticates the user within 2 seconds and displays the account dashboard"
                                },
                                {
                                    given: "the user attempts fingerprint login with an unregistered finger",
                                    when: "the biometric scan fails 3 consecutive times",
                                    then: "the system locks biometric login for 5 minutes and prompts for password-based authentication"
                                }
                            ],
                            priority: "High"
                        }
                    ]
                }
            ]
        },
        bad: {
            label: "BAD EXAMPLE — DO NOT generate output like this:",
            content: {
                epic: "Login",
                userStories: [
                    {
                        story: "Users should be able to log in easily.",
                        acceptanceCriteria: [],
                        priority: ""
                    }
                ]
            },
            issues: [
                "Missing top-level array [] for the backlog",
                "Does not follow Connextra format ('As a [role], I want [goal] so that [benefit]')",
                "Uses forbidden term 'easily'",
                "Empty acceptance criteria — must use Given/When/Then",
                "No priority set"
            ]
        }
    },

    // ====================================================================
    // Volere Edition 16 (27 Sections)
    // ====================================================================
    "VOLERE": {
        // Volere is complex, so we provide different examples based on the section type
        Section1_PurposeOfProject: {
            good: {
                label: "GOOD EXAMPLE (Section 1 — Purpose):",
                content: {
                    businessProblem: "The current manual inventory system leads to a 15% stock-out rate during peak seasons.",
                    background: "The warehouse handles 50k items across 3 sites.",
                    measurableGoals: [
                        "Reduce stock-out rate to < 2% within 6 months.",
                        "Decrease average picking time by 25%."
                    ]
                }
            }
        },
        Section9_FunctionalRequirements: {
            good: {
                label: "GOOD EXAMPLE (Section 9 — Functional Requirement Shell):",
                content: [
                    {
                        requirementId: "FR-012",
                        type: "Functional",
                        description: "The product shall generate a monthly compliance report for all carbon credit transactions.",
                        rationale: "Regulatory requirement under EU ETS Article 14.",
                        originator: "Chief Compliance Officer",
                        fitCriterion: "Report generated within 60s, 100% coverage, XML schema compliant.",
                        customerSatisfaction: 5,
                        customerDissatisfaction: 5,
                        priority: "High",
                        conflicts: [],
                        history: "Created 2024-01-15"
                    }
                ]
            }
        },
        // Generic shell for all NFRs (Section 10-17)
        NFR_Shell: {
            good: {
                label: "GOOD EXAMPLE (Non-Functional Requirement Shell):",
                content: [
                    {
                        requirementId: "NFR-101",
                        description: "The product shall be available for use 24/7.",
                        fitCriterion: "The system shall exhibit 99.9% uptime, excluding scheduled maintenance windows.",
                        priority: "High"
                    }
                ]
            }
        },
        Default: {
            bad: {
                label: "BAD EXAMPLE — DO NOT generate output like this:",
                content: {
                    requirementId: "",
                    description: "Make it good.",
                    fitCriterion: ""
                },
                issues: [
                    "Missing ID",
                    "Description is a vague forbidden term",
                    "Missing fitCriterion (cannot be measured/tested)"
                ]
            }
        }
    }
};

/**
 * Formats few-shot examples for injection into the system prompt.
 * Returns a string block ready to append.
 * 
 * @param {string} templateId - Template identifier
 * @param {string} sectionId - (Optional) Current section ID for adaptive examples
 * @returns {string} Formatted few-shot block or empty string
 */
function getFewShotBlock(templateId, sectionId) {
    if (templateId === 'VOLERE') {
        const volereExamples = FEW_SHOT_EXAMPLES.VOLERE;
        let example = volereExamples.Default;

        if (sectionId === 'Section1_PurposeOfProject') {
            example = { ...example, good: volereExamples.Section1_PurposeOfProject.good };
        } else if (sectionId === 'Section9_FunctionalRequirements') {
            example = { ...example, good: volereExamples.Section9_FunctionalRequirements.good };
        } else if (sectionId && sectionId.startsWith('Section')) {
            const match = sectionId.match(/\d+/);
            const sectionNum = match ? parseInt(match[0]) : 0;
            // Sections 10-17 are NFRs, but we can extend the shell example to 9-21 (Requirements/Tasks)
            if (sectionNum >= 10 && sectionNum <= 21) {
                example = { ...example, good: volereExamples.NFR_Shell.good };
            } else {
                // Fallback to Section 9 for unknown sections
                example = { ...example, good: volereExamples.Section9_FunctionalRequirements.good };
            }
        } else {
            // Default to Section 9 for anything else
            example = { ...example, good: volereExamples.Section9_FunctionalRequirements.good };
        }

        const goodStr = JSON.stringify(example.good.content, null, 2);
        const badStr = JSON.stringify(example.bad.content, null, 2);
        const issuesList = example.bad.issues.map((issue, i) => `  ${i + 1}. ${issue}`).join('\n');

        return `

FEW-SHOT EXAMPLES (study these before generating):

${example.good.label}
${goodStr}

${example.bad.label}
${badStr}
Issues with the bad example:
${issuesList}

Use the GOOD example as your quality standard. Avoid all patterns shown in the BAD example.`;
    }

    const examples = FEW_SHOT_EXAMPLES[templateId];
    if (!examples) return '';

    const goodStr = JSON.stringify(examples.good.content, null, 2);
    const badStr = JSON.stringify(examples.bad.content, null, 2);
    const issuesList = examples.bad.issues.map((issue, i) => `  ${i + 1}. ${issue}`).join('\n');

    return `

FEW-SHOT EXAMPLES (study these before generating):

${examples.good.label}
${goodStr}

${examples.bad.label}
${badStr}
Issues with the bad example:
${issuesList}

Use the GOOD example as your quality standard. Avoid all patterns shown in the BAD example.`;
}

module.exports = { FEW_SHOT_EXAMPLES, getFewShotBlock };
