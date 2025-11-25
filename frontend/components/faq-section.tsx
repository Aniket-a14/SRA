"use client"

import { useEffect, useRef } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    question: "What types of requirements can I analyze?",
    answer:
      "You can analyze any software requirements including functional specifications, user stories, system requirements, business requirements, and technical documentation. Our AI is trained to understand various formats and structures.",
  },
  {
    question: "How accurate is the AI analysis?",
    answer:
      "Our AI provides highly accurate analysis by leveraging advanced natural language processing. However, we recommend reviewing the generated output and making adjustments as needed for your specific context.",
  },
  {
    question: "Can I export the analysis results?",
    answer:
      "Yes! You can export your analysis results in multiple formats including JSON, Markdown, and PDF. This makes it easy to integrate with your existing documentation and project management tools.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Absolutely. We use end-to-end encryption and never store your requirements on our servers longer than necessary. Your data is processed securely and deleted after analysis completion.",
  },
  {
    question: "What programming languages are supported for API contracts?",
    answer:
      "Our API contract generation supports multiple formats including OpenAPI/Swagger, GraphQL schemas, and REST specifications. We can generate examples in JavaScript, Python, TypeScript, and more.",
  },
  {
    question: "Can I customize the output format?",
    answer:
      "Yes, you can customize how results are displayed and structured. Choose from different templates for user stories, acceptance criteria, and API documentation to match your team's preferences.",
  },
]

export function FaqSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-up")
          }
        })
      },
      { threshold: 0.1 },
    )

    const elements = sectionRef.current?.querySelectorAll(".animate-on-scroll")
    elements?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <section id="faq" ref={sectionRef} className="py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 animate-on-scroll opacity-0">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground text-sm sm:text-base px-4">
              Everything you need to know about the Smart Requirements Analyzer
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="animate-on-scroll opacity-0 border border-border rounded-lg px-4 sm:px-6 bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 data-[state=open]:border-primary/50"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <AccordionTrigger className="text-left text-sm sm:text-base hover:text-primary transition-colors py-4">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm pb-4">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
