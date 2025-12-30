"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Zap, MousePointer, Sparkles } from "lucide-react"
import { ExtractionMode } from "@/types/annotation"
import { cn } from "@/lib/utils"

interface ExtractionModeSelectorProps {
  selectedMode: ExtractionMode;
  onModeChange: (mode: ExtractionMode) => void;
}

interface ModeOption {
  value: ExtractionMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const modeOptions: ModeOption[] = [
  {
    value: 'auto',
    label: 'Auto Extract',
    description: 'AI automatically identifies and extracts all questions',
    icon: <Zap className="h-5 w-5" />,
  },
  {
    value: 'manual',
    label: 'Manual Selection',
    description: 'Select text from the PDF to mark as questions',
    icon: <MousePointer className="h-5 w-5" />,
  },
  {
    value: 'ai-assisted',
    label: 'AI-Assisted',
    description: 'AI suggests questions for you to accept or reject',
    icon: <Sparkles className="h-5 w-5" />,
  },
]

export function ExtractionModeSelector({
  selectedMode,
  onModeChange,
}: ExtractionModeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Extraction Mode</Label>
      <RadioGroup
        value={selectedMode}
        onValueChange={(value) => onModeChange(value as ExtractionMode)}
        className="grid gap-3"
      >
        {modeOptions.map((option) => (
          <div key={option.value} className="relative">
            <RadioGroupItem
              value={option.value}
              id={`mode-${option.value}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`mode-${option.value}`}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                "hover:bg-accent hover:border-accent-foreground/20",
                "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
              )}
            >
              <div className={cn(
                "mt-0.5 text-muted-foreground",
                selectedMode === option.value && "text-primary"
              )}>
                {option.icon}
              </div>
              <div className="space-y-1">
                <p className={cn(
                  "font-medium leading-none",
                  selectedMode === option.value && "text-primary"
                )}>
                  {option.label}
                </p>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}
