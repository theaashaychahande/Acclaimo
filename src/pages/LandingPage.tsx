import { useEffect, useState } from "react";
import { Hero } from "../components/landing/Hero";
import { HowItWorks } from "../components/landing/HowItWorks";
import { Features } from "../components/landing/Features";
import { PrivacySection } from "../components/landing/PrivacySection";
import { Faq } from "../components/landing/Faq";
import { FinalCta } from "../components/landing/FinalCta";
import { StickyCta } from "../components/landing/StickyCta";

export function LandingPage() {
  const [heroVisible, setHeroVisible] = useState(true);
  const [endVisible, setEndVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero");
    const end = document.getElementById("final-cta");
    if (!hero || !end) return;

    const heroObserver = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0.05 },
    );
    const endObserver = new IntersectionObserver(
      ([entry]) => setEndVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );

    heroObserver.observe(hero);
    endObserver.observe(end);

    return () => {
      heroObserver.disconnect();
      endObserver.disconnect();
    };
  }, []);

  return (
    <>
      <Hero />
      <div className="border-y border-line bg-surface">
        <div className="container-page flex flex-col gap-2 py-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Built for college departments and clubs. Free to use.</p>
          <p>No ads. No student accounts. No folder of PDFs.</p>
        </div>
      </div>
      <HowItWorks />
      <Features />
      <PrivacySection />
      <Faq />
      <FinalCta />
      <StickyCta show={!heroVisible && !endVisible} />
    </>
  );
}
