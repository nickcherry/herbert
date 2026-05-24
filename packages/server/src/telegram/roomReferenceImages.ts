import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { RobotTaskFloorplanRoomId } from "@herbert/shared/robotTaskQueue";

export interface RoomReferenceImage {
  readonly roomId: RobotTaskFloorplanRoomId;
  readonly label: string;
  readonly path: string;
}

const roomReferenceImageDefinitions: readonly {
  readonly roomId: RobotTaskFloorplanRoomId;
  readonly label: string;
  readonly filename: string;
}[] = [
  {
    roomId: "living_dining",
    label: "Living / Dining Room",
    filename: "living-room.jpg",
  },
  { roomId: "kitchen", label: "Kitchen", filename: "kitchen.jpg" },
  {
    roomId: "master_bath",
    label: "Bathroom / Master Bath",
    filename: "bathroom.jpg",
  },
  {
    roomId: "bedroom_hall",
    label: "Bedroom Hall",
    filename: "bedroom-hall.jpg",
  },
  {
    roomId: "entrance",
    label: "Entry / Kitchen / Office",
    filename: "entrance.jpg",
  },
  {
    roomId: "master_bedroom",
    label: "Master Bedroom",
    filename: "master-bedroom.jpg",
  },
  {
    roomId: "office_bedroom",
    label: "Office Bedroom",
    filename: "office-bedroom.jpg",
  },
];

export function resolveRoomReferenceImages(): readonly RoomReferenceImage[] {
  const directory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "assets/generated/room-references",
  );
  return roomReferenceImageDefinitions.map((definition) => ({
    roomId: definition.roomId,
    label: definition.label,
    path: resolve(directory, definition.filename),
  }));
}
