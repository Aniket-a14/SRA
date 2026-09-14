// System Requirements Specification: Golden Title
// Standard: ISO/IEC/IEEE 29148:2018 (ISO29148)
// Generated with SRA (Smart Requirements Analyzer)

#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2.5cm),
  header: context {
    if counter(page).get().first() > 1 [
      #text(size: 8pt, fill: rgb("#64748b"), italic: true)[Golden Title --- ISO/IEC/IEEE 29148:2018]
      #h(1fr)
      #text(size: 8pt, fill: rgb("#64748b"), weight: "bold")[ISO29148]
    ]
  },
  footer: context {
    if counter(page).get().first() > 1 [
      #text(size: 8pt, fill: rgb("#64748b"))[CONFIDENTIAL]
      #h(1fr)
      #text(size: 8pt, fill: rgb("#64748b"))[Page #counter(page).display()]
    ]
  }
)
#set text(font: "Liberation Sans", size: 10pt, fill: rgb("#0f172a"))
#set par(justify: true, leading: 0.7em)

#let requirement(id, title, body, rationale: none, fit: none, verification: none) = {
  block(
    width: 100%,
    fill: rgb("#f8fafc"),
    stroke: (left: 3pt + rgb("#6366f1"), rest: 0.5pt + rgb("#e2e8f0")),
    radius: (right: 4pt),
    inset: (x: 10pt, y: 8pt),
    spacing: 10pt,
    [
      #text(size: 9pt, weight: "bold", fill: rgb("#4f46e5"))[#id]
      #h(6pt)
      #text(weight: "bold")[#title]
      #v(4pt)
      #body
      #if rationale != none or fit != none or verification != none [
        #v(4pt)
        #line(length: 100%, stroke: 0.5pt + rgb("#e2e8f0"))
        #text(size: 8.5pt, fill: rgb("#475569"))[
          #if rationale != none [*Rationale:* #rationale \ ]
          #if fit != none [*Fit Criterion:* #fit \ ]
          #if verification != none [*Verification:* #verification]
        ]
      ]
    ]
  )
}

// --- COVER PAGE ---
#align(center + horizon)[
  #text(size: 24pt, weight: "bold")[Golden Title]
  #v(8pt)
  #text(size: 14pt, fill: rgb("#475569"))[System/Software Requirements Specification]
  #v(20pt)
  #line(length: 60%, stroke: 1pt + rgb("#cbd5e1"))
  #v(10pt)
  #text(size: 11pt, weight: "medium")[*Standard:* ISO/IEC/IEEE 29148:2018 (ISO29148) --- *Version:* 1.0.0]
  #v(10pt)
  #line(length: 60%, stroke: 1pt + rgb("#cbd5e1"))
  #v(30pt)
  #block(width: 80%, fill: rgb("#f1f5f9"), radius: 4pt, inset: 12pt)[
    #align(left)[
      #text(weight: "bold")[Executive Brief:] \
      This formal specification establishes the engineering and verification baseline for *Golden Title* according to the *ISO/IEC/IEEE 29148:2018* standard.
    ]
  ]
  #v(50pt)
  #text(size: 10pt, fill: rgb("#64748b"))[Prepared with *SRA (Smart Requirements Analyzer)*] \
  #text(size: 10pt, fill: rgb("#64748b"))[September 14, 2026]
]
#pagebreak()

#outline(title: "Table of Contents", indent: auto)
#pagebreak()

= Introduction
== Purpose
Collect and analyze vehicle telemetry in real time.

== Scope
Covers ingestion, storage, and dashboarding.

== Product Perspective
A cloud-native streaming pipeline.

== Product Functions
- Ingest telemetry
- Detect anomalies

== User Characteristics
#table(
  columns: (1fr, 2fr),
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else { none },
  [*Class / Role*], [*Characteristics & Responsibilities*],
  [Fleet Operator], [Monitors live vehicle status.],
)

== Limitations and Constraints
- Must run within existing AWS account.

== Assumptions and Dependencies
_None specified._

= References
- ISO/IEC/IEEE 29148:2018

= External Interfaces
== User Interfaces
Web dashboard.

== Hardware Interfaces
OBD-II telemetry units.

== Software Interfaces
Kafka ingestion topic.

== Communications Interfaces
MQTT over TLS.

= System Functions
== Anomaly Detection
Flags telemetry outside expected ranges.

#requirement("SF-1", "Anomaly Detection", [The system shall flag readings 3 standard deviations from the rolling mean.], rationale: none, fit: none, verification: "Analysis")

= Software System Attributes
== Performance Requirements
- Process 10k events/sec sustained.

== Security
- mTLS between all internal services.

== Safety
_None specified._

== Software Quality Attributes
_None specified._

== Business Rules
_None specified._

= Verification
Verified via load testing and anomaly-injection drills.

= Appendix A: Definitions
#table(
  columns: (1fr, 2fr),
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else { none },
  [*Term / Acronym*], [*Definition*],
  [*OBD-II*], [On-board diagnostics standard.],
)

= Appendix B: Analysis Models
// Architecture diagrams embedded in export bundle
