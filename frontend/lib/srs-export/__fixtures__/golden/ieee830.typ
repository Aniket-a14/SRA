// System Requirements Specification: Golden Title
// Standard: IEEE 830-1998 (IEEE830)
// Generated with SRA (Smart Requirements Analyzer)

#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2.5cm),
  header: context {
    if counter(page).get().first() > 1 [
      #text(size: 8pt, fill: rgb("#64748b"), italic: true)[Golden Title --- IEEE 830-1998]
      #h(1fr)
      #text(size: 8pt, fill: rgb("#64748b"), weight: "bold")[IEEE830]
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
  #text(size: 14pt, fill: rgb("#475569"))[Software Requirements Specification]
  #v(20pt)
  #line(length: 60%, stroke: 1pt + rgb("#cbd5e1"))
  #v(10pt)
  #text(size: 11pt, weight: "medium")[*Standard:* IEEE 830-1998 (IEEE830) --- *Version:* 1.0.0]
  #v(10pt)
  #line(length: 60%, stroke: 1pt + rgb("#cbd5e1"))
  #v(30pt)
  #block(width: 80%, fill: rgb("#f1f5f9"), radius: 4pt, inset: 12pt)[
    #align(left)[
      #text(weight: "bold")[Executive Brief:] \
      This formal specification establishes the engineering and verification baseline for *Golden Title* according to the *IEEE 830-1998* standard.
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
Provide a secure payment processing infrastructure.

== Document Conventions
IEEE 830-1998 standard conventions.

== Intended Audience and Reading Suggestions
Engineering, QA, and compliance stakeholders.

== Product Scope
_None specified._

== References
- IEEE Std 830-1998
- PCI DSS v4.0

= Overall Description
== Product Perspective
A standalone payment microservice.

== Product Functions
- Authorize card
- Capture funds
- Issue refund

== User Classes and Characteristics
#table(
  columns: (1fr, 2fr),
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else { none },
  [*Class / Role*], [*Characteristics & Responsibilities*],
  [Merchant Admin], [Configures payment methods.],
  [Support Agent], [Investigates failed transactions.],
)

== Operating Environment
_None specified._

== Design and Implementation Constraints
_None specified._

== User Documentation
- API reference

== Assumptions and Dependencies
- Assumes a reachable card network gateway.

= External Interface Requirements
== User Interfaces
None — this is a backend service.

== Hardware Interfaces
_None specified._

== Software Interfaces
REST API over HTTPS.

== Communications Interfaces
TLS 1.3.

= System Features
== Credit Card Processing
Processes Visa and Mastercard transactions.

=== Stimulus-Response Sequences
- User submits card details
- System returns authorization result

#requirement("GT-FR-1.1", "Functional Requirement", [The system shall validate the 16-digit card number using the Luhn algorithm.])
#requirement("FR-CUSTOM-1", "Credit Card Processing", [The system shall verify CVV with the card issuing network.], rationale: "Reduces card-not-present fraud.", fit: "99.9% of invalid CVVs rejected in under 500ms.", verification: "Test")

== Empty Feature
= Other Nonfunctional Requirements
== Performance Requirements
- 95th percentile latency under 200ms.

== Safety Requirements
_None specified._

== Security Requirements
- All card data encrypted at rest with AES-256.

== Software Quality Attributes
- Availability: 99.95% monthly uptime.

== Business Rules
_None specified._

= Other Requirements
- Must support PCI DSS re-certification annually.

= Appendix A: Glossary
#table(
  columns: (1fr, 2fr),
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else { none },
  [*Term / Acronym*], [*Definition*],
  [*PAN*], [Primary Account Number],
  [*CVV*], [Card Verification Value],
)

= Appendix B: Analysis Models
// Architecture diagrams embedded in export bundle
