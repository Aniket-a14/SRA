"use client";

import { useEffect, useState, useRef } from "react";

const pipelineStages = [
  { city: "Product Owner", region: "Refines scope & features", latency: "Stage 1" },
  { city: "RAG Retrieval", region: "pgvector cosine similarity", latency: "Stage 2" },
  { city: "Architect", region: "Designs with retrieved context", latency: "Stage 3" },
  { city: "Developer", region: "Drafts SRS sections", latency: "Stage 4" },
  { city: "Reviewer", region: "Approve / reject gate", latency: "Stage 5" },
  { city: "Critic", region: "6-dimension quality score", latency: "Stage 6" },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeLocation, setActiveLocation] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLocation((prev) => (prev + 1) % pipelineStages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="architecture" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Architecture
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Grounded by
              <br />
              design.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12">
              Every draft is grounded in retrieved context, not just model guesswork —
              and gated by a reflection loop before it reaches you. Nothing ships
              without passing the quality bar.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8">
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">5</div>
                <div className="text-sm text-muted-foreground">Agents in the pipeline</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">2</div>
                <div className="text-sm text-muted-foreground">Max reflection passes</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">85</div>
                <div className="text-sm text-muted-foreground">Quality threshold / 100</div>
              </div>
            </div>
          </div>

          {/* Right: Pipeline stage list */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-foreground/10">
              {/* Header */}
              <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground">Analysis Pipeline</span>
                <span className="flex items-center gap-2 text-xs font-mono text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Sequential
                </span>
              </div>

              {/* Stages */}
              <div>
                {pipelineStages.map((stage, index) => (
                  <div
                    key={stage.city}
                    className={`px-6 py-5 border-b border-foreground/5 last:border-b-0 flex items-center justify-between transition-all duration-300 ${
                      activeLocation === index ? "bg-foreground/[0.02]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                          activeLocation === index ? "bg-foreground" : "bg-foreground/20"
                        }`}
                      />
                      <div>
                        <div className="font-medium">{stage.city}</div>
                        <div className="text-sm text-muted-foreground">{stage.region}</div>
                      </div>
                    </div>
                    <span className="font-mono text-sm text-muted-foreground">{stage.latency}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
