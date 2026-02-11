export const TILE_TYPES = [
  {
    id: "grass",
    uiColor: "bg-green-500",
    phaserColor: 0x4caf50,
  },
  {
    id: "water",
    uiColor: "bg-blue-500",
    phaserColor: 0x2196f3,
  },
  {
    id: "stone",
    uiColor: "bg-gray-400",
    phaserColor: 0x9e9e9e,
  },
  {
    id: "sand",
    uiColor: "bg-yellow-400",
    phaserColor: 0xffeb3b,
  },
] as const;

export type TileType = (typeof TILE_TYPES)[number]["id"];

// Fast lookup for Phaser
export const TILE_TYPE_MAP: Record<TileType, { phaserColor: number }> =
  Object.fromEntries(
    TILE_TYPES.map((t) => [t.id, { phaserColor: t.phaserColor }])
  ) as Record<TileType, { phaserColor: number }>;
