import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, Moon, Sun } from "lucide-react";
import logoSymbol from "@assets/icai-ca-india-logo.png";
import { useState, useEffect } from "react";

interface ChatHeaderProps {
  onMenuToggle?: () => void;
}

export default function ChatHeader({ onMenuToggle }: ChatHeaderProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
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
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onMenuToggle}
          data-testid="button-menu-toggle"
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <img src={logoSymbol} alt="CA GPT" className="h-8 w-auto" data-testid="img-logo" />
        <span className="font-semibold text-lg">CA GPT</span>
        
        <Badge variant="secondary" className="ml-2">Professional</Badge>
      </div>
      
      <Button 
        variant="ghost" 
        size="icon"
        onClick={toggleTheme}
        data-testid="button-theme-toggle"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </Button>
    </header>
  );
}
