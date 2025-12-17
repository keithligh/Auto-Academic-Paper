import { DocumentTextIcon } from "@heroicons/react/24/outline";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4" data-testid="container-empty">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        {icon || <DocumentTextIcon className="w-10 h-10 text-muted-foreground scale-150" />}
      </div>
      
      <h3 className="text-xl font-semibold text-foreground mb-2 text-center">
        {title}
      </h3>
      
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        {description}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
}
