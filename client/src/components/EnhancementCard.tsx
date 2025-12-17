import { useState } from "react";
import { Enhancement } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  BeakerIcon,
  LightBulbIcon,
  ChartBarIcon,
  DocumentTextIcon,
  VariableIcon,
  TableCellsIcon,
  CommandLineIcon,
  CalculatorIcon,
  AcademicCapIcon
} from "@heroicons/react/24/outline";

interface EnhancementCardProps {
  enhancement: Enhancement;
  onToggle: (id: string, enabled: boolean) => void;
}

const iconMap = {
  formula: BeakerIcon,
  hypothesis: LightBulbIcon,
  diagram: ChartBarIcon,
  logical_structure: DocumentTextIcon,
  symbol: VariableIcon,
  table: TableCellsIcon,
  equation: CalculatorIcon,
  theorem: AcademicCapIcon,
  proof: DocumentTextIcon,
  code_listing: CommandLineIcon,
  algorithm: CommandLineIcon,
};

const typeLabels = {
  formula: "Formula",
  hypothesis: "Hypothesis",
  diagram: "Diagram",
  logical_structure: "Logical Structure",
  symbol: "Symbol",
  table: "Table",
  equation: "Equation",
  theorem: "Theorem",
  proof: "Proof",
  code_listing: "Code Listing",
  algorithm: "Algorithm",
};

const typeColors = {
  formula: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  hypothesis: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  diagram: "bg-green-500/10 text-green-700 dark:text-green-300",
  logical_structure: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  symbol: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  table: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  equation: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  theorem: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  proof: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  code_listing: "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  algorithm: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

export function EnhancementCard({ enhancement, onToggle }: EnhancementCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = iconMap[enhancement.type as keyof typeof iconMap] || BeakerIcon;

  return (
    <Card
      className={`
        p-4 transition-all duration-200 hover-elevate cursor-pointer
        ${enhancement.enabled ? "border-l-4 border-l-primary" : ""}
      `}
      onClick={() => setIsExpanded(!isExpanded)}
      data-testid={`card-enhancement-${enhancement.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-10 h-10 rounded-lg ${typeColors[enhancement.type as keyof typeof typeColors] || "bg-gray-500/10"} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="text-sm font-medium text-foreground break-words" data-testid={`text-title-${enhancement.id}`}>
                {enhancement.title}
              </h4>
              <Badge variant="secondary" className="text-xs">
                {typeLabels[enhancement.type as keyof typeof typeLabels] || enhancement.type}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-2 break-words">
              {enhancement.description}
            </p>

            <p className="text-xs text-muted-foreground/80 break-words">
              Location: {enhancement.location}
            </p>

            {isExpanded && (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">Content:</p>
                  <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap break-words font-mono">
                    {enhancement.content}
                  </pre>
                </div>

                <div>
                  <p className="text-xs font-medium text-foreground mb-1">AI Reasoning:</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {enhancement.reasoning}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch
            checked={enhancement.enabled}
            onCheckedChange={(checked) => {
              onToggle(enhancement.id, checked);
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid={`switch-enhancement-${enhancement.id}`}
          />
        </div>
      </div>
    </Card>
  );
}
