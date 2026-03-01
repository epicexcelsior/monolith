import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

// ─── Block Appearance (nested schema) ─────────────────────
export class BlockAppearanceSchema extends Schema {
  color: string = "";
  emoji: string = "";
  name: string = "";
  style: number = 0;
  textureId: number = 0;
  imageUrl: string = "";
}

defineTypes(BlockAppearanceSchema, {
  color: "string",
  emoji: "string",
  name: "string",
  style: "uint8",
  textureId: "uint8",
  imageUrl: "string",
});

// ─── Block Schema ─────────────────────────────────────────
export class BlockSchema extends Schema {
  id: string = "";
  layer: number = 0;
  index: number = 0;
  energy: number = 0;
  owner: string = "";         // empty string = unclaimed (Schema doesn't support null)
  ownerColor: string = "";
  stakedAmount: number = 0;
  lastChargeTime: number = 0;
  streak: number = 0;
  lastStreakDate: string = "";
  imageIndex: number = 0;   // 0=none, 1-5=atlas slot
  appearance: BlockAppearanceSchema = new BlockAppearanceSchema();
}

defineTypes(BlockSchema, {
  id: "string",
  layer: "uint8",
  index: "uint8",
  energy: "float32",
  owner: "string",
  ownerColor: "string",
  stakedAmount: "uint32",
  lastChargeTime: "number",
  streak: "uint16",
  lastStreakDate: "string",
  imageIndex: "uint8",
  appearance: BlockAppearanceSchema,
});

// ─── Tower Stats ──────────────────────────────────────────
export class TowerStatsSchema extends Schema {
  totalBlocks: number = 0;
  occupiedBlocks: number = 0;
  activeUsers: number = 0;
  averageEnergy: number = 0;
}

defineTypes(TowerStatsSchema, {
  totalBlocks: "uint16",
  occupiedBlocks: "uint16",
  activeUsers: "uint8",
  averageEnergy: "float32",
});

// ─── Room State ───────────────────────────────────────────
export class TowerRoomState extends Schema {
  blocks: MapSchema<BlockSchema> = new MapSchema<BlockSchema>();
  stats: TowerStatsSchema = new TowerStatsSchema();
  tick: number = 0;
}

defineTypes(TowerRoomState, {
  blocks: { map: BlockSchema },
  stats: TowerStatsSchema,
  tick: "uint32",
});
