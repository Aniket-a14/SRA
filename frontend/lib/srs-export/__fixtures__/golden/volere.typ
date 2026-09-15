// System Requirements Specification: Golden Title
// Standard: Volere (VOLERE)
// Generated with SRA (Smart Requirements Analyzer)

#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2.5cm),
  header: context {
    if counter(page).get().first() > 1 [
      #text(size: 8pt, fill: rgb("#64748b"), italic: true)[Golden Title --- Volere]
      #h(1fr)
      #text(size: 8pt, fill: rgb("#64748b"), weight: "bold")[VOLERE]
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
  #text(size: 14pt, fill: rgb("#475569"))[Requirements Specification]
  #v(20pt)
  #line(length: 60%, stroke: 1pt + rgb("#cbd5e1"))
  #v(10pt)
  #text(size: 11pt, weight: "medium")[*Standard:* Volere (VOLERE) --- *Version:* 1.0.0]
  #v(10pt)
  #line(length: 60%, stroke: 1pt + rgb("#cbd5e1"))
  #v(30pt)
  #block(width: 80%, fill: rgb("#f1f5f9"), radius: 4pt, inset: 12pt)[
    #align(left)[
      #text(weight: "bold")[Executive Brief:] \
      This formal specification establishes the engineering and verification baseline for *Golden Title* according to the *Volere* standard.
    ]
  ]
  #v(50pt)
  #text(size: 10pt, fill: rgb("#64748b"))[Prepared with *SRA (Smart Requirements Analyzer)*] \
  #text(size: 10pt, fill: rgb("#64748b"))[September 14, 2026]
]
#pagebreak()

#outline(title: "Table of Contents", indent: auto)
#pagebreak()

= The Purpose of the Project
== The Background of the Project Effort
Volunteer shifts are currently coordinated by spreadsheet.

== Goals of the Project
- Reduce no-show rate
- Cut coordinator admin time by half

= Stakeholders
#table(
  columns: (1fr, 2fr),
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else { none },
  [*Stakeholder Role*], [*Interest & Success Measure*],
  [Coordinator], [Fast shift assignment.],
  [Volunteer], [Clear, timely shift reminders.],
)

= Constraints
== Solution Constraints
- Must integrate with existing SMS provider.

== Implementation Environment
Deployed on the org's existing hosting.

== Assumptions
- Volunteers have a mobile phone capable of SMS.

= Naming Conventions and Terminology
#table(
  columns: (1fr, 2fr),
  stroke: 0.5pt + rgb("#cbd5e1"),
  fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else { none },
  [*Term / Acronym*], [*Definition*],
  [*Shift*], [A scheduled volunteer time block.],
)

= Functional Requirements
== Shift Assignment
Assign volunteers to open shifts.

#requirement("GT-FR-1.1", "Shift Assignment", [The system shall notify a volunteer within 5 minutes of assignment.], rationale: "Timely confirmation reduces no-shows.", fit: "95% of notifications sent within 5 minutes.", verification: none)

= Non-functional Requirements
== Look and Feel Requirements
#requirement("GT-LOO-1", "Look and Feel Requirements", [The UI shall use the org's existing brand palette.])

== Usability and Humanity Requirements
#requirement("GT-USA-1", "Usability and Humanity Requirements", [A first-time coordinator shall complete shift setup within 10 minutes unaided.], rationale: none, fit: "90% success rate in usability testing.", verification: none)

== Performance Requirements

== Operational and Environmental Requirements
#requirement("GT-OPE-1", "Operational and Environmental Requirements", [The system shall run on commodity hosting with no dedicated ops staff.])

== Maintainability and Support Requirements

== Security Requirements
#requirement("GT-SEC-1", "Security Requirements", [Volunteer phone numbers shall be encrypted at rest.])

== Cultural and Political Requirements

== Legal Requirements
#requirement("GT-LEG-1", "Legal Requirements", [Must comply with TCPA consent requirements for SMS.])

= Project Issues
- *SMS provider rate limits:* Could delay notifications during peak sign-up. _(Mitigation: Queue and backoff.)_

= Appendix A: Analysis Models
// Architecture diagrams embedded in export bundle
