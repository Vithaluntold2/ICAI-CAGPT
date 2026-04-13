import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RefreshCw } from 'lucide-react';

// Simple label component
const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
    {children}
  </label>
);

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
}

const presetColors = [
  '#3C96EE', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#3C96EE', '#84cc16', '#f97316', '#3C96EE',
  '#14b8a6', '#f43f5e', '#22c55e', '#eab308', '#a855f7'
];

const gradientPresets = [
  'linear-gradient(135deg, #3C96EE 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #5FA9F1 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
  'linear-gradient(135deg, #a8e6cf 0%, #dcedc1 100%)'
];

export default function ColorPicker({ color, onChange, label }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(color);
  const [isGradient, setIsGradient] = useState(color.includes('gradient'));

  const handleColorChange = (newColor: string) => {
    setInputValue(newColor);
    onChange(newColor);
  };

  const generateRandomGradient = () => {
    const color1 = presetColors[Math.floor(Math.random() * presetColors.length)];
    const color2 = presetColors[Math.floor(Math.random() * presetColors.length)];
    const angle = Math.floor(Math.random() * 360);
    const gradient = `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
    handleColorChange(gradient);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-2">
          <div
            className="w-4 h-4 rounded border"
            style={{ background: color }}
          />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Color Type</Label>
            <div className="flex gap-2">
              <Button
                variant={!isGradient ? "default" : "outline"}
                size="sm"
                onClick={() => setIsGradient(false)}
                className="flex-1"
              >
                Solid
              </Button>
              <Button
                variant={isGradient ? "default" : "outline"}
                size="sm"
                onClick={() => setIsGradient(true)}
                className="flex-1"
              >
                Gradient
              </Button>
            </div>
          </div>

          {!isGradient ? (
            <>
              <div className="space-y-2">
                <Label>Preset Colors</Label>
                <div className="grid grid-cols-5 gap-2">
                  {presetColors.map((presetColor) => (
                    <button
                      key={presetColor}
                      className="w-8 h-8 rounded border-2 border-border hover:border-primary"
                      style={{ backgroundColor: presetColor }}
                      onClick={() => handleColorChange(presetColor)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Custom Color</Label>
                <Input
                  type="color"
                  value={inputValue.startsWith('#') ? inputValue : '#3C96EE'}
                  onChange={(e) => handleColorChange(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Gradient Presets</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateRandomGradient}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {gradientPresets.map((gradient, index) => (
                    <button
                      key={index}
                      className="h-8 rounded border-2 border-border hover:border-primary"
                      style={{ background: gradient }}
                      onClick={() => handleColorChange(gradient)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Custom Gradient</Label>
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onBlur={() => onChange(inputValue)}
                  placeholder="linear-gradient(135deg, #3C96EE 0%, #764ba2 100%)"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              className="w-full h-12 rounded border"
              style={{ background: inputValue }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}