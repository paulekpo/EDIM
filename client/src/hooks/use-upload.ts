import { useState, useCallback } from "react";
import type { UppyFile } from "@uppy/core";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: UploadMetadata;
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

function getCsrfToken() {
  const match = document.cookie.match(new RegExp('(^| )X-CSRF-Token=([^;]+)'));
  return match ? match[2] : null;
}

function getHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  return headers;
}

/**
 * React hook for handling file uploads with presigned URLs.
 */
export function useUpload(options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  /**
   * Request a presigned URL from the backend.
   * IMPORTANT: Send JSON metadata, NOT the file itself.
   */
  const requestUploadUrl = useCallback(
    async (file: File): Promise<UploadResponse> => {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: getHeaders("application/json"),
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get upload URL");
      }

      return response.json();
    },
    []
  );

  /**
   * Upload a file directly to the presigned URL.
   * Note: The upload URL for local storage is an API endpoint, so it might be subject to CSRF checks if it were a standard route.
   * However, the PUT to /api/uploads/file/:filename is a state-changing operation.
   * Since it's a direct upload to a "presigned" URL (which is just an API endpoint in our local impl),
   * we should include the CSRF token if it's hitting our backend.
   */
  const uploadToPresignedUrl = useCallback(
    async (file: File, uploadURL: string): Promise<void> => {
      // Check if the URL is relative (our backend) or absolute (external, like S3/GCS)
      // Our local implementation returns relative URLs starting with /api
      const isLocal = uploadURL.startsWith("/");

      const headers: Record<string, string> = {
        "Content-Type": file.type || "application/octet-stream",
      };

      if (isLocal) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
        }
      }

      const response = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file to storage");
      }
    },
    []
  );

  /**
   * Upload a file using the presigned URL flow.
   *
   * @param file - The file to upload
   * @returns The upload response containing the object path
   */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        // Step 1: Request presigned URL (send metadata as JSON)
        setProgress(10);
        const uploadResponse = await requestUploadUrl(file);

        // Step 2: Upload file directly to presigned URL
        setProgress(30);
        await uploadToPresignedUrl(file, uploadResponse.uploadURL);

        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [requestUploadUrl, uploadToPresignedUrl, options]
  );

  /**
   * Get upload parameters for Uppy's AWS S3 plugin.
   */
  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      // Use the actual file properties to request a per-file presigned URL
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: getHeaders("application/json"),
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const data = await response.json();

      // If local, we need to pass CSRF token in headers for the PUT request too
      const headers: Record<string, string> = {
        "Content-Type": file.type || "application/octet-stream"
      };

      if (data.uploadURL.startsWith("/")) {
         const csrfToken = getCsrfToken();
         if (csrfToken) {
           headers["X-CSRF-Token"] = csrfToken;
         }
      }

      return {
        method: "PUT",
        url: data.uploadURL,
        headers,
      };
    },
    []
  );

  return {
    uploadFile,
    getUploadParameters,
    isUploading,
    error,
    progress,
  };
}
