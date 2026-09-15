// System Requirements Specification: Golden Title
// Standard: Agile PRD (AGILE-PRD)
// Generated with SRA (Smart Requirements Analyzer)

#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2.5cm),
  header: context {
    if counter(page).get().first() > 1 [
      #text(size: 8pt, fill: rgb("#64748b"), italic: true)[Golden Title --- Agile PRD]
      #h(1fr)
      #text(size: 8pt, fill: rgb("#64748b"), weight: "bold")[AGILE-PRD]
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
  #text(size: 14pt, fill: rgb("#475569"))[Product Requirements Document]
  #v(20pt)
  #line(length: 60%, stroke: 1pt + rgb("#cbd5e1"))
  #v(10pt)
  #text(size: 11pt, weight: "medium")[*Standard:* Agile PRD (AGILE-PRD) --- *Version:* 1.0.0]
  #v(10pt)
  #line(length: 60%, stroke: 1pt + rgb("#cbd5e1"))
  #v(30pt)
  #block(width: 80%, fill: rgb("#f1f5f9"), radius: 4pt, inset: 12pt)[
    #align(left)[
      #text(weight: "bold")[Executive Brief:] \
      This formal specification establishes the engineering and verification baseline for *Golden Title* according to the *Agile PRD* standard.
    ]
  ]
  #v(50pt)
  #text(size: 10pt, fill: rgb("#64748b"))[Prepared with *SRA (Smart Requirements Analyzer)*] \
  #text(size: 10pt, fill: rgb("#64748b"))[September 14, 2026]
]
#pagebreak()

#outline(title: "Table of Contents", indent: auto)
#pagebreak()

= Overview
== Vision
Make peer recognition a two-click habit.

== Problem Statement
Recognition currently happens ad hoc in Slack and gets lost.

= Goals and Objectives
- Ship an MVP in one quarter.
- Reach 40% weekly active usage.

= Personas
== Persona: Priya the Manager
Wants visibility into team morale.
*Goals:*
- See recognition trends
- Nominate for awards

== Persona: Sam the IC

= User Stories
=== US-1: team member
*As a* team member, *I want* give a kudos to a teammate, *so that* I can recognize their help immediately.
*Acceptance Criteria:*
- Kudos post appears in the team feed within 1 second.
- Recipient gets a notification.

=== US-2: manager
*As a* manager, *I want* export a monthly recognition report, *so that* .

= Non-Functional Requirements
- The feed shall load in under 1 second on 4G.

= Open Questions
- Should kudos be anonymous by default?

= Glossary
#table(
  columns: (1fr, 2fr),
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else { none },
  [*Term / Acronym*], [*Definition*],
  [*Kudos*], [A short public note of recognition.],
)
