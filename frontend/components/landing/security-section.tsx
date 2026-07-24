"use client";

import { useEffect, useState, useRef } from "react";
import { Shield, Lock, Eye, FileCheck } from "lucide-react";

const securityFeatures = [
  {
    icon: Lock,
    title: "Encrypted provider keys",
    description: "Your OpenAI, Claude, Grok, or Gemini API key is encrypted at rest with AES-256-GCM and never returned in plaintext.",
  },
  {
    icon: Shield,
    title: "OAuth + JWT sessions",
    description: "Sign in with Google or GitHub through a CSRF-protected, one-time exchange-code flow — no tokens ever land in a redirect URL.",
  },
  {
    icon: Eye,
    title: "Distributed rate limiting",
    description: "A Redis-backed sliding-window limiter protects auth and AI endpoints across every backend replica.",
  },
  {
    icon: FileCheck,
    title: "Full audit trail",
    description: "Sensitive actions are recorded through dedicated audit-logging middleware for traceability.",
  },
];

const certifications = ["JWT", "OAuth 2.0", "AES-256-GCM", "CSRF Protected", "Rate Limited"];

export function SecuritySection() {
  const [isVisible, setIsVisible] = useState(false);
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

  return (
    <section id="security" ref={sectionRef} className="relative py-16 sm:py-20 lg:py-32 bg-foreground/[0.02] overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Security
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Your keys.
              <br />
              Your data.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12">
              You bring the API key, we handle it carefully. Encryption,
              session security, and rate limiting are built into every layer
              of the platform — not bolted on after the fact.
            </p>

            {/* Certifications */}
            <div className="flex flex-wrap gap-3">
              {certifications.map((cert, index) => (
                <span
                  key={cert}
                  className={`px-4 py-2 border border-foreground/10 text-sm font-mono transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Features */}
          <div className="grid gap-6">
            {securityFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className={`p-6 border border-foreground/10 hover:border-foreground/20 transition-all duration-500 group ${
                  isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center border border-foreground/10 group-hover:bg-foreground group-hover:text-background transition-colors duration-300">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-1 group-hover:translate-x-1 transition-transform duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
