const fs = require('fs');

const record = {
    source: '2001 - npac.doc',
    srs_json: {
        projectTitle: 'Number Portability Administration Center Service Management System (NPAC SMS)',
        revisionHistory: [
            { version: '3.0.23', date: '2001-03-19', description: 'NANC FRS Version 3.0.23 incorporating National Number Pooling, EDR support, and documentation corrections.', author: 'North American Numbering Council (NANC)' },
            { version: '3.0.0', date: '2000-02-04', description: 'Major release adding National Number Pooling as replacement for Midwest Region Number Pooling.', author: 'NANC' },
            { version: '2.0.0', date: '1998-12-01', description: 'Release 2.0 with service bureau support and wireless portability enhancements.', author: 'NANC' },
            { version: '1.0', date: '1997-04-07', description: 'Initial NANC version adapted from ICC Subcommittee FRS v1.1.5.', author: 'NANC / Illinois Commerce Commission' }
        ],
        introduction: {
            purpose: 'This document defines the functional requirements specification (FRS) for the Number Portability Administration Center Service Management System (NPAC SMS), enabling Local Number Portability (LNP) for Service Providers. It establishes the baseline end-user functional requirements including provisioning, disconnect, repair, conflict resolution, disaster recovery, order cancellation, audit, report, and data management capabilities. The NPAC SMS serves as the central clearinghouse for all ported telephone number information, managing the database of routing data required to effect the porting of telephone numbers between Service Providers across North American regions.',
            documentConventions: 'Requirements use a structured naming convention: the first character denotes type (A=assumption, C=constraint, R=requirement). The second character indicates origin: N=narrative portion of the RFP, X=added upon award, R=identified during post-award requirements analysis. The keyword "shall" indicates mandatory requirements that must be demonstrated during design review and acceptance testing; "is", "will", and "should" indicate guidance or preference. All time references in SOA/LSMS messages and reports are in GMT; NPAC Administrative Interface uses local time; system tunables use Central Time.',
            intendedAudience: 'This document is intended for NPAC operations personnel, LNP Service Providers (both wireline and wireless), NPAC SMS system developers and vendors, regulatory bodies including the North American Numbering Council (NANC) and the LNPA Working Group, and telecommunications engineers implementing Local Number Portability. The detailed requirements serve architects designing SOA and LSMS interfaces, operations teams managing porting workflows, and compliance officers verifying adherence to FCC mandates.',
            productScope: 'The NPAC SMS is a hardware and software platform containing the database of information required to effect the porting of telephone numbers. It receives customer information from old and new Service Providers including the Location Routing Number (LRN), validates received information, downloads new routing information upon activation, maintains records of all ported numbers and transaction history, provides audit functionality, and transmits LNP routing information to Service Providers to maintain synchronization. The system supports National Number Pooling via NPA-NXX-X (1K Block) management with Efficient Data Representation (EDR) for compatible LSMSs. Scope excludes real-time call processing, SP-to-SP interactions, customer authorization verification, and SP internal network operations.',
            references: [
                'NPAC SMS Interoperable Interface Specification (IIS), Version 3.0.2, December 4, 2000',
                'Illinois Commerce Commission NPAC/SMS Request for Proposal (ICC NPAC/SMS RFP), February 6, 1996',
                'Generic Requirements for SCP Application and GTT Function for Number Portability, ICC LNP Workshop',
                'Generic Switching and Signaling Requirements for Number Portability, v1.03, September 4, 1996',
                'FCC 96-286 First Report And Order, CC Docket No. 95-116, July 2, 1996',
                'CTIA Report on Wireless Portability Version 2, July 7, 1998',
                'Report on Local Number Portability, Industry Numbering Committee (INC)'
            ]
        },
        overallDescription: {
            productPerspective: 'The NPAC SMS operates as a centralized clearinghouse within the North American telecommunications infrastructure for Local Number Portability. It interfaces with Service Provider systems through two primary electronic interfaces: the SOA (Service Order Administration) to NPAC SMS Interface for order management and notifications, and the NPAC SMS to Local SMS Interface for routing data distribution to Service Provider network elements. Additional interfaces include the NPAC Administrative GUI (OpGUI) for NPAC operations personnel, the NPAC SOA Low-tech Interface for manual Service Provider operations, a Web bulletin board for network data publication, and FTP sites for bulk data downloads. The system supports OSI protocol stack communications with CMIP-based messaging, NTP clock synchronization to Stratum 1 hosts, and both primary and backup/disaster recovery configurations.',
            productFunctions: [
                'Provisioning Service: Manages the end-to-end lifecycle of porting a telephone number including subscription version creation, concurrence validation between old and new Service Providers, activation with real-time routing data broadcast to all Local SMSs, and failure/retry handling.',
                'Disconnect Service: Processes disconnection of ported numbers with support for immediate and deferred (effective release date) disconnection, broadcasting delete actions to all Local SMSs with tunable retry parameters.',
                'Repair Service: Supports audit-based troubleshooting and subscription data resynchronization via broadcast of correct routing data to affected Service Provider networks.',
                'Conflict Resolution: Manages disputes between Service Providers with configurable conflict expiration windows (default 30 calendar days), conflict restriction windows, and automated cancellation upon timer expiration.',
                'Disaster Recovery and Backup: Provides planned and unplanned failover to backup NPAC with Service Provider notification, cutover quiet periods, and bidirectional reconnection procedures maintaining identical database state.',
                'Order Cancellation: Handles cancel-pending workflows with concurrence requirements from both Service Providers, tunable acknowledgment windows, and automatic status transitions upon timer expiration.',
                'Audit Administration: Provides on-demand audits of LSMS data against NPAC SMS data, random database integrity sampling, audit discrepancy reporting, and automatic LSMS correction for detected discrepancies.',
                'Report Generation: Supports pre-defined and ad-hoc report generation with distribution to electronic files, local/remote printers, e-mail, and FAX machines.',
                'National Number Pooling: Manages NPA-NXX-X (1K Block) allocation and lifecycle including NPA-NXX-X Holder Information, Block Holder Information with EDR, automated block completeness verification, and cascading delete operations for de-pooling.',
                'NPA Split Processing: Handles NPA splits with permissive dialing periods, automatic NPA-NXX-X creation, subscription version migration to new NPA, and coordinated block data conversion.'
            ],
            userClassesAndCharacteristics: [
                { userClass: 'NPAC Operations Personnel', characteristics: 'Authorized staff operating the NPAC Administrative Interface (OpGUI). Full access to create/modify/delete NPA-NXX, LRN, NPA-NXX-X, and Service Provider data. Can initiate mass updates, manage NPA splits, schedule block creation events, resend failed broadcasts, run reports, and perform data administration.' },
                { userClass: 'New Service Provider (SOA)', characteristics: 'Telecommunications carrier gaining a ported number. Initiates subscription version creation, provides routing data (LRN, DPC/SSN values), sends activation requests, and receives conflict/status notifications via SOA to NPAC SMS Interface.' },
                { userClass: 'Old Service Provider (SOA)', characteristics: 'Telecommunications carrier losing a ported number. Can concur or deny porting authorization, initiate conflict status (one time only), and receive all status change notifications. Cannot activate subscription versions.' },
                { userClass: 'Current Service Provider (SOA)', characteristics: 'The Service Provider currently serving the ported number. Can initiate disconnects, modify active subscription version routing data, and request audits.' },
                { userClass: 'Block Holder Service Provider', characteristics: 'Service Provider assigned a 1K number pool block. Can create blocks via SOA interface (SOA Origination=TRUE), modify active block routing data, and receive block status notifications.' },
                { userClass: 'Local SMS (LSMS)', characteristics: 'Service Provider network element receiving routing data downloads. Supports either EDR mode (receives Block objects) or non-EDR mode (receives individual Subscription Versions). Responds to audit queries and receives bulk data downloads.' },
                { userClass: 'NPAC SMS Administrator', characteristics: 'System administrator responsible for managing tunable parameters, user access control, security administration, and system configuration.' }
            ],
            operatingEnvironment: 'The NPAC SMS operates as a high-availability telecommunications platform with primary and backup/disaster recovery configurations. Uses OSI 7-layer protocol stack with CMIP for machine-to-machine interface communications. Supports NTP clock synchronization to Stratum 1 hosts, GMT-based timestamps, and Central Time for system tunables. FTP sites provide bulk data download capabilities. Must maintain 99.5% minimum availability with no more than 8 hours downtime per month.',
            designAndImplementationConstraints: [
                'C1-1: The NPAC SMS is not involved in real time call processing.',
                'C1-2: The NPAC SMS is not involved in facilitating or tracking Service Provider-to-Service Provider activities.',
                'CN2-1: Service Provider interactions, customer authorization processes, and mechanisms for obtaining porting consent are beyond NPAC SMS scope.',
                'RR3-3: Pipe characters (|) are prohibited in all text string inputs.',
                'OSI 7-layer protocol stack required for SOA and LSMS electronic interfaces.',
                'All timestamps must use Greenwich Mean Time (GMT) for SOA/LSMS messages and reports.',
                'Service Provider IDs must be 4-character alphanumeric codes from a proper source.',
                'NTP synchronization to Stratum 1 host is mandatory for system clock accuracy.',
                'CMIP request retry mechanism with configurable x-by-y parameters.'
            ],
            userDocumentation: [
                'NPAC SMS Functional Requirements Specification (FRS) Version 3.0.23 - This document.',
                'NPAC SMS Interoperable Interface Specification (IIS) Version 3.0.2.',
                'System Tunables Reference (Appendix C) - Lists all configurable parameters with default values.'
            ],
            assumptionsAndDependencies: [
                'A1-1: Service Providers will be billed proportionally to their usage of NPAC SMS services.',
                'AR1-1: All NPAC Customers will obtain a unique Service Provider ID from a proper source.',
                'AR3-1: Time references are in GMT for SOA/LSMS messages and reports.',
                'AN3-4.1: The service provider responsible for an NPA split communicates split information to the NPAC.',
                'AR6-1: A range activate will contain an average of 20 TNs.',
                'AR6-2: 20% of all downloads will be processed via range activations.',
                'A8-1: NPAC SMS will process audit requests from Service Providers immediately.',
                'AR10-1: NPAC-initiated downtime does not include downtime needed for software release updates.'
            ]
        },
        externalInterfaceRequirements: {
            userInterfaces: 'Three user-facing interfaces: (1) NPAC Administrative Interface (OpGUI) - GUI for NPAC operations personnel managing all system aspects. (2) NPAC SOA Low-tech Interface - manual access for Service Provider personnel. (3) Web Bulletin Board - publishes NPA-NXX, LRN, NPA-NXX-X, and Service Provider information.',
            hardwareInterfaces: 'Primary and backup/disaster recovery hardware configurations. 4mm DAT tape drives for off-line batch downloads. FTP server infrastructure with SP-specific subdirectories. NTP Stratum 1 host for system clock synchronization.',
            softwareInterfaces: 'SOA to NPAC SMS Interface - bidirectional machine-to-machine using OSI/CMIP for subscription management, network data, block management, audit, and notification recovery. NPAC SMS to Local SMS Interface - distributing routing data downloads, SV broadcasts, block broadcasts, network data updates, and audit queries.',
            communicationsInterfaces: 'OSI 7-layer protocol stack with NSAP (12 bytes), TSAP (4 bytes), SSAP (4 bytes), and PSAP (4 bytes) addressing. Internet addresses for Web interface. Configurable retry mechanisms (x-by-y pattern) for failed broadcasts. Message queuing during Service Provider downtime periods.'
        },
        systemFeatures: [
            {
                name: 'Subscription Version Lifecycle Management',
                description: 'Complete lifecycle management of ported telephone numbers through 10 distinct status states (Pending, Conflict, Active, Sending, Failed, Partial Failure, Disconnect Pending, Old, Canceled, Cancel Pending) with automated state transitions driven by tunable timers, Service Provider actions, and broadcast results.',
                stimulusResponseSequences: [
                    'New SP creates SV -> NPAC validates data -> Creates pending version -> Notifies old SP for concurrence.',
                    'Both SPs concur, New SP activates -> NPAC sets to Sending, broadcasts to all LSMSs -> Sets to Active/Partial Failure/Failed based on responses.',
                    'Current SP disconnects -> Immediate or deferred (effective release date) broadcast of delete -> Sets to Old.'
                ],
                functionalRequirements: [
                    'R5-1.1: SV instances have one status at any time from the set of 10 defined statuses.',
                    'RN5-1: Only one pending/cancel-pending/conflict/disconnect-pending/failed/partial-failure SV per subscription.',
                    'RN5-2: Only one active Subscription Version per subscription.',
                    'R5-18.1 through R5-18.10: Field-level validation for all subscription data upon creation.',
                    'R5-21.1: Long and short Initial Concurrence Window tunables (default 9 and 1 business hours).',
                    'R5-23.1: Long and short Final Concurrence Window tunables (default 9 and 1 business hours).',
                    'R5-45.1: Conflict Expiration Window tunable (default 30 calendar days).',
                    'R5-2.1: Old Subscription Retention tunable (default 18 calendar months).',
                    'R5-5: Individual SVs created for TN range requests.',
                    'R5-6: All subscription administration transactions logged with comprehensive event details.'
                ]
            },
            {
                name: 'National Number Pooling (NPA-NXX-X Block Management)',
                description: 'Manages 1000-number (1K) block allocation using NPA-NXX-X Holder Information and Block Holder Information. Supports EDR for compatible LSMSs receiving Block objects, and individual SV broadcasts for non-EDR LSMSs. Includes automated block completeness verification, cascading delete for de-pooling, and synchronized status management.',
                stimulusResponseSequences: [
                    'NPAC creates NPA-NXX-X -> Validates NPA-NXX, effective date, duplicates, pending SVs -> Stores and broadcasts.',
                    'Block creation triggered -> Validates effective date, pending SVs, routing data -> Creates Block as Sending -> Broadcasts to EDR and non-EDR LSMSs -> Status per response matrix.',
                    'NPA-NXX-X deletion -> Cascading delete: SV deletes to non-EDR, Block deletes to EDR -> Updates all to Old -> Deletes NPA-NXX-X.'
                ],
                functionalRequirements: [
                    'RR3-52 through RR3-60: NPA-NXX-X and EDR indicator management per SP.',
                    'RR3-61 through RR3-74: NPA-NXX-X Holder Information CRUD with validation.',
                    'RR3-119 through RR3-143: Block Holder operations, status/FSL synchronization.',
                    'RR3-137.1 through RR3-138.2: Status synchronization matrices for Block/SV coordination.',
                    'RR3-144 through RR3-153: Block creation with SOA origination, broadcast, status updates.',
                    'RR3-169 through RR3-179: Block deletion as part of cascading de-pool.',
                    'RR3-183 through RR3-184: Default routing restoration for disconnected pooled numbers.'
                ]
            },
            {
                name: 'NPA Split Processing',
                description: 'Manages NPA splits with permissive dialing periods. Automatically updates SVs, NPA-NXX-X holder information, and block data during the split lifecycle.',
                stimulusResponseSequences: [
                    'NPAC enters NPA Split data -> Validates NPA-NXX existence, effective dates, ownership -> Stores split.',
                    'PDP begins -> Updates all SVs to new NPA, creates old SV copies, creates new NPA-NXX-X, converts blocks.',
                    'PDP ends -> Removes old NPA-NXX mapping, deletes old NPA-NXX-X, removes split info.'
                ],
                functionalRequirements: [
                    'RN3-1 through RN3-2: Support permissive dialing accepting both old and new NPAs.',
                    'RN3-4.1 through RN3-4.37: Comprehensive NPA Split validation and exception processing.',
                    'RR3-31 through RR3-40: NPA-NXX-X Holder NPA Split operations.',
                    'RR3-41 through RR3-51.2: Block Holder NPA Split operations.',
                    'RR3-218: SV broadcasts use new NPA-NXX during permissive dialing.',
                    'RR3-219: Automatic deletion of old NPA-NXX at end of permissive dialing.'
                ]
            },
            {
                name: 'Service Provider Data Administration',
                description: 'Manages SP records lifecycle: creation with unique SPID validation, modification by authorized parties, deletion with dependency checks, and query capabilities. Supports associated SP relationships.',
                stimulusResponseSequences: [
                    'NPAC creates SP -> Checks duplicate SPID -> Collects data -> Validates -> Creates record.',
                    'SP or NPAC modifies data -> Validates permissions -> Revalidates -> Updates -> Broadcasts name changes.',
                    'NPAC deletes SP -> Checks SV/LRN/NPA-NXX/NPA-NXX-X dependencies -> Archives to history -> Notifies.'
                ],
                functionalRequirements: [
                    'R4-1 through R4-5.2: CRUD operations for Service Providers.',
                    'R4-6 through R4-11: Creation with duplicate detection and validation.',
                    'R4-13 through R4-17: Modification with restrictions by user type.',
                    'R4-20 through R4-22.3: Deletion with dependency checking and archival.',
                    'RR4-1 through RR4-8: Removal dependencies and duplicate validation.',
                    'RR3-16 through RR3-29: Multiple SPID per SOA association support.'
                ]
            },
            {
                name: 'Audit Administration',
                description: 'Three audit mechanisms: on-demand SP-initiated audits, database extract comparisons, and random database integrity sampling. Supports automatic LSMS discrepancy correction.',
                stimulusResponseSequences: [
                    'SP requests audit -> NPAC queries targeted LSMSs -> Compares data -> Corrects discrepancies -> Reports results.',
                    'Scheduled integrity sampling -> Selects random active SVs -> Compares -> Reports and corrects discrepancies.'
                ],
                functionalRequirements: [
                    'R8-1 through R8-8: Audit request processing and capabilities.',
                    'Audit discrepancy reporting to requesting SOA.',
                    'Database integrity sampling with random SV selection.',
                    'Number Pool environment audit accommodation.'
                ]
            },
            {
                name: 'Security and Access Control',
                description: 'Comprehensive security: identification, authentication with password requirements, role-based access control, data integrity, audit trail with intrusion detection, continuity of service, OSI security compliance, and encryption key exchange.',
                stimulusResponseSequences: [
                    'User access -> Identify -> Authenticate -> Check permissions -> Grant/deny with audit logging.',
                    'Security event -> Generate audit entry -> Intrusion detection analysis -> Security monitoring reports.'
                ],
                functionalRequirements: [
                    'R7-1 through R7-3.1: Identification and authentication.',
                    'R7-4.1 through R7-4.2: System and resource-level access control.',
                    'R7-5: Data and system integrity protection.',
                    'R7-6.1 through R7-6.2: Audit log generation with intrusion detection.',
                    'R7-7: Continuity of service requirements.',
                    'R7-9: OSI Security Environment including encryption, authentication, integrity, non-repudiation, access control, and key exchange.'
                ]
            },
            {
                name: 'Report Generation and Distribution',
                description: 'Pre-defined and ad-hoc reports with multi-destination distribution. Includes specialized reports for NPA splits, pending-like SVs, and block operations.',
                stimulusResponseSequences: [
                    'User requests report -> System generates per format -> Distributes to destinations (file, printer, email, fax).',
                    'System generates NPA Split Current/Pending and History reports.'
                ],
                functionalRequirements: [
                    'R9-1 through R9-3: Report request, generation, and delivery.',
                    'R9-3.1: National Number Pooling specific reports.',
                    'RR9-11 through RR9-18: Pending-like SV reports for number pooling.',
                    'RN3-4.31 and RN3-4.32: NPA Split reports.'
                ]
            },
            {
                name: 'Interface Recovery and Resynchronization',
                description: 'Recovery mechanisms for missed messages during SP downtime. Supports network data, subscription data (LSMS only), and notification recovery with tunable time range validation.',
                stimulusResponseSequences: [
                    'SP re-associates in recovery mode -> Requests recovery for time range -> NPAC validates and sends data -> New messages queued -> SP signals recovery complete -> Queued messages delivered.',
                    'CMIP request fails -> Retry x times at y-minute intervals -> If failed, notify NPAC personnel.'
                ],
                functionalRequirements: [
                    'R6-4.1 through R6-4.4: Protocol requirements and interface performance.',
                    'R6-6: CMIP request retry with configurable x-by-y mechanism.',
                    'R6-7: Notification recovery with criteria size validation.',
                    'R6-8: Network data recovery with time range validation.',
                    'R6-9: Subscription data recovery for LSMS.',
                    'Recovery mode suspends retry counter during SP recovery.'
                ]
            },
            {
                name: 'Bulk Data Download and Database Extracts',
                description: 'Complete dataset recovery via file downloads. Supports subscription, network, NPA-NXX-X, and block data with configurable selection criteria and automated FTP distribution.',
                stimulusResponseSequences: [
                    'NPAC requests bulk download -> Selects data type and SP filter -> System generates files per Appendix E -> Places in SP FTP subdirectory.',
                    'NPAC requests Block download -> Selects Active/PF or Latest View -> Specifies time/block range -> Generates sorted file -> FTP distribution.'
                ],
                functionalRequirements: [
                    'R3-8: Off-line batch download via 4mm DAT tape and FTP.',
                    'R3-14 through R3-17: Periodic database extracts to ASCII files on FTP site.',
                    'RR3-220 through RR3-227: Bulk data download creation with naming conventions and criteria.',
                    'RR3-198 through RR3-207: Block bulk data download with Active/Latest-View selection.'
                ]
            },
            {
                name: 'Performance, Reliability, and Billing',
                description: 'System availability, capacity, performance requirements, and usage recording for proportional SP billing.',
                stimulusResponseSequences: [
                    'System monitors availability -> Alerts for downtime exceedances -> Planned downtime requires 24-hour advance notification.',
                    'System records per-SP usage -> Generates billing data for proportional cost allocation.'
                ],
                functionalRequirements: [
                    'R10-1 through R10-4: Availability (99.5% min), reliability, capacity, and performance.',
                    'R10-5: Planned downtime with notification requirements.',
                    'R11-1 through R11-2: Usage recording for proportional billing.',
                    'A1-2: Resource accounting must not degrade basic system performance.'
                ]
            }
        ],
        nonFunctionalRequirements: {
            performanceRequirements: [
                'System must maintain 99.5% minimum availability with no more than 8 hours downtime per month.',
                'Planned downtime requires 24-hour advance notification to all Service Providers.',
                'CMIP request retry mechanism with configurable retry count and interval parameters.',
                'Range activations contain an average of 20 TNs with 20% of downloads via range activations.',
                'Resource accounting must not degrade basic system performance.',
                'NTP synchronization to Stratum 1 host for accurate system clock.',
                'Must support simultaneous associations with multiple SP SOA and LSMS systems.'
            ],
            safetyRequirements: [
                'Disaster recovery must maintain identical application version and database state between primary and backup.',
                'Cutover quiet periods enforced during primary-to-backup and backup-to-primary transitions.',
                'Off-line batch downloads via 4mm DAT tape for Local SMS disaster recovery.',
                'Automated daily Block completeness verification for 1K number pooling blocks.'
            ],
            securityRequirements: [
                'Role-based access control with system-level and resource-level permissions.',
                'Password authentication with configurable requirements.',
                'OSI security mechanisms: encryption, authentication, data origin authentication, integrity, non-repudiation, access control, audit trail, and key exchange.',
                'Audit log generation for all security-relevant events.',
                'Intrusion detection and reporting capabilities.',
                'Encryption key exchange protocol (Appendix D).',
                'Transaction logging of all subscription administration activities.'
            ],
            softwareQualityAttributes: [
                'Reliability: Primary and backup configurations with automated failover.',
                'Availability: Minimum 99.5% uptime with planned downtime windows.',
                'Recoverability: Network, subscription, and notification recovery mechanisms.',
                'Configurability: Over 50 system tunables (Appendix C).',
                'Auditability: Comprehensive audit trail and database integrity sampling.',
                'Backward Compatibility: Support for both EDR and non-EDR LSMSs and release migration (Appendix H).'
            ],
            businessRules: [
                'Only one pending/cancel-pending/conflict/disconnect-pending/failed/partial-failure SV per TN.',
                'Old SP can place SV into conflict only one time.',
                'Conflict Restriction Window prevents Old SP conflict after tunable time when Final Concurrence Timer expired.',
                'Timer type selection uses longer timer when SP types mismatch.',
                'Business hours selection uses shorter hours when SP settings mismatch.',
                'SPs can only modify their own Service Provider data.',
                'NPA-NXX and LRN deletions prohibited if active SVs or NPA-NXX-X info exists.',
                'Pipe characters (|) prohibited in all text string inputs.'
            ]
        },
        otherRequirements: [
            'GNU General Public License (GPL) on all documentation and derivatives.',
            'Release migration from NPAC SMS Release 2.0 to 3.0 requires conversion of pre-EDR pooled data to EDR format (Appendix H).',
            'System tunables encompass six categories: Subscriptions, Communications, Audits, Logs, Keys, and Blocks.'
        ],
        glossary: [
            { term: 'NPAC SMS', definition: 'Number Portability Administration Center Service Management System - centralized platform managing ported telephone number routing information for LNP.' },
            { term: 'LNP', definition: 'Local Number Portability - ability of subscribers to retain telephone numbers when switching between service providers.' },
            { term: 'LRN', definition: 'Location Routing Number - 10-digit identifier for the switch on which portable NPA-NXXs or Number Pool Blocks reside.' },
            { term: 'SOA', definition: 'Service Order Administration - Service Provider system interfacing with NPAC SMS for subscription version operations and notifications.' },
            { term: 'LSMS', definition: 'Local Service Management System - SP network element receiving routing data downloads from NPAC SMS.' },
            { term: 'NPA-NXX', definition: 'Numbering Plan Area (3-digit area code) and Central Office Code (3-digit exchange) - first 6 digits of a North American telephone number.' },
            { term: 'NPA-NXX-X', definition: '7-digit code representing a 1K Block (1000 telephone numbers) for number pooling allocation.' },
            { term: 'EDR', definition: 'Efficient Data Representation - capability allowing LSMS to receive Block objects instead of individual SVs for pooled numbers.' },
            { term: 'GTT', definition: 'Global Title Translation - SS7 signaling mechanism for routing calls to ported numbers via DPC and SSN values.' },
            { term: 'DPC', definition: 'Destination Point Code - 9-digit SS7 signaling point identifier used in GTT routing for CLASS, LIDB, CNAM, ISVM, and WSMSC.' },
            { term: 'CMIP', definition: 'Common Management Information Protocol - OSI protocol for machine-to-machine communications between NPAC SMS and SP systems.' },
            { term: 'PDP', definition: 'Permissive Dialing Period - time window during NPA split when both old and new area codes are accepted.' },
            { term: 'SPID', definition: 'Service Provider Identifier - 4-character alphanumeric code uniquely identifying an NPAC Customer.' },
            { term: 'Block Holder', definition: 'Service Provider assigned a 1K Number Pool Block by the Pooling Administrator, responsible for default routing of pooled numbers.' },
            { term: 'Code Holder', definition: 'Service Provider owning the NPA-NXX code, responsible for vacant number treatment and default routing.' }
        ],
        appendices: {
            analysisModels: {
                flowchartDiagram: {
                    syntaxExplanation: 'High-level NPAC SMS provisioning process from SV creation through activation and broadcast.',
                    code: 'flowchart TD\n    A["Service Providers Exchange Notifications"] --> B["NPAC SMS Receives Create SV Request"]\n    B --> C{"Validate Data & Check NPA-NXX/LRN/SPID"}\n    C -->|Valid| D["Create Pending Subscription Version"]\n    C -->|Invalid| E["Return Error to Originator"]\n    D --> F{"Concurrence from Both SPs?"}\n    F -->|Yes| G["Await Due Date & Activation Request"]\n    F -->|Timeout| H["Send Missing Notification Request"]\n    H --> I{"Response Received?"}\n    I -->|Old SP Missing| J["Allow New SP to Activate After T2"]\n    I -->|New SP Missing| K["Cancel SV, Notify Both SPs"]\n    G --> L["New SP Sends Activation"]\n    L --> M{"Due Date Reached?"}\n    M -->|Yes| N["Set Status to Sending"]\n    M -->|No| O["Reject Activation"]\n    N --> P["Broadcast to All Local SMSs"]\n    P --> Q{"All LSMSs Acknowledge?"}\n    Q -->|All Success| R["Set Status to Active"]\n    Q -->|Some Fail| S["Set Status to Partial Failure"]\n    Q -->|All Fail| T["Set Status to Failed"]',
                    caption: 'NPAC SMS Provisioning Service Process Flow'
                },
                sequenceDiagram: {
                    syntaxExplanation: 'Inter-service provider port activation flow between New SP SOA, NPAC SMS, Old SP SOA, and LSMSs.',
                    code: 'sequenceDiagram\n    participant NewSP as New Service Provider SOA\n    participant NPAC as NPAC SMS\n    participant OldSP as Old Service Provider SOA\n    participant LSMS as Local SMS Systems\n    NewSP->>NPAC: Create SV (TN, LRN, DPC/SSN, Due Date)\n    NPAC->>NPAC: Validate Data, Create Pending SV\n    NPAC->>OldSP: Notification - SV Pending\n    Note over NPAC: Initial Concurrence Window Starts\n    OldSP->>NPAC: Create SV (Authorization=True)\n    NPAC->>NewSP: SV Pending (Concurred)\n    NewSP->>NPAC: Activate SV\n    NPAC->>NPAC: Set Status to Sending\n    par Broadcast to all LSMSs\n        NPAC->>LSMS: Create/Activate SV (Routing Data)\n        LSMS-->>NPAC: Acknowledge Success/Failure\n    end\n    alt All LSMSs Success\n        NPAC->>NPAC: Set Status to Active\n    else Some LSMSs Fail\n        NPAC->>NPAC: Set Status to Partial Failure\n    end\n    NPAC->>NewSP: Status Change Notification\n    NPAC->>OldSP: Status Change Notification',
                    caption: 'NPAC SMS Inter-Service Provider Port Activation Sequence'
                },
                entityRelationshipDiagram: {
                    syntaxExplanation: 'Core data entities in the NPAC SMS and their relationships.',
                    code: 'erDiagram\n    NPAC_CUSTOMER ||--o{ NPA_NXX : owns\n    NPAC_CUSTOMER ||--o{ LRN : owns\n    NPAC_CUSTOMER ||--o{ NPA_NXX_X_HOLDER : holds\n    NPA_NXX ||--o{ SUBSCRIPTION_VERSION : contains\n    NPA_NXX ||--o{ NPA_NXX_X_HOLDER : parent\n    NPA_NXX_X_HOLDER ||--o| BLOCK_HOLDER : activates\n    LRN ||--o{ SUBSCRIPTION_VERSION : routes\n    LRN ||--o{ BLOCK_HOLDER : routes\n    NPAC_CUSTOMER {\n        string SPID PK\n        string Name\n        boolean SOA_NPA_NXX_X_Indicator\n        boolean LSMS_NPA_NXX_X_Indicator\n        boolean LSMS_EDR_Indicator\n    }\n    SUBSCRIPTION_VERSION {\n        int Version_ID PK\n        string TN\n        string LRN FK\n        enum Status\n        enum LNP_Type\n    }\n    BLOCK_HOLDER {\n        int Block_ID PK\n        string NPA_NXX_X\n        string LRN FK\n        enum Status\n    }',
                    caption: 'NPAC SMS Entity Relationship Model'
                }
            },
            tbdList: [
                'Detailed capacity thresholds for concurrent associations per deployment region.',
                'Billing rate calculations and usage metric definitions.',
                'Web bulletin board access control and update frequency policies.',
                'LERG integration procedures with the Pooling Administrator.'
            ]
        },
        promptSettingsUsed: {
            profile: 'default',
            depth: 5,
            strictness: 1
        }
    }
};

const line = JSON.stringify(record);
fs.appendFileSync('golden_training_dataset.jsonl', '\n' + line);
console.log('Appended doc 15 (npac.doc). Record size:', line.length, 'bytes');
const totalLines = fs.readFileSync('golden_training_dataset.jsonl', 'utf8').trim().split('\n').length;
console.log('Total records in dataset:', totalLines);
