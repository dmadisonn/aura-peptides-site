import { FileText } from "lucide-react";

export function PdfThumbnail({ thumbnailUrl }: { thumbnailUrl: string | null }) {
  if (thumbnailUrl) {
    return (
      <div className="aspect-[3/4] overflow-hidden rounded-t-md bg-white">
        <img
          src={thumbnailUrl}
          alt="PDF preview"
          className="w-full h-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div className="aspect-[3/4] flex flex-col items-center justify-center bg-muted/30 rounded-t-md">
      <FileText className="h-10 w-10 text-muted-foreground mb-2" />
      <span className="text-[10px] text-muted-foreground uppercase font-semibold">PDF</span>
    </div>
  );
}
