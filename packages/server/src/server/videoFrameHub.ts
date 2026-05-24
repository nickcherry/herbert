export interface VideoFrame {
  readonly id: number;
  readonly image: Uint8Array;
  readonly contentType: "image/jpeg";
  readonly capturedAtMs?: number;
  readonly receivedAtMs: number;
  readonly width?: number;
  readonly height?: number;
}

export interface PublishVideoFrameOptions {
  readonly image: Uint8Array;
  readonly contentType: "image/jpeg";
  readonly capturedAtMs?: number;
  readonly width?: number;
  readonly height?: number;
}

export interface VideoFrameStatus {
  readonly hasFrame: boolean;
  readonly frameId: number | null;
  readonly capturedAtMs: number | null;
  readonly receivedAtMs: number | null;
  readonly ageMs: number | null;
  readonly contentType: string | null;
  readonly byteLength: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly subscriberCount: number;
}

export interface VideoFrameHub {
  readonly publish: (options: PublishVideoFrameOptions) => VideoFrame;
  readonly latest: () => VideoFrame | undefined;
  readonly status: () => VideoFrameStatus;
  readonly subscribe: (listener: (frame: VideoFrame) => void) => () => void;
  readonly subscriberCount: () => number;
}

export function createVideoFrameHub(): VideoFrameHub {
  let latestFrame: VideoFrame | undefined;
  let nextFrameId = 1;
  const subscribers = new Set<(frame: VideoFrame) => void>();

  return {
    publish(options) {
      const frame: VideoFrame = {
        id: nextFrameId,
        image: options.image,
        contentType: options.contentType,
        capturedAtMs: options.capturedAtMs,
        receivedAtMs: Date.now(),
        width: options.width,
        height: options.height,
      };
      nextFrameId += 1;
      latestFrame = frame;

      for (const subscriber of subscribers) {
        subscriber(frame);
      }

      return frame;
    },

    latest() {
      return latestFrame;
    },

    status() {
      return videoFrameStatus({
        latestFrame,
        subscriberCount: subscribers.size,
      });
    },

    subscribe(listener) {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },

    subscriberCount() {
      return subscribers.size;
    },
  };
}

function videoFrameStatus({
  latestFrame,
  subscriberCount,
}: {
  readonly latestFrame?: VideoFrame;
  readonly subscriberCount: number;
}): VideoFrameStatus {
  if (latestFrame === undefined) {
    return {
      hasFrame: false,
      frameId: null,
      capturedAtMs: null,
      receivedAtMs: null,
      ageMs: null,
      contentType: null,
      byteLength: null,
      width: null,
      height: null,
      subscriberCount,
    };
  }

  return {
    hasFrame: true,
    frameId: latestFrame.id,
    capturedAtMs: latestFrame.capturedAtMs ?? null,
    receivedAtMs: latestFrame.receivedAtMs,
    ageMs: Math.max(0, Date.now() - latestFrame.receivedAtMs),
    contentType: latestFrame.contentType,
    byteLength: latestFrame.image.byteLength,
    width: latestFrame.width ?? null,
    height: latestFrame.height ?? null,
    subscriberCount,
  };
}
