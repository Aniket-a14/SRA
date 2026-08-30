import dynamic from "next/dynamic";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";

const InfrastructureSection = dynamic(() => import("@/components/landing/infrastructure-section").then(mod => mod.InfrastructureSection));
const MetricsSection = dynamic(() => import("@/components/landing/metrics-section").then(mod => mod.MetricsSection));
const IntegrationsSection = dynamic(() => import("@/components/landing/integrations-section").then(mod => mod.IntegrationsSection));
const SecuritySection = dynamic(() => import("@/components/landing/security-section").then(mod => mod.SecuritySection));
const DevelopersSection = dynamic(() => import("@/components/landing/developers-section").then(mod => mod.DevelopersSection));
const CtaSection = dynamic(() => import("@/components/landing/cta-section").then(mod => mod.CtaSection));
const FooterSection = dynamic(() => import("@/components/landing/footer-section").then(mod => mod.FooterSection));

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <InfrastructureSection />
      <MetricsSection />
      <IntegrationsSection />
      <SecuritySection />
      <DevelopersSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}
