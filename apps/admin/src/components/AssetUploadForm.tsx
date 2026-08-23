import { useState } from "react";

import { useTranslation } from "../i18n";

interface AssetUploadFormProps {
  isUploading: boolean;
  onUpload: (file: File, displayName: string) => Promise<boolean>;
}

export function AssetUploadForm({ isUploading, onUpload }: AssetUploadFormProps) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;

    if (!selectedFile) {
      return;
    }

    if (await onUpload(selectedFile, displayName)) {
      form.reset();
      setDisplayName("");
      setSelectedFile(null);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0] ?? null;

    setSelectedFile(file);

    if (file && displayName.trim().length === 0) {
      setDisplayName(getDefaultAssetName(file.name));
    }
  }

  return (
    <article className="panel assets-upload-panel">
      <h2>{t.assets.uploadTitle}</h2>
      <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <span>{t.assets.nameLabel}</span>
          <input
            maxLength={255}
            minLength={2}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <label>
          <span>{t.assets.fileLabel}</span>
          <input
            accept="image/avif,image/gif,image/jpeg,image/png,image/webp,video/mp4,video/ogg,video/quicktime,video/webm"
            onChange={handleFileChange}
            required
            type="file"
          />
        </label>
        {selectedFile ? (
          <p className="metric">
            {selectedFile.name} · {formatFileSize(selectedFile.size)}
          </p>
        ) : null}
        <button
          className="primary-button"
          disabled={isUploading || !selectedFile || displayName.trim().length < 2}
          type="submit"
        >
          {isUploading ? t.assets.uploading : t.assets.uploadButton}
        </button>
      </form>
    </article>
  );
}

function getDefaultAssetName(filename: string): string {
  const normalizedFilename = filename.replace(/\\/g, "/").split("/").pop() ?? filename;
  const extensionIndex = normalizedFilename.lastIndexOf(".");

  return (
    extensionIndex > 0 ? normalizedFilename.slice(0, extensionIndex) : normalizedFilename
  ).slice(0, 255);
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = sizeBytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}
