import type { AssignDisplayContentRequest } from "../../../shared/adminContracts.js";
import type { AssignmentTarget } from "../database.js";
import type { ClientLiveUpdateHub } from "../live/clientLiveUpdateHub.js";

const MAX_LIVE_WEB_LINK_REFRESH_SECONDS = 24 * 60 * 60;

interface RawAssignmentBody {
  assetId?: unknown;
  contentType?: unknown;
  fit?: unknown;
  refreshSeconds?: unknown;
  url?: unknown;
}

export function readAssignmentBody(body: unknown): AssignDisplayContentRequest | string {
  if (typeof body !== "object" || body === null) {
    return "Assignment content is required";
  }

  const rawBody = body as RawAssignmentBody;

  if (rawBody.contentType === "live_web_link") {
    return readLiveWebLinkAssignmentBody(rawBody);
  }

  return readAssetAssignmentBody(rawBody);
}

function readAssetAssignmentBody(body: RawAssignmentBody): AssignDisplayContentRequest | string {
  if (typeof body.assetId !== "string" || body.assetId.trim().length === 0) {
    return "Asset id is required";
  }

  if (body.fit !== "contain" && body.fit !== "cover") {
    return "Fit must be contain or cover";
  }

  return {
    assetId: body.assetId.trim(),
    contentType: "asset",
    fit: body.fit,
  };
}

function readLiveWebLinkAssignmentBody(
  body: RawAssignmentBody,
): AssignDisplayContentRequest | string {
  if (typeof body.url !== "string" || body.url.trim().length === 0) {
    return "Web link URL is required";
  }

  const url = body.url.trim();
  const validUrl = readHttpUrl(url);

  if (!validUrl) {
    return "Web link URL must use http or https";
  }

  if (
    !Number.isSafeInteger(body.refreshSeconds) ||
    typeof body.refreshSeconds !== "number" ||
    body.refreshSeconds < 1 ||
    body.refreshSeconds > MAX_LIVE_WEB_LINK_REFRESH_SECONDS
  ) {
    return "Refresh rate must be between 1 and 86400 seconds";
  }

  return {
    contentType: "live_web_link",
    refreshSeconds: body.refreshSeconds,
    url: validUrl,
  };
}

function readHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function notifyAssignmentChanged(
  liveUpdates: ClientLiveUpdateHub,
  target: AssignmentTarget,
): void {
  void liveUpdates.notifyAssignmentChanged(target).catch((error: unknown) => {
    console.warn(
      `Unable to notify live clients about assignment change: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  });
}
