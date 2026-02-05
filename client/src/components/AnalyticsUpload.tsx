import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Image, Plus, Trash2, Loader2, AlertCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  type TrafficSource,
  validateTrafficSources,
  trafficSourcesToRecord,
  parseSearchQueries,
  validateSearchQueries,
  validateImageFile,
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE_MB,
} from "@/lib/analyticsParser";

interface AnalyticsUploadProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { trafficSources: Record<string, number>; searchQueries: string[] }) => void;
  isProcessing: boolean;
}

type UploadState = "initial" | "preview" | "processing" | "error";

export function AnalyticsUpload({ open, onClose, onSubmit, isProcessing }: AnalyticsUploadProps) {
  const [activeTab, setActiveTab] = useState<string>("upload");
  const [uploadState, setUploadState] = useState<UploadState>("initial");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([
    { name: "For You Page", percentage: 50 },
    { name: "Search", percentage: 30 },
    { name: "Following", percentage: 20 },
  ]);
  const [searchQueriesInput, setSearchQueriesInput] = useState("");
  const [manualErrors, setManualErrors] = useState<{ traffic?: string; queries?: string }>({});

  const resetState = useCallback(() => {
    setUploadState("initial");
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setErrorMessage("");
    setIsDragging(false);
    setManualErrors({});
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      setErrorMessage(validation.error || "Invalid file");
      setUploadState("error");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadState("preview");
    setErrorMessage("");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleProcessImage = useCallback(async () => {
    if (!selectedFile) return;

    setUploadState("processing");
    setUploadProgress(0);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Step 1: Get presigned URL for upload
      setUploadProgress(10);
      const urlResponse = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedFile.name,
          size: selectedFile.size,
          contentType: selectedFile.type,
        }),
      });

      if (!urlResponse.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL, objectPath } = await urlResponse.json();
      setUploadProgress(30);

      // Step 2: Upload file directly to presigned URL
      const uploadResult = await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type },
      });

      if (!uploadResult.ok) {
        throw new Error("Failed to upload image");
      }

      setUploadProgress(60);

      // Step 3: Process the uploaded image with OCR
      const response = await fetch("/api/analytics/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectPath }),
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error("Failed to process image");
      }

      const data = await response.json();
      onSubmit({
        trafficSources: data.trafficSources || {},
        searchQueries: data.searchQueries || [],
      });
      handleClose();
    } catch (error) {
      clearInterval(progressInterval);
      setErrorMessage(error instanceof Error ? error.message : "Failed to analyze screenshot");
      setUploadState("error");
    }
  }, [selectedFile, onSubmit, handleClose]);

  const handleRetry = useCallback(() => {
    setUploadState("initial");
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setErrorMessage("");
  }, []);

  const addTrafficSource = useCallback(() => {
    setTrafficSources((prev) => [...prev, { name: "", percentage: 0 }]);
  }, []);

  const removeTrafficSource = useCallback((index: number) => {
    setTrafficSources((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateTrafficSource = useCallback(
    (index: number, field: keyof TrafficSource, value: string | number) => {
      setTrafficSources((prev) =>
        prev.map((source, i) =>
          i === index ? { ...source, [field]: field === "percentage" ? Number(value) : value } : source
        )
      );
    },
    []
  );

  const handleManualSubmit = useCallback(() => {
    const trafficValidation = validateTrafficSources(trafficSources);
    const queries = parseSearchQueries(searchQueriesInput);
    const queriesValidation = validateSearchQueries(queries);

    const errors: { traffic?: string; queries?: string } = {};
    if (!trafficValidation.isValid) errors.traffic = trafficValidation.error;
    if (!queriesValidation.isValid) errors.queries = queriesValidation.error;

    if (Object.keys(errors).length > 0) {
      setManualErrors(errors);
      return;
    }

    setManualErrors({});
    onSubmit({
      trafficSources: trafficSourcesToRecord(trafficSources),
      searchQueries: queries,
    });
    handleClose();
  }, [trafficSources, searchQueriesInput, onSubmit, handleClose]);

  const trafficTotal = trafficSources.reduce((sum, s) => sum + s.percentage, 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-analytics-upload">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Import TikTok Analytics</DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            Upload a screenshot from your TikTok Creator Tools or enter your stats manually
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2" data-testid="tabs-list">
            <TabsTrigger value="upload" data-testid="tab-upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload Screenshot
            </TabsTrigger>
            <TabsTrigger value="manual" data-testid="tab-manual">
              <Image className="mr-2 h-4 w-4" />
              Enter Manually
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="upload" className="mt-4" asChild>
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                {uploadState === "initial" && (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    data-testid="dropzone"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(",")}
                      onChange={handleFileInputChange}
                      className="hidden"
                      data-testid="input-file"
                    />
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag and drop your TikTok analytics screenshot
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      PNG, JPG or JPEG up to {MAX_FILE_SIZE_MB}MB
                    </p>
                    <Button variant="outline" onClick={handleUploadClick} data-testid="button-browse">
                      Browse Files
                    </Button>
                  </div>
                )}

                {uploadState === "preview" && previewUrl && (
                  <div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden border">
                      <img
                        src={previewUrl}
                        alt="Analytics preview"
                        className="w-full h-48 object-contain bg-muted"
                        data-testid="image-preview"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={handleRetry}
                        data-testid="button-remove-preview"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      {selectedFile?.name}
                    </p>
                    <Button
                      className="w-full"
                      onClick={handleProcessImage}
                      disabled={isProcessing}
                      data-testid="button-analyze"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        "Analyze Screenshot"
                      )}
                    </Button>
                  </div>
                )}

                {uploadState === "processing" && (
                  <div className="py-8 text-center space-y-4" data-testid="processing-state">
                    <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                    <p className="text-sm font-medium">Analyzing your TikTok data...</p>
                    <Progress value={uploadProgress} className="w-full" data-testid="progress-upload" />
                    <p className="text-xs text-muted-foreground">
                      Extracting traffic sources and search queries
                    </p>
                  </div>
                )}

                {uploadState === "error" && (
                  <div className="py-8 text-center space-y-4" data-testid="error-state">
                    <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                    <p className="text-sm text-destructive font-medium">{errorMessage}</p>
                    <Button variant="outline" onClick={handleRetry} data-testid="button-retry">
                      Try Again
                    </Button>
                  </div>
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="manual" className="mt-4" asChild>
              <motion.div
                key="manual"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Traffic Sources</Label>
                    <span
                      className={`text-xs ${
                        Math.abs(trafficTotal - 100) < 0.01 ? "text-green-600" : "text-muted-foreground"
                      }`}
                      data-testid="text-traffic-total"
                    >
                      Total: {trafficTotal.toFixed(1)}%
                    </span>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {trafficSources.map((source, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          placeholder="Source name"
                          value={source.name}
                          onChange={(e) => updateTrafficSource(index, "name", e.target.value)}
                          className="flex-1"
                          data-testid={`input-source-name-${index}`}
                        />
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={source.percentage}
                          onChange={(e) => updateTrafficSource(index, "percentage", e.target.value)}
                          className="w-20"
                          data-testid={`input-source-percentage-${index}`}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeTrafficSource(index)}
                          disabled={trafficSources.length <= 1}
                          data-testid={`button-remove-source-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addTrafficSource}
                    className="w-full"
                    data-testid="button-add-source"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Traffic Source
                  </Button>

                  {manualErrors.traffic && (
                    <p className="text-xs text-destructive" data-testid="text-error-traffic">
                      {manualErrors.traffic}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-queries" className="text-sm font-medium">
                    Top Search Queries
                  </Label>
                  <Input
                    id="search-queries"
                    placeholder="viral trends, how to, tutorial"
                    value={searchQueriesInput}
                    onChange={(e) => setSearchQueriesInput(e.target.value)}
                    data-testid="input-search-queries"
                  />
                  <p className="text-xs text-muted-foreground">
                    What people search to find your videos (from TikTok Search tab)
                  </p>
                  {manualErrors.queries && (
                    <p className="text-xs text-destructive" data-testid="text-error-queries">
                      {manualErrors.queries}
                    </p>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={handleManualSubmit}
                  disabled={isProcessing}
                  data-testid="button-submit-manual"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Analytics Data"
                  )}
                </Button>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
