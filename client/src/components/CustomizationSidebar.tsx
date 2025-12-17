import { paperTypes, enhancementLevels } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CogIcon } from "@heroicons/react/24/outline";

interface CustomizationSidebarProps {
  paperType: string;
  enhancementLevel: string;
  authorName?: string;
  authorAffiliation?: string;
  onPaperTypeChange: (value: string) => void;
  onEnhancementLevelChange: (value: string) => void;
  onAuthorNameChange?: (value: string) => void;
  onAuthorAffiliationChange?: (value: string) => void;
  disabled?: boolean;
}

export function CustomizationSidebar({
  paperType,
  enhancementLevel,
  authorName = "",
  authorAffiliation = "",
  onPaperTypeChange,
  onEnhancementLevelChange,
  onAuthorNameChange,
  onAuthorAffiliationChange,
  disabled,
}: CustomizationSidebarProps) {
  return (
    <Card className="w-full md:w-80 p-6 space-y-6 flex-shrink-0" data-testid="sidebar-customization">
      <div className="flex items-center gap-2">
        <CogIcon className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground">Customization</h3>
      </div>

      <Separator />

      {/* Enhancement Level Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground">Enhancement Level</Label>
        <RadioGroup
          value={enhancementLevel}
          onValueChange={onEnhancementLevelChange}
          disabled={disabled}
          className="space-y-3"
        >
          {enhancementLevels.map((level) => (
            <div key={level.value} className="flex items-start space-x-3">
              <RadioGroupItem
                value={level.value}
                id={level.value}
                data-testid={`radio-${level.value}`}
              />
              <div className="flex-1">
                <Label
                  htmlFor={level.value}
                  className="text-sm font-medium cursor-pointer"
                >
                  {level.label}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {level.description}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      {/* Author Information */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-foreground">Author Information</Label>

        <div className="space-y-2">
          <Label htmlFor="author-name" className="text-xs text-muted-foreground">
            Author Name
          </Label>
          <Input
            id="author-name"
            value={authorName}
            onChange={(e) => onAuthorNameChange?.(e.target.value)}
            placeholder="Dr. Jane Smith"
            disabled={disabled}
            data-testid="input-author-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="author-affiliation" className="text-xs text-muted-foreground">
            Affiliation (Optional)
          </Label>
          <Input
            id="author-affiliation"
            value={authorAffiliation}
            onChange={(e) => onAuthorAffiliationChange?.(e.target.value)}
            placeholder="University of Example"
            disabled={disabled}
            data-testid="input-author-affiliation"
          />
        </div>
      </div>

      <Separator />

      <div className="pt-2">
        <div className="bg-muted/50 rounded-md p-4 space-y-2">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground mb-1">Pro Tip</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Higher enhancement levels add more scholarly elements but may require more review time
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
