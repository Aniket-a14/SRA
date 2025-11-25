"use client"

import { useEffect, useRef } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    question: "How do I get started?",
    answer:
      "To use the analyzer, you'll need a Google Gemini API key. You can get one for free from Google AI Studio. Once you have it, set it up in your backend environment variables to start analyzing requirements.",
  },
  {
    question: "What kind of diagrams are generated?",
    answer:
      "We currently generate Flowcharts and Sequence Diagrams to show the flow of operations. These are rendered using Mermaid.js for easy visualization and export.",
  },
  {
    question: "How detailed should my input be?",
    answer:
      "For the best results, provide a clear and descriptive overview of your project. Mention the key users, main features, and the overall goal of the software. The more context you provide, the better the AI can understand and structure the requirements.",
  },
  {
    question: "Is my data saved?",
    answer:
      "No, your data is processed in real-time for the current session only. We do not store your requirements or analysis results on our servers. Once you refresh the page, the data is cleared.",
  },
  {
    question: "What technology powers this?",
    answer:
      "The frontend is built with Next.js 15 and Tailwind CSS, while the backend uses Node.js and Express. The core analysis is powered by Google's Gemini Pro AI model.",
  },
  {
    question: "Can I contribute to the project?",
    answer:
      "Yes! This is an open-source project. You can check out our GitHub repository to report issues, suggest features, or submit pull requests. We welcome contributions from the community.",
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
