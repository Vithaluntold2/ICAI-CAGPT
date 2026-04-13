import modelDiagramImg from "@assets/generated_images/Model_architecture_diagram_illustration_355e2048.png";

export default function ModelArchitecture() {
  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl lg:text-4xl font-semibold">
              Intelligent Query Triage & Model Routing
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Every question is analyzed and routed to the optimal combination of 
              specialized models and solvers. Our triage system ensures you always 
              get the most accurate, domain-specific expertise.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Domain Classification</h4>
                  <p className="text-sm text-muted-foreground">
                    Automatically categorizes queries into tax, audit, financial reporting, or compliance domains
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Specialized Model Selection</h4>
                  <p className="text-sm text-muted-foreground">
                    Routes to fine-tuned models optimized for specific accounting scenarios
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Response Synthesis</h4>
                  <p className="text-sm text-muted-foreground">
                    Combines outputs from multiple models with solver calculations for comprehensive answers
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <img 
              src={modelDiagramImg} 
              alt="Model architecture diagram" 
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
