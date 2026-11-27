import { ACTIVE_HAND_SIZE, LOADOUT_UNIT_SLOTS, TICK_RATE } from "./constants";

// Combat stats for each card. Keys are the fixed Card ids; prisma/seed.ts
// writes the Card rows (name, type, manaCost) from this table. The database
// says which cards a player owns; the numbers that decide a fight live here.

export type UnitType = "Melee" | "Ranged" | "Tank" | "Caster";
export type CardType = UnitType | "Spell" | "Tower";
export type MovementType = "walking" | "running" | "sliding" | "flying";

export interface UnitStats {
  cardId: string;
  name: string;
  type: UnitType;
  movement: MovementType;
  cost: number; // mana / sticky liquid
  health: number;
  damage: number; // per hit
  attackRange: number; // world units, centre to centre
  attackIntervalTicks: number; // ticks between hits
  speed: number; // world units per tick
  splashRadius: number; // 0 = single target; otherwise also hits enemies this close to the target
}

export interface SpellStats {
  cardId: string;
  name: string;
  type: "Spell";
  cost: number;
  radius: number;
  damage: number;
  slowFactor?: number;
  slowDurationTicks?: number;
  stunDurationTicks?: number;
}

export interface TowerStats {
  cardId: string;
  name: string;
  type: "Tower";
  cost: number;
  health: number;
  lifetimeTicks: number;
  attackRange: number;
  damage: number;
  attackIntervalTicks: number;
  splashRadius: number;
  tauntRadius?: number;
  slowFactor?: number;
  slowDurationTicks?: number;
}

const GLOBAL_SPEED_MULTIPLIER = 0.38; // global tuning: slower tactical movement across all troops
const perTick = (unitsPerSecond: number) => (unitsPerSecond * GLOBAL_SPEED_MULTIPLIER) / TICK_RATE;
const ticks = (seconds: number) => Math.round(seconds * TICK_RATE);

// Initial balanced roster of 8 sticky troops (towards 64 troops)
// Covering the four primary movement classes: walking, running, sliding, flying
export const UNIT_STATS: Record<string, UnitStats> = {
  // Cheap and quick: good for sneaking a score, loses any fair fight
  card_footsoldier: {
    cardId: "card_footsoldier",
    name: "Footsoldier",
    type: "Melee",
    movement: "walking",
    cost: 1,
    health: 60,
    damage: 8,
    attackRange: 30,
    attackIntervalTicks: ticks(0.8),
    speed: perTick(75),
    splashRadius: 0,
  },
  // Stops far from its target and shoots; dies quickly if reached
  card_archer: {
    cardId: "card_archer",
    name: "Archer",
    type: "Ranged",
    movement: "walking",
    cost: 2,
    health: 50,
    damage: 12,
    attackRange: 130,
    attackIntervalTicks: ticks(1.2),
    speed: perTick(55),
    splashRadius: 0,
  },
  // Slow wall of health that soaks damage for units behind it
  card_shield_bearer: {
    cardId: "card_shield_bearer",
    name: "Shield Bearer",
    type: "Tank",
    movement: "walking",
    cost: 3,
    health: 260,
    damage: 9,
    attackRange: 30,
    attackIntervalTicks: ticks(1),
    speed: perTick(40),
    splashRadius: 0,
  },
  // Big slow hits that also damage enemies bunched around the target
  card_battle_mage: {
    cardId: "card_battle_mage",
    name: "Battle Mage",
    type: "Caster",
    movement: "walking",
    cost: 4,
    health: 95,
    damage: 23,
    attackRange: 105,
    attackIntervalTicks: ticks(1.5),
    speed: perTick(48),
    splashRadius: 45,
  },
  // Low-friction skater: swift flanker with decent burst
  card_speed_skater: {
    cardId: "card_speed_skater",
    name: "Slime Skater",
    type: "Melee",
    movement: "sliding",
    cost: 2,
    health: 70,
    damage: 14,
    attackRange: 30,
    attackIntervalTicks: ticks(0.9),
    speed: perTick(95),
    splashRadius: 0,
  },
  // Super fast touchdown runner: sprints straight for the endzone
  card_sticky_runner: {
    cardId: "card_sticky_runner",
    name: "Touchdown Sprinter",
    type: "Melee",
    movement: "running",
    cost: 3,
    health: 85,
    damage: 10,
    attackRange: 30,
    attackIntervalTicks: ticks(0.7),
    speed: perTick(110),
    splashRadius: 0,
  },
  // Aerial troop: hovers over ground obstacles; ground melee cannot hit it
  card_bat_flyer: {
    cardId: "card_bat_flyer",
    name: "Sticky Bat",
    type: "Ranged",
    movement: "flying",
    cost: 3,
    health: 55,
    damage: 11,
    attackRange: 90,
    attackIntervalTicks: ticks(1.0),
    speed: perTick(65),
    splashRadius: 0,
  },
  // Aerial bomber: drops explosive sticky bombs from above
  card_glue_bomber: {
    cardId: "card_glue_bomber",
    name: "Glue Bomber",
    type: "Caster",
    movement: "flying",
    cost: 4,
    health: 65,
    damage: 22,
    attackRange: 80,
    attackIntervalTicks: ticks(1.6),
    speed: perTick(50),
    splashRadius: 40,
  },

  // --- Batch 2 Roster Additions (Expanding to 16 Troops) ---
  // High-burst sliding assassin: glides in for heavy strikes
  card_slime_ninja: {
    cardId: "card_slime_ninja",
    name: "Slime Ninja",
    type: "Melee",
    movement: "sliding",
    cost: 3,
    health: 85,
    damage: 28,
    attackRange: 30,
    attackIntervalTicks: ticks(0.9),
    speed: perTick(100),
    splashRadius: 0,
  },
  // Aerial brawler: swoops down from above onto enemy units
  card_sky_valkyrie: {
    cardId: "card_sky_valkyrie",
    name: "Sky Valkyrie",
    type: "Melee",
    movement: "flying",
    cost: 4,
    health: 140,
    damage: 26,
    attackRange: 35,
    attackIntervalTicks: ticks(1.1),
    speed: perTick(75),
    splashRadius: 0,
  },
  // Massive monolithic blocker: soaks unbelievable punishment
  card_tar_golem: {
    cardId: "card_tar_golem",
    name: "Tar Golem",
    type: "Tank",
    movement: "walking",
    cost: 5,
    health: 360,
    damage: 14,
    attackRange: 30,
    attackIntervalTicks: ticks(1.4),
    speed: perTick(28),
    splashRadius: 0,
  },
  // Armored running back: sprints into defenders with momentum
  card_blitz_rusher: {
    cardId: "card_blitz_rusher",
    name: "Blitz Rusher",
    type: "Tank",
    movement: "running",
    cost: 4,
    health: 180,
    damage: 16,
    attackRange: 30,
    attackIntervalTicks: ticks(0.9),
    speed: perTick(95),
    splashRadius: 0,
  },
  // Rapid sting aerial harasser: rapid-fire dart shooter
  card_spitfire_wasp: {
    cardId: "card_spitfire_wasp",
    name: "Spitfire Wasp",
    type: "Ranged",
    movement: "flying",
    cost: 2,
    health: 42,
    damage: 6,
    attackRange: 100,
    attackIntervalTicks: ticks(0.5),
    speed: perTick(75),
    splashRadius: 0,
  },
  // Sliding ice mage: delivers freezing splash projectiles at range
  card_frost_slider: {
    cardId: "card_frost_slider",
    name: "Frost Slider",
    type: "Caster",
    movement: "sliding",
    cost: 4,
    health: 70,
    damage: 18,
    attackRange: 110,
    attackIntervalTicks: ticks(1.3),
    speed: perTick(80),
    splashRadius: 38,
  },
  // Defensive gridiron stopper: built to tackle opposing sprinters
  card_linebacker: {
    cardId: "card_linebacker",
    name: "Sticky Linebacker",
    type: "Melee",
    movement: "running",
    cost: 3,
    health: 150,
    damage: 22,
    attackRange: 30,
    attackIntervalTicks: ticks(1.0),
    speed: perTick(80),
    splashRadius: 0,
  },
  // Long-range sniper: launches corrosive sticky darts
  card_acid_spitter: {
    cardId: "card_acid_spitter",
    name: "Acid Spitter",
    type: "Ranged",
    movement: "walking",
    cost: 3,
    health: 60,
    damage: 14,
    attackRange: 135,
    attackIntervalTicks: ticks(1.1),
    speed: perTick(48),
    splashRadius: 0,
  },

  // --- Batch 3: Troops 17-32 (Gridiron Specialists & Tactical Classes) ---
  card_quarterback: {
    cardId: "card_quarterback",
    name: "Quarterback",
    type: "Ranged",
    movement: "running",
    cost: 4,
    health: 90,
    damage: 24,
    attackRange: 160,
    attackIntervalTicks: ticks(1.3),
    speed: perTick(85),
    splashRadius: 0,
  },
  card_wide_receiver: {
    cardId: "card_wide_receiver",
    name: "Wide Receiver",
    type: "Melee",
    movement: "running",
    cost: 2,
    health: 55,
    damage: 12,
    attackRange: 30,
    attackIntervalTicks: ticks(0.6),
    speed: perTick(115),
    splashRadius: 0,
  },
  card_center_guard: {
    cardId: "card_center_guard",
    name: "Center Guard",
    type: "Tank",
    movement: "walking",
    cost: 4,
    health: 280,
    damage: 10,
    attackRange: 30,
    attackIntervalTicks: ticks(1.1),
    speed: perTick(32),
    splashRadius: 0,
  },
  card_referee: {
    cardId: "card_referee",
    name: "Referee",
    type: "Caster",
    movement: "walking",
    cost: 3,
    health: 70,
    damage: 14,
    attackRange: 90,
    attackIntervalTicks: ticks(1.2),
    speed: perTick(60),
    splashRadius: 35,
  },
  card_cheerleader: {
    cardId: "card_cheerleader",
    name: "Cheerleader",
    type: "Caster",
    movement: "running",
    cost: 2,
    health: 55,
    damage: 10,
    attackRange: 95,
    attackIntervalTicks: ticks(0.8),
    speed: perTick(90),
    splashRadius: 30,
  },
  card_cornerback: {
    cardId: "card_cornerback",
    name: "Cornerback",
    type: "Melee",
    movement: "running",
    cost: 3,
    health: 110,
    damage: 18,
    attackRange: 30,
    attackIntervalTicks: ticks(0.9),
    speed: perTick(100),
    splashRadius: 0,
  },
  card_halfback: {
    cardId: "card_halfback",
    name: "Halfback",
    type: "Melee",
    movement: "sliding",
    cost: 3,
    health: 120,
    damage: 16,
    attackRange: 30,
    attackIntervalTicks: ticks(0.8),
    speed: perTick(90),
    splashRadius: 0,
  },
  card_safety: {
    cardId: "card_safety",
    name: "Safety",
    type: "Ranged",
    movement: "running",
    cost: 3,
    health: 75,
    damage: 13,
    attackRange: 120,
    attackIntervalTicks: ticks(1.0),
    speed: perTick(90),
    splashRadius: 0,
  },
  card_tight_end: {
    cardId: "card_tight_end",
    name: "Tight End",
    type: "Tank",
    movement: "running",
    cost: 5,
    health: 220,
    damage: 24,
    attackRange: 35,
    attackIntervalTicks: ticks(1.0),
    speed: perTick(75),
    splashRadius: 0,
  },
  card_kicker: {
    cardId: "card_kicker",
    name: "Kicker",
    type: "Ranged",
    movement: "walking",
    cost: 2,
    health: 40,
    damage: 18,
    attackRange: 155,
    attackIntervalTicks: ticks(1.8),
    speed: perTick(40),
    splashRadius: 0,
  },
  card_punter: {
    cardId: "card_punter",
    name: "Punter",
    type: "Caster",
    movement: "walking",
    cost: 3,
    health: 60,
    damage: 16,
    attackRange: 150,
    attackIntervalTicks: ticks(1.5),
    speed: perTick(45),
    splashRadius: 45,
  },
  card_sky_falcon: {
    cardId: "card_sky_falcon",
    name: "Sky Falcon",
    type: "Melee",
    movement: "flying",
    cost: 3,
    health: 75,
    damage: 19,
    attackRange: 30,
    attackIntervalTicks: ticks(0.8),
    speed: perTick(95),
    splashRadius: 0,
  },
  card_aerial_drone: {
    cardId: "card_aerial_drone",
    name: "Aerial Drone",
    type: "Ranged",
    movement: "flying",
    cost: 4,
    health: 90,
    damage: 15,
    attackRange: 120,
    attackIntervalTicks: ticks(0.7),
    speed: perTick(65),
    splashRadius: 0,
  },
  card_storm_cloud: {
    cardId: "card_storm_cloud",
    name: "Storm Cloud",
    type: "Caster",
    movement: "flying",
    cost: 5,
    health: 110,
    damage: 28,
    attackRange: 90,
    attackIntervalTicks: ticks(1.5),
    speed: perTick(55),
    splashRadius: 55,
  },
  card_ice_striker: {
    cardId: "card_ice_striker",
    name: "Ice Striker",
    type: "Melee",
    movement: "sliding",
    cost: 4,
    health: 130,
    damage: 32,
    attackRange: 30,
    attackIntervalTicks: ticks(1.0),
    speed: perTick(95),
    splashRadius: 0,
  },
  card_glacier_turtle: {
    cardId: "card_glacier_turtle",
    name: "Glacier Turtle",
    type: "Tank",
    movement: "sliding",
    cost: 4,
    health: 260,
    damage: 8,
    attackRange: 30,
    attackIntervalTicks: ticks(1.2),
    speed: perTick(50),
    splashRadius: 0,
  },

  // --- Batch 4: Troops 33-48 (Slime Mutations & Goo Aberrations) ---
  card_slime_puppy: {
    cardId: "card_slime_puppy",
    name: "Slime Puppy",
    type: "Melee",
    movement: "running",
    cost: 1,
    health: 40,
    damage: 7,
    attackRange: 30,
    attackIntervalTicks: ticks(0.5),
    speed: perTick(105),
    splashRadius: 0,
  },
  card_toxic_crawler: {
    cardId: "card_toxic_crawler",
    name: "Toxic Crawler",
    type: "Melee",
    movement: "walking",
    cost: 2,
    health: 75,
    damage: 14,
    attackRange: 30,
    attackIntervalTicks: ticks(0.8),
    speed: perTick(60),
    splashRadius: 0,
  },
  card_ooze_lobber: {
    cardId: "card_ooze_lobber",
    name: "Ooze Lobber",
    type: "Caster",
    movement: "walking",
    cost: 3,
    health: 65,
    damage: 17,
    attackRange: 120,
    attackIntervalTicks: ticks(1.4),
    speed: perTick(50),
    splashRadius: 40,
  },
  card_sludge_bruiser: {
    cardId: "card_sludge_bruiser",
    name: "Sludge Bruiser",
    type: "Melee",
    movement: "walking",
    cost: 4,
    health: 200,
    damage: 25,
    attackRange: 30,
    attackIntervalTicks: ticks(1.1),
    speed: perTick(45),
    splashRadius: 0,
  },
  card_sticky_spider: {
    cardId: "card_sticky_spider",
    name: "Sticky Spider",
    type: "Melee",
    movement: "walking",
    cost: 3,
    health: 90,
    damage: 16,
    attackRange: 30,
    attackIntervalTicks: ticks(0.7),
    speed: perTick(80),
    splashRadius: 0,
  },
  card_plasma_wisp: {
    cardId: "card_plasma_wisp",
    name: "Plasma Wisp",
    type: "Ranged",
    movement: "flying",
    cost: 1,
    health: 30,
    damage: 8,
    attackRange: 100,
    attackIntervalTicks: ticks(0.9),
    speed: perTick(85),
    splashRadius: 0,
  },
  card_bog_behemoth: {
    cardId: "card_bog_behemoth",
    name: "Bog Behemoth",
    type: "Tank",
    movement: "walking",
    cost: 6,
    health: 380,
    damage: 18,
    attackRange: 35,
    attackIntervalTicks: ticks(1.5),
    speed: perTick(25),
    splashRadius: 0,
  },
  card_glue_mortar: {
    cardId: "card_glue_mortar",
    name: "Glue Mortar",
    type: "Caster",
    movement: "walking",
    cost: 5,
    health: 95,
    damage: 35,
    attackRange: 160,
    attackIntervalTicks: ticks(2.0),
    speed: perTick(35),
    splashRadius: 60,
  },
  card_mud_slider: {
    cardId: "card_mud_slider",
    name: "Mud Slider",
    type: "Melee",
    movement: "sliding",
    cost: 2,
    health: 65,
    damage: 13,
    attackRange: 30,
    attackIntervalTicks: ticks(0.8),
    speed: perTick(90),
    splashRadius: 0,
  },
  card_tar_dragon: {
    cardId: "card_tar_dragon",
    name: "Tar Dragon",
    type: "Caster",
    movement: "flying",
    cost: 6,
    health: 210,
    damage: 32,
    attackRange: 100,
    attackIntervalTicks: ticks(1.4),
    speed: perTick(60),
    splashRadius: 50,
  },
  card_gargoyle: {
    cardId: "card_gargoyle",
    name: "Gargoyle",
    type: "Tank",
    movement: "flying",
    cost: 5,
    health: 300,
    damage: 19,
    attackRange: 30,
    attackIntervalTicks: ticks(1.2),
    speed: perTick(45),
    splashRadius: 0,
  },
  card_harpy: {
    cardId: "card_harpy",
    name: "Harpy",
    type: "Melee",
    movement: "flying",
    cost: 2,
    health: 48,
    damage: 14,
    attackRange: 30,
    attackIntervalTicks: ticks(0.7),
    speed: perTick(90),
    splashRadius: 0,
  },
  card_frost_weaver: {
    cardId: "card_frost_weaver",
    name: "Frost Weaver",
    type: "Caster",
    movement: "walking",
    cost: 3,
    health: 70,
    damage: 15,
    attackRange: 110,
    attackIntervalTicks: ticks(1.3),
    speed: perTick(52),
    splashRadius: 35,
  },
  card_dart_goblin: {
    cardId: "card_dart_goblin",
    name: "Dart Goblin",
    type: "Ranged",
    movement: "running",
    cost: 2,
    health: 38,
    damage: 8,
    attackRange: 120,
    attackIntervalTicks: ticks(0.6),
    speed: perTick(100),
    splashRadius: 0,
  },
  card_iron_slug: {
    cardId: "card_iron_slug",
    name: "Iron Slug",
    type: "Tank",
    movement: "sliding",
    cost: 3,
    health: 210,
    damage: 9,
    attackRange: 30,
    attackIntervalTicks: ticks(1.3),
    speed: perTick(45),
    splashRadius: 0,
  },
  card_lightning_rod: {
    cardId: "card_lightning_rod",
    name: "Lightning Rod",
    type: "Caster",
    movement: "running",
    cost: 4,
    health: 85,
    damage: 26,
    attackRange: 85,
    attackIntervalTicks: ticks(1.0),
    speed: perTick(95),
    splashRadius: 40,
  },

  // --- Batch 5: Troops 49-64 (Mythic Legends & Endzone Enforcers) ---
  card_titan_linebacker: {
    cardId: "card_titan_linebacker",
    name: "Titan Linebacker",
    type: "Tank",
    movement: "running",
    cost: 5,
    health: 250,
    damage: 28,
    attackRange: 30,
    attackIntervalTicks: ticks(1.1),
    speed: perTick(80),
    splashRadius: 0,
  },
  card_stealth_skater: {
    cardId: "card_stealth_skater",
    name: "Stealth Skater",
    type: "Melee",
    movement: "sliding",
    cost: 3,
    health: 80,
    damage: 26,
    attackRange: 30,
    attackIntervalTicks: ticks(0.8),
    speed: perTick(105),
    splashRadius: 0,
  },
  card_sky_phoenix: {
    cardId: "card_sky_phoenix",
    name: "Sky Phoenix",
    type: "Caster",
    movement: "flying",
    cost: 5,
    health: 120,
    damage: 27,
    attackRange: 110,
    attackIntervalTicks: ticks(1.2),
    speed: perTick(70),
    splashRadius: 45,
  },
  card_voodoo_witch: {
    cardId: "card_voodoo_witch",
    name: "Voodoo Witch",
    type: "Caster",
    movement: "walking",
    cost: 4,
    health: 75,
    damage: 21,
    attackRange: 130,
    attackIntervalTicks: ticks(1.2),
    speed: perTick(50),
    splashRadius: 40,
  },
  card_shadow_assassin: {
    cardId: "card_shadow_assassin",
    name: "Shadow Assassin",
    type: "Melee",
    movement: "running",
    cost: 4,
    health: 95,
    damage: 34,
    attackRange: 30,
    attackIntervalTicks: ticks(0.8),
    speed: perTick(110),
    splashRadius: 0,
  },
  card_crystal_archer: {
    cardId: "card_crystal_archer",
    name: "Crystal Archer",
    type: "Ranged",
    movement: "walking",
    cost: 4,
    health: 80,
    damage: 22,
    attackRange: 150,
    attackIntervalTicks: ticks(1.1),
    speed: perTick(50),
    splashRadius: 0,
  },
  card_magma_golem: {
    cardId: "card_magma_golem",
    name: "Magma Golem",
    type: "Tank",
    movement: "walking",
    cost: 5,
    health: 310,
    damage: 20,
    attackRange: 30,
    attackIntervalTicks: ticks(1.3),
    speed: perTick(30),
    splashRadius: 30,
  },
  card_zephyr_scout: {
    cardId: "card_zephyr_scout",
    name: "Zephyr Scout",
    type: "Ranged",
    movement: "flying",
    cost: 3,
    health: 58,
    damage: 13,
    attackRange: 110,
    attackIntervalTicks: ticks(0.8),
    speed: perTick(80),
    splashRadius: 0,
  },
  card_ice_breaker: {
    cardId: "card_ice_breaker",
    name: "Ice Breaker",
    type: "Melee",
    movement: "running",
    cost: 4,
    health: 160,
    damage: 25,
    attackRange: 30,
    attackIntervalTicks: ticks(0.9),
    speed: perTick(88),
    splashRadius: 0,
  },
  card_slime_cannon: {
    cardId: "card_slime_cannon",
    name: "Slime Cannon",
    type: "Ranged",
    movement: "walking",
    cost: 5,
    health: 110,
    damage: 32,
    attackRange: 170,
    attackIntervalTicks: ticks(1.7),
    speed: perTick(35),
    splashRadius: 0,
  },
  card_sonic_bat: {
    cardId: "card_sonic_bat",
    name: "Sonic Bat",
    type: "Ranged",
    movement: "flying",
    cost: 4,
    health: 72,
    damage: 18,
    attackRange: 95,
    attackIntervalTicks: ticks(0.9),
    speed: perTick(70),
    splashRadius: 30,
  },
  card_whirlwind_dervish: {
    cardId: "card_whirlwind_dervish",
    name: "Whirlwind Dervish",
    type: "Melee",
    movement: "sliding",
    cost: 3,
    health: 90,
    damage: 20,
    attackRange: 30,
    attackIntervalTicks: ticks(0.7),
    speed: perTick(95),
    splashRadius: 25,
  },
  card_abyssal_warden: {
    cardId: "card_abyssal_warden",
    name: "Abyssal Warden",
    type: "Tank",
    movement: "walking",
    cost: 4,
    health: 240,
    damage: 12,
    attackRange: 30,
    attackIntervalTicks: ticks(1.0),
    speed: perTick(40),
    splashRadius: 0,
  },
  card_inferno_imp: {
    cardId: "card_inferno_imp",
    name: "Inferno Imp",
    type: "Ranged",
    movement: "running",
    cost: 1,
    health: 35,
    damage: 9,
    attackRange: 90,
    attackIntervalTicks: ticks(0.7),
    speed: perTick(105),
    splashRadius: 0,
  },
  card_sky_dreadnought: {
    cardId: "card_sky_dreadnought",
    name: "Sky Dreadnought",
    type: "Tank",
    movement: "flying",
    cost: 6,
    health: 290,
    damage: 22,
    attackRange: 40,
    attackIntervalTicks: ticks(1.3),
    speed: perTick(38),
    splashRadius: 35,
  },
  card_touchdown_god: {
    cardId: "card_touchdown_god",
    name: "Touchdown God",
    type: "Melee",
    movement: "running",
    cost: 6,
    health: 260,
    damage: 35,
    attackRange: 30,
    attackIntervalTicks: ticks(0.9),
    speed: perTick(100),
    splashRadius: 0,
  },
};

export const SPELL_STATS: Record<string, SpellStats> = {
  card_sticky_bomb: {
    cardId: "card_sticky_bomb",
    name: "Sticky Bomb",
    type: "Spell",
    cost: 3,
    radius: 75,
    damage: 55,
  },
  card_zap_shock: {
    cardId: "card_zap_shock",
    name: "Zap Shock",
    type: "Spell",
    cost: 2,
    radius: 65,
    damage: 25,
    stunDurationTicks: ticks(1.2),
  },
  card_glue_freeze: {
    cardId: "card_glue_freeze",
    name: "Glue Freeze",
    type: "Spell",
    cost: 3,
    radius: 85,
    damage: 12,
    slowFactor: 0.4,
    slowDurationTicks: ticks(3.0),
  },
};

export const TOWER_STATS: Record<string, TowerStats> = {
  card_magnet_tower: {
    cardId: "card_magnet_tower",
    name: "Magnet Tower",
    type: "Tower",
    cost: 3,
    health: 320,
    lifetimeTicks: 600, // 20s
    attackRange: 135,
    damage: 6,
    attackIntervalTicks: 36, // 1.2s
    splashRadius: 0,
    tauntRadius: 135,
  },
  card_glue_cannon: {
    cardId: "card_glue_cannon",
    name: "Glue Cannon",
    type: "Tower",
    cost: 4,
    health: 260,
    lifetimeTicks: 600, // 20s
    attackRange: 150,
    damage: 16,
    attackIntervalTicks: 33, // 1.1s
    splashRadius: 35,
    slowFactor: 0.7,
    slowDurationTicks: ticks(1.5),
  },
};

/** Every new player owns these 8 cards, serving as the complete starter deck. */
export const DEFAULT_HAND = Object.keys(UNIT_STATS).slice(0, LOADOUT_UNIT_SLOTS);

export function getUnitStats(cardId: unknown): UnitStats | undefined {
  return typeof cardId === "string" && Object.hasOwn(UNIT_STATS, cardId) ? UNIT_STATS[cardId] : undefined;
}

export function getSpellStats(cardId: unknown): SpellStats | undefined {
  return typeof cardId === "string" && Object.hasOwn(SPELL_STATS, cardId) ? SPELL_STATS[cardId] : undefined;
}

export function getTowerStats(cardId: unknown): TowerStats | undefined {
  return typeof cardId === "string" && Object.hasOwn(TOWER_STATS, cardId) ? TOWER_STATS[cardId] : undefined;
}

export function isSpellCard(cardId: unknown): boolean {
  return getSpellStats(cardId) !== undefined;
}

export function isTowerCard(cardId: unknown): boolean {
  return getTowerStats(cardId) !== undefined;
}

export function getCardStats(cardId: unknown): UnitStats | SpellStats | TowerStats | undefined {
  return getUnitStats(cardId) ?? getSpellStats(cardId) ?? getTowerStats(cardId);
}

/**
 * Resolves the full deck of up to 8 cards (troops + spells).
 * An empty result falls back to DEFAULT_HAND.
 */
export function resolveDeck(unitIds: string[]): string[] {
  const deck = [...new Set(unitIds)].filter((id) => getCardStats(id)).slice(0, LOADOUT_UNIT_SLOTS);
  return deck.length ? deck : [...DEFAULT_HAND];
}

/**
 * Returns active hand cards (first ACTIVE_HAND_SIZE cards) and draw queue.
 */
export function resolveHand(unitIds: string[]): { hand: string[]; drawQueue: string[] } {
  const deck = resolveDeck(unitIds);
  return {
    hand: deck.slice(0, ACTIVE_HAND_SIZE),
    drawQueue: deck.slice(ACTIVE_HAND_SIZE),
  };
}

/**
 * Samples a random subset of cards (e.g. 4 cards for pre-match opponent scouting).
 */
export function sampleRandomCards(deck: string[], count = 4, rng: () => number = Math.random): string[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

/** What the client needs to draw a card in the hand. */
export function handCardInfo(cardId: string) {
  const spell = getSpellStats(cardId);
  if (spell) {
    return { cardId: spell.cardId, name: spell.name, type: spell.type, cost: spell.cost };
  }
  const tower = getTowerStats(cardId);
  if (tower) {
    return { cardId: tower.cardId, name: tower.name, type: tower.type, cost: tower.cost };
  }
  const s = UNIT_STATS[cardId];
  return { cardId: s.cardId, name: s.name, type: s.type, movement: s.movement, cost: s.cost };
}
