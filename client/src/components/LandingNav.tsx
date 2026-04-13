import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "wouter";
import { Menu, Sparkles, Moon, Sun } from "lucide-react";
import logoImg from "@assets/icai-ca-india-logo.png";

export default function LandingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check for saved theme preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const isDarkMode = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDark(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };
  
  return (
    <nav className="sticky top-0 z-50 border-b border-primary/15 bg-background/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" data-testid="link-nav-home" className="flex items-center gap-3">
            <img src={logoImg} alt="CA GPT" className="h-9 w-auto" />
            <span className="font-display text-xl font-bold text-[#003087] hidden sm:block">CA GPT</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <Link 
              href="/features" 
              className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors" 
              data-testid="link-nav-features"
            >
              Features
            </Link>
            
            
            <Link 
              href="/docs" 
              className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors" 
              data-testid="link-nav-docs"
            >
              Docs
            </Link>
            <Link 
              href="/blog" 
              className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors" 
              data-testid="link-nav-blog"
            >
              Blog
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px] border-l-primary/20">
              <SheetHeader>
                <SheetTitle className="font-display text-primary">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-6">
                <Link 
                  href="/features" 
                  className="text-base font-medium hover:text-primary transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Features
                </Link>
                
                <Link 
                  href="/docs" 
                  className="text-base font-medium hover:text-primary transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Docs
                </Link>
                <Link 
                  href="/blog" 
                  className="text-base font-medium hover:text-primary transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Blog
                </Link>
                
                <div className="border-t border-primary/20 pt-4 mt-4 space-y-2">
                  {/* Theme Toggle in Mobile Menu */}
                  <Button 
                    variant="outline" 
                    className="w-full border-primary/30 hover:border-primary hover:bg-primary/5 gap-2"
                    onClick={toggleTheme}
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                  </Button>
                  <Button 
                    asChild
                    variant="outline" 
                    className="w-full border-primary/30 hover:border-primary hover:bg-primary/5"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link href="/auth">
                      Sign In
                    </Link>
                  </Button>
                  <Button 
                    asChild
                    className="w-full bg-primary hover:bg-secondary text-primary-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Link href="/auth">
                      Get Started
                    </Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop Buttons */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={toggleTheme}
            className="hidden md:inline-flex hover:text-primary hover:bg-primary/10"
            data-testid="button-theme-toggle"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button 
            asChild
            variant="ghost" 
            size="sm"
            className="hidden md:inline-flex hover:text-primary hover:bg-primary/10"
          >
            <Link href="/auth" data-testid="button-sign-in">
              Sign In
            </Link>
          </Button>
          <Button 
            asChild
            size="sm"
            className="hidden md:inline-flex bg-primary hover:bg-secondary text-primary-foreground shadow-md shadow-primary/20"
          >
            <Link href="/auth" data-testid="button-get-started" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Get Started
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
