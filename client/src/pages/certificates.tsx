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
        <h1
          className="font-display text-4xl sm:text-5xl tracking-tight font-normal"
          data-testid="text-coa-heading"
        >
          Certificates of Analysis
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
          Every compound is independently tested by U.S. laboratories. Reports and identifiers are published here for open review and verification.
        </p>
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
                    <img
                      src={cert.fileUrl}
                      alt={cert.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <PdfThumbnail thumbnailUrl={cert.thumbnailUrl} />
                )}
              </button>
              <div className="p-3">
                <p className="text-xs font-medium truncate" data-testid={`text-coa-title-${cert.id}`}>
                  {cert.title}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {viewCert && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 flex flex-col"
          onClick={closeLightbox}
          data-testid="coa-lightbox"
        >
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <p className="text-white text-sm font-medium truncate mr-4 max-w-[60%]">
              {viewCert.title}
            </p>
            <div className="flex items-center gap-2">
              {previewSrc && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white/80 hover:text-white"
                  onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
                  data-testid="button-zoom-toggle"
                >
                  {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
                </Button>
              )}
              <a
                href={viewCert.fileUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white/80 hover:text-white"
                  data-testid="button-download-coa"
                >
                  <Download className="h-5 w-5" />
                </Button>
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="text-white/80 hover:text-white"
                onClick={closeLightbox}
                data-testid="button-close-lightbox"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div
            className="flex-1 overflow-auto flex items-start sm:items-center justify-center px-4 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            {showIframe ? (
              <iframe
                src={viewCert.fileUrl}
                title={viewCert.title}
                className="w-full h-[calc(100vh-5rem)] max-w-4xl rounded-md bg-white"
                data-testid="iframe-coa-preview"
              />
            ) : previewSrc ? (
              <img
                src={previewSrc}
                alt={viewCert.title}
                className={`rounded-md bg-white transition-transform duration-200 ${
                  zoomed
                    ? "max-w-none w-[150vw] sm:w-[120vw] cursor-zoom-out"
                    : "max-w-full max-h-[calc(100vh-5rem)] w-auto h-auto object-contain cursor-zoom-in"
                }`}
                onClick={() => setZoomed(!zoomed)}
                data-testid="img-coa-preview"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <FileText className="h-16 w-16 text-white/40 mb-4" />
                <p className="text-white/60 text-sm mb-4">Preview not available</p>
                <a
                  href={viewCert.fileUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="bg-white/10 backdrop-blur text-white border-white/20">
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
