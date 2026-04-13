import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import testimonial1 from "@assets/generated_images/Accountant_testimonial_portrait_1_de72851b.png";
import testimonial2 from "@assets/generated_images/Accountant_testimonial_portrait_2_2ab6aca6.png";
import testimonial3 from "@assets/generated_images/Accountant_testimonial_portrait_3_eba0c1a7.png";

const testimonials = [
  {
    quote: "CA GPT's multi-model architecture has transformed how we handle complex tax scenarios. The intelligent routing ensures we always get the most accurate guidance.",
    author: "Sarah Chen",
    role: "Senior Tax Accountant",
    company: "Baker & Associates",
    image: testimonial1
  },
  {
    quote: "The advanced solvers have saved our team countless hours on financial calculations. It's like having a team of specialists available 24/7.",
    author: "Michael Rodriguez",
    role: "CFO",
    company: "TechFlow Inc.",
    image: testimonial2
  },
  {
    quote: "What sets CA GPT apart is its deep understanding of global compliance requirements. It's invaluable for our international clients.",
    author: "Dr. Emily Thompson",
    role: "Managing Partner",
    company: "Global Accounting Solutions",
    image: testimonial3
  }
];

export default function Testimonials() {
  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl lg:text-4xl font-semibold">
            Trusted by Professionals
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how accounting professionals are leveraging CA GPT to deliver 
            better results for their clients.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="p-6 flex flex-col gap-4"
              data-testid={`card-testimonial-${index}`}
            >
              <p className="text-sm leading-relaxed text-muted-foreground">
                "{testimonial.quote}"
              </p>
              
              <div className="flex items-center gap-3 mt-auto">
                <Avatar>
                  <AvatarImage src={testimonial.image} alt={testimonial.author} />
                  <AvatarFallback>{testimonial.author.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-sm">{testimonial.author}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.company}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
