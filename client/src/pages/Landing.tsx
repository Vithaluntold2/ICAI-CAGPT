import LandingNav from "@/components/LandingNav";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Integrations from "@/components/Integrations";
import ProfessionalModes from "@/components/ProfessionalModes";
import Testimonials from "@/components/Testimonials";
import ModelArchitecture from "@/components/ModelArchitecture";
import Footer from "@/components/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      <Hero />
      <Features />
      <Integrations />
      <ProfessionalModes />
      <Testimonials />
      <ModelArchitecture />
      <Footer />
    </div>
  );
}
