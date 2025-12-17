import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XMarkIcon, DocumentIcon } from "@heroicons/react/24/outline";

interface FileCardProps {
  fileName: string;
  fileSize: string;
  fileType: string;
  onRemove: () => void;
}

const getFileIcon = (type: string) => {
  if (type.includes("pdf")) {
    return "📄";
  } else {
    return "📋";
  }
};

export function FileCard({ fileName, fileSize, fileType, onRemove }: FileCardProps) {
  return (
    <Card className="h-24 p-4 flex items-center gap-4 hover-elevate" data-testid="card-file">
      <div className="text-4xl flex-shrink-0">
        {getFileIcon(fileType)}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-foreground truncate mb-1" data-testid="text-filename">
          {fileName}
        </h4>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{fileSize}</span>
          <span>•</span>
          <span className="uppercase">{fileType}</span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="flex-shrink-0"
        data-testid="button-remove"
      >
        <XMarkIcon className="w-5 h-5" />
      </Button>
    </Card>
  );
}
