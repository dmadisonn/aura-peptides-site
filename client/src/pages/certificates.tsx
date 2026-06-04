import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, X, Download, ZoomIn, ZoomOut } from "lucide-react";
import type { Certificate } from "@shared/schema";
import { PdfThumbnail } from "@/components/pdf-thumbnail";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

export default function CertificatesPage() {
  const { data: certificates, isLoading } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates"],
  });
  const [viewCert, setViewCert] = useState<Certificate | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const isMobile = useIsMobile();

  useEffect(() => {
    document.title = "Certificates of Analysis - Aura Peptides";
  }, []);

  useEffect(() => {
    if (viewCert) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [viewCert]);

  const closeLightbox = () => {
    setViewCert(null);
    setZoomed(false);
  };

  const isImage = viewCert?.fileType === "image";
  const isPdf = viewCert?.fileType === "pdf";
  const showIframe = isPdf && !isMobile;
  const previewSrc = viewCert
    ? isImage
      ? viewCert.fileUrl
      : isMobile
        ? viewCert.thumbnailUrl || null
        : null
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground mb-3">
          Lab Documentation
        </p>
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight font-normal" data-testid="text-coa-heading">
          Certificates of Analysis
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
          Every batch is independently tested by U.S. laboratories. Batch numbers, purity results, and test dates are published here for open verification.
        </p>
        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-yellow-500/30 bg-yellow-500/5 rounded text-[10px] text-yellow-600">
          ⚠ All products for laboratory research use only · Not for human consumption
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-md" />
          ))}
        </div>
      ) : !certificates || certificates.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            Certificates of Analysis will be available soon.
          </p>
        </div>
      ) : (
        <>
          {/* View toggle */}
          <div className="flex justify-end mb-4">
            <div className="flex rounded-md border overflow-hidden text-xs">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >Grid</button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >Table</button>
            </div>
          </div>

          {/* Table view */}
          {viewMode === 'table' ? (
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-5 py-3 bg-muted/60 border-b text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="col-span-3">Product</span>
                <span className="col-span-2">Batch #</span>
                <span className="col-span-2">Purity</span>
                <span className="col-span-2">Test Date</span>
                <span className="col-span-2">Lab</span>
                <span className="col-span-1 text-right">COA</span>
              </div>
              {certificates.map((cert, i) => (
                <div key={cert.id} className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  <div className="col-span-3">
                    <p className="font-medium text-sm leading-tight">{cert.productName}</p>
                  </div>
                  <div className="col-span-2">
                    {cert.batchNumber
                      ? <span className="font-mono text-xs text-muted-foreground">{cert.batchNumber}</span>
                      : <span className="text-xs text-muted-foreground/50 italic">On request</span>}
                  </div>
                  <div className="col-span-2">
                    {cert.purity
                      ? <span className="text-xs font-bold text-green-600">{cert.purity}</span>
                      : <span className="text-xs text-muted-foreground/50">—</span>}
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">{cert.testDate || '—'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground">{cert.testedBy || 'Freedom Diagnostics'}</span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {cert.fileUrl ? (
                      <button onClick={() => { setViewCert(cert); setZoomed(false); }} className="text-xs text-primary hover:underline font-medium">PDF</button>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground/60 text-center py-4">
                COAs issued by Freedom Diagnostics · HPLC/MS methodology · Missing COAs available on request at support@aurapepts.bio
              </p>
            </div>
          ) : (
            /* Grid view */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {certificates.map((cert) => (
                <Card
                  key={cert.id}
                  className="overflow-visible hover-elevate cursor-pointer"
                  data-testid={`card-coa-public-${cert.id}`}
                >
                  <button
                    className="block w-full"
                    onClick={() => { setViewCert(cert); setZoomed(false); }}
                  >
                    {cert.fileType === "image" ? (
                      <div className="aspect-[3/4] overflow-hidden rounded-t-md">
                        <img src={cert.fileUrl} alt={cert.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <PdfThumbnail thumbnailUrl={cert.thumbnailUrl} />
                    )}
                  </button>
                  <div className="p-3 space-y-1">
                    <p className="text-xs font-semibold truncate leading-tight" data-testid={`text-coa-title-${cert.id}`}>
                      {cert.productName}
                    </p>
                    {cert.batchNumber && (
                      <p className="text-[10px] text-muted-foreground font-mono">Batch #{cert.batchNumber}</p>
                    )}
                    {cert.purity && (
                      <p className="text-[10px] font-bold text-green-600">Purity: {cert.purity}</p>
                    )}
                    {cert.testDate && (
                      <p className="text-[10px] text-muted-foreground/70">Tested: {cert.testDate}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Lightbox */}
      {viewCert && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 flex flex-col"
          onClick={closeLightbox}
          data-testid="coa-lightbox"
        >
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <div className="flex flex-col mr-4 max-w-[60%]">
              <p className="text-white text-sm font-medium truncate">{viewCert.productName}</p>
              <div className="flex items-center gap-3 mt-0.5">
                {viewCert.batchNumber && <p className="text-white/50 text-[10px] font-mono">Batch #{viewCert.batchNumber}</p>}
                {viewCert.purity && <p className="text-green-400 text-[10px] font-bold">{viewCert.purity}</p>}
                {viewCert.testDate && <p className="text-white/50 text-[10px]">Tested {viewCert.testDate}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {previewSrc && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white/80 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
                >
                  {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                </Button>
              )}
              {viewCert.fileUrl && (
                <Button size="icon" variant="ghost" className="text-white/80 hover:text-white" asChild>
                  <a href={viewCert.fileUrl} target="_blank" rel="noopener noreferrer" download onClick={(e) => e.stopPropagation()}>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button size="icon" variant="ghost" className="text-white/80 hover:text-white" onClick={closeLightbox}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-hidden px-4 pb-4" onClick={(e) => e.stopPropagation()}>
            {showIframe ? (
              <iframe
                src={viewCert.fileUrl!}
                className="w-full h-full max-w-4xl rounded"
                title={viewCert.productName}
              />
            ) : previewSrc ? (
              <img
                src={previewSrc}
                alt={viewCert.productName}
                className={`rounded shadow-2xl transition-all duration-200 ${zoomed ? 'max-h-none max-w-none w-auto' : 'max-h-full max-w-full object-contain'}`}
              />
            ) : (
              <div className="text-white/60 text-sm text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p>Preview not available.</p>
                {viewCert.fileUrl && (
                  <a href={viewCert.fileUrl} target="_blank" rel="noopener noreferrer" className="text-white underline mt-2 inline-block">
                    Open PDF
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
