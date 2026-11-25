// What each augment does in a match. Keys are the fixed Augment ids that
// prisma/seed.ts writes to the database (the seed reads this table, so the
// two can't drift apart). Every augment in a player's loadout multiplies one
// stat for that whole match; copies of the same stat stack by multiplying.

export type AugmentRarity = "Common" | "Rare" | "Legendary";

/** Stats an augment can boost. `attackSpeed` shortens the time between hits. */
export type BoostedStat = "health" | "damage" | "attackSpeed" | "range" | "speed" | "manaRegen";

export interface AugmentDef {
  id: string;
  name: string;
  rarity: AugmentRarity;
  stat: BoostedStat;
  modifier: number; // 1.1 = +10%
}

// Expanded roster of 100 augments covering Silver (Common), Gold (Rare), and Legendary tiers
export const AUGMENTS: Record<string, AugmentDef> = {
  // --- Silver (Common): 42 augments ---
  aug_swift_boots: { id: "aug_swift_boots", name: "Swift Boots", rarity: "Common", stat: "speed", modifier: 1.05 },
  aug_iron_skin: { id: "aug_iron_skin", name: "Iron Skin", rarity: "Common", stat: "health", modifier: 1.1 },
  aug_quick_hands: { id: "aug_quick_hands", name: "Quick Hands", rarity: "Common", stat: "attackSpeed", modifier: 1.08 },
  aug_heavy_impact: { id: "aug_heavy_impact", name: "Heavy Impact", rarity: "Common", stat: "damage", modifier: 1.08 },
  aug_eagle_sight: { id: "aug_eagle_sight", name: "Eagle Sight", rarity: "Common", stat: "range", modifier: 1.08 },
  aug_spring_step: { id: "aug_spring_step", name: "Spring Step", rarity: "Common", stat: "speed", modifier: 1.07 },
  aug_slime_plating: { id: "aug_slime_plating", name: "Slime Plating", rarity: "Common", stat: "health", modifier: 1.12 },
  aug_rapid_jab: { id: "aug_rapid_jab", name: "Rapid Jab", rarity: "Common", stat: "attackSpeed", modifier: 1.1 },
  aug_liquid_trickle: { id: "aug_liquid_trickle", name: "Liquid Trickle", rarity: "Common", stat: "manaRegen", modifier: 1.08 },
  aug_padded_jersey: { id: "aug_padded_jersey", name: "Padded Jersey", rarity: "Common", stat: "health", modifier: 1.08 },
  aug_sticky_cleats: { id: "aug_sticky_cleats", name: "Sticky Cleats", rarity: "Common", stat: "speed", modifier: 1.06 },
  aug_sharp_studs: { id: "aug_sharp_studs", name: "Sharp Studs", rarity: "Common", stat: "damage", modifier: 1.06 },
  aug_field_scope: { id: "aug_field_scope", name: "Field Scope", rarity: "Common", stat: "range", modifier: 1.06 },
  aug_nimble_wrists: { id: "aug_nimble_wrists", name: "Nimble Wrists", rarity: "Common", stat: "attackSpeed", modifier: 1.06 },
  aug_drip_vial: { id: "aug_drip_vial", name: "Drip Vial", rarity: "Common", stat: "manaRegen", modifier: 1.06 },
  aug_gel_helmet: { id: "aug_gel_helmet", name: "Gel Helmet", rarity: "Common", stat: "health", modifier: 1.09 },
  aug_turf_dash: { id: "aug_turf_dash", name: "Turf Dash", rarity: "Common", stat: "speed", modifier: 1.08 },
  aug_knuckle_tape: { id: "aug_knuckle_tape", name: "Knuckle Tape", rarity: "Common", stat: "damage", modifier: 1.09 },
  aug_long_snap: { id: "aug_long_snap", name: "Long Snap", rarity: "Common", stat: "range", modifier: 1.07 },
  aug_hustle_cadence: { id: "aug_hustle_cadence", name: "Hustle Cadence", rarity: "Common", stat: "attackSpeed", modifier: 1.07 },
  aug_spare_flask: { id: "aug_spare_flask", name: "Spare Flask", rarity: "Common", stat: "manaRegen", modifier: 1.07 },
  aug_rubber_guard: { id: "aug_rubber_guard", name: "Rubber Guard", rarity: "Common", stat: "health", modifier: 1.11 },
  aug_light_stride: { id: "aug_light_stride", name: "Light Stride", rarity: "Common", stat: "speed", modifier: 1.09 },
  aug_brute_knuckles: { id: "aug_brute_knuckles", name: "Brute Knuckles", rarity: "Common", stat: "damage", modifier: 1.1 },
  aug_hawk_visor: { id: "aug_hawk_visor", name: "Hawk Visor", rarity: "Common", stat: "range", modifier: 1.09 },
  aug_snappy_swing: { id: "aug_snappy_swing", name: "Snappy Swing", rarity: "Common", stat: "attackSpeed", modifier: 1.09 },
  aug_ooze_sip: { id: "aug_ooze_sip", name: "Ooze Sip", rarity: "Common", stat: "manaRegen", modifier: 1.09 },
  aug_thick_goo: { id: "aug_thick_goo", name: "Thick Goo", rarity: "Common", stat: "health", modifier: 1.13 },
  aug_track_spikes: { id: "aug_track_spikes", name: "Track Spikes", rarity: "Common", stat: "speed", modifier: 1.1 },
  aug_hard_tackle: { id: "aug_hard_tackle", name: "Hard Tackle", rarity: "Common", stat: "damage", modifier: 1.11 },
  aug_spotter_lens: { id: "aug_spotter_lens", name: "Spotter Lens", rarity: "Common", stat: "range", modifier: 1.1 },
  aug_tempo_drill: { id: "aug_tempo_drill", name: "Tempo Drill", rarity: "Common", stat: "attackSpeed", modifier: 1.11 },
  aug_siphon_straw: { id: "aug_siphon_straw", name: "Siphon Straw", rarity: "Common", stat: "manaRegen", modifier: 1.1 },
  aug_core_brace: { id: "aug_core_brace", name: "Core Brace", rarity: "Common", stat: "health", modifier: 1.14 },
  aug_breeze_sole: { id: "aug_breeze_sole", name: "Breeze Sole", rarity: "Common", stat: "speed", modifier: 1.11 },
  aug_blitz_gloves: { id: "aug_blitz_gloves", name: "Blitz Gloves", rarity: "Common", stat: "damage", modifier: 1.12 },
  aug_watchtower_lens: { id: "aug_watchtower_lens", name: "Watchtower Lens", rarity: "Common", stat: "range", modifier: 1.11 },
  aug_double_clap: { id: "aug_double_clap", name: "Double Clap", rarity: "Common", stat: "attackSpeed", modifier: 1.12 },
  aug_steady_tap: { id: "aug_steady_tap", name: "Steady Tap", rarity: "Common", stat: "manaRegen", modifier: 1.11 },
  aug_chalk_grip: { id: "aug_chalk_grip", name: "Chalk Grip", rarity: "Common", stat: "damage", modifier: 1.13 },
  aug_sideline_sprint: { id: "aug_sideline_sprint", name: "Sideline Sprint", rarity: "Common", stat: "speed", modifier: 1.12 },
  aug_clear_goggles: { id: "aug_clear_goggles", name: "Clear Goggles", rarity: "Common", stat: "range", modifier: 1.12 },

  // --- Gold (Rare): 34 augments ---
  aug_mana_surge: { id: "aug_mana_surge", name: "Mana Surge", rarity: "Rare", stat: "manaRegen", modifier: 1.2 },
  aug_berserker_rage: { id: "aug_berserker_rage", name: "Berserker Rage", rarity: "Rare", stat: "damage", modifier: 1.25 },
  aug_eagle_eye: { id: "aug_eagle_eye", name: "Eagle Eye", rarity: "Rare", stat: "range", modifier: 1.15 },
  aug_iron_golem: { id: "aug_iron_golem", name: "Iron Golem", rarity: "Rare", stat: "health", modifier: 1.25 },
  aug_wind_stride: { id: "aug_wind_stride", name: "Wind Stride", rarity: "Rare", stat: "speed", modifier: 1.15 },
  aug_frenzy_strike: { id: "aug_frenzy_strike", name: "Frenzy Strike", rarity: "Rare", stat: "attackSpeed", modifier: 1.2 },
  aug_blast_flask: { id: "aug_blast_flask", name: "Blast Flask", rarity: "Rare", stat: "damage", modifier: 1.22 },
  aug_liquid_overflow: { id: "aug_liquid_overflow", name: "Liquid Overflow", rarity: "Rare", stat: "manaRegen", modifier: 1.22 },
  aug_steel_carapace: { id: "aug_steel_carapace", name: "Steel Carapace", rarity: "Rare", stat: "health", modifier: 1.22 },
  aug_gale_runners: { id: "aug_gale_runners", name: "Gale Runners", rarity: "Rare", stat: "speed", modifier: 1.16 },
  aug_falcon_scope: { id: "aug_falcon_scope", name: "Falcon Scope", rarity: "Rare", stat: "range", modifier: 1.17 },
  aug_flurry_fists: { id: "aug_flurry_fists", name: "Flurry Fists", rarity: "Rare", stat: "attackSpeed", modifier: 1.18 },
  aug_gold_kettle: { id: "aug_gold_kettle", name: "Gold Kettle", rarity: "Rare", stat: "manaRegen", modifier: 1.18 },
  aug_power_cleave: { id: "aug_power_cleave", name: "Power Cleave", rarity: "Rare", stat: "damage", modifier: 1.2 },
  aug_bastion_shell: { id: "aug_bastion_shell", name: "Bastion Shell", rarity: "Rare", stat: "health", modifier: 1.28 },
  aug_jet_cleats: { id: "aug_jet_cleats", name: "Jet Cleats", rarity: "Rare", stat: "speed", modifier: 1.18 },
  aug_longbow_string: { id: "aug_longbow_string", name: "Longbow String", rarity: "Rare", stat: "range", modifier: 1.19 },
  aug_whirlwind_arm: { id: "aug_whirlwind_arm", name: "Whirlwind Arm", rarity: "Rare", stat: "attackSpeed", modifier: 1.22 },
  aug_slime_geyser: { id: "aug_slime_geyser", name: "Slime Geyser", rarity: "Rare", stat: "manaRegen", modifier: 1.24 },
  aug_thunder_fist: { id: "aug_thunder_fist", name: "Thunder Fist", rarity: "Rare", stat: "damage", modifier: 1.24 },
  aug_granite_plate: { id: "aug_granite_plate", name: "Granite Plate", rarity: "Rare", stat: "health", modifier: 1.26 },
  aug_zephyr_dash: { id: "aug_zephyr_dash", name: "Zephyr Dash", rarity: "Rare", stat: "speed", modifier: 1.17 },
  aug_horizon_sight: { id: "aug_horizon_sight", name: "Horizon Sight", rarity: "Rare", stat: "range", modifier: 1.2 },
  aug_hyper_rhythm: { id: "aug_hyper_rhythm", name: "Hyper Rhythm", rarity: "Rare", stat: "attackSpeed", modifier: 1.24 },
  aug_alchemy_pump: { id: "aug_alchemy_pump", name: "Alchemy Pump", rarity: "Rare", stat: "manaRegen", modifier: 1.25 },
  aug_crushing_blow: { id: "aug_crushing_blow", name: "Crushing Blow", rarity: "Rare", stat: "damage", modifier: 1.27 },
  aug_reinforced_gel: { id: "aug_reinforced_gel", name: "Reinforced Gel", rarity: "Rare", stat: "health", modifier: 1.24 },
  aug_turbo_stride: { id: "aug_turbo_stride", name: "Turbo Stride", rarity: "Rare", stat: "speed", modifier: 1.19 },
  aug_marksman_crest: { id: "aug_marksman_crest", name: "Marksman Crest", rarity: "Rare", stat: "range", modifier: 1.22 },
  aug_blitz_cadence: { id: "aug_blitz_cadence", name: "Blitz Cadence", rarity: "Rare", stat: "attackSpeed", modifier: 1.25 },
  aug_tidal_reservoir: { id: "aug_tidal_reservoir", name: "Tidal Reservoir", rarity: "Rare", stat: "manaRegen", modifier: 1.26 },
  aug_venom_edge: { id: "aug_venom_edge", name: "Venom Edge", rarity: "Rare", stat: "damage", modifier: 1.28 },
  aug_aegis_coating: { id: "aug_aegis_coating", name: "Aegis Coating", rarity: "Rare", stat: "health", modifier: 1.27 },
  aug_sonic_heels: { id: "aug_sonic_heels", name: "Sonic Heels", rarity: "Rare", stat: "speed", modifier: 1.2 },

  // --- Legendary: 24 augments ---
  aug_titans_blessing: { id: "aug_titans_blessing", name: "Titan's Blessing", rarity: "Legendary", stat: "health", modifier: 1.5 },
  aug_phoenix_heart: { id: "aug_phoenix_heart", name: "Phoenix Heart", rarity: "Legendary", stat: "attackSpeed", modifier: 1.4 },
  aug_colossus_might: { id: "aug_colossus_might", name: "Colossus Might", rarity: "Legendary", stat: "damage", modifier: 1.45 },
  aug_celestial_wings: { id: "aug_celestial_wings", name: "Celestial Wings", rarity: "Legendary", stat: "speed", modifier: 1.25 },
  aug_infinite_current: { id: "aug_infinite_current", name: "Infinite Current", rarity: "Legendary", stat: "manaRegen", modifier: 1.4 },
  aug_snipers_perch: { id: "aug_snipers_perch", name: "Sniper's Perch", rarity: "Legendary", stat: "range", modifier: 1.35 },
  aug_immortal_ooze: { id: "aug_immortal_ooze", name: "Immortal Ooze", rarity: "Legendary", stat: "health", modifier: 1.45 },
  aug_godspeed_blitz: { id: "aug_godspeed_blitz", name: "Godspeed Blitz", rarity: "Legendary", stat: "speed", modifier: 1.28 },
  aug_meteor_strike: { id: "aug_meteor_strike", name: "Meteor Strike", rarity: "Legendary", stat: "damage", modifier: 1.5 },
  aug_orbital_aim: { id: "aug_orbital_aim", name: "Orbital Aim", rarity: "Legendary", stat: "range", modifier: 1.38 },
  aug_lightning_pulse: { id: "aug_lightning_pulse", name: "Lightning Pulse", rarity: "Legendary", stat: "attackSpeed", modifier: 1.42 },
  aug_arcane_fountain: { id: "aug_arcane_fountain", name: "Arcane Fountain", rarity: "Legendary", stat: "manaRegen", modifier: 1.45 },
  aug_leviathan_hide: { id: "aug_leviathan_hide", name: "Leviathan Hide", rarity: "Legendary", stat: "health", modifier: 1.55 },
  aug_phantom_step: { id: "aug_phantom_step", name: "Phantom Step", rarity: "Legendary", stat: "speed", modifier: 1.3 },
  aug_dragon_wrath: { id: "aug_dragon_wrath", name: "Dragon Wrath", rarity: "Legendary", stat: "damage", modifier: 1.52 },
  aug_starlight_scope: { id: "aug_starlight_scope", name: "Starlight Scope", rarity: "Legendary", stat: "range", modifier: 1.4 },
  aug_chrono_hands: { id: "aug_chrono_hands", name: "Chrono Hands", rarity: "Legendary", stat: "attackSpeed", modifier: 1.45 },
  aug_eternal_well: { id: "aug_eternal_well", name: "Eternal Well", rarity: "Legendary", stat: "manaRegen", modifier: 1.5 },
  aug_juggernaut_core: { id: "aug_juggernaut_core", name: "Juggernaut Core", rarity: "Legendary", stat: "health", modifier: 1.48 },
  aug_comet_charge: { id: "aug_comet_charge", name: "Comet Charge", rarity: "Legendary", stat: "speed", modifier: 1.26 },
  aug_apex_fury: { id: "aug_apex_fury", name: "Apex Fury", rarity: "Legendary", stat: "damage", modifier: 1.48 },
  aug_void_sight: { id: "aug_void_sight", name: "Void Sight", rarity: "Legendary", stat: "range", modifier: 1.36 },
  aug_tempest_barrage: { id: "aug_tempest_barrage", name: "Tempest Barrage", rarity: "Legendary", stat: "attackSpeed", modifier: 1.44 },
  aug_primordial_surge: { id: "aug_primordial_surge", name: "Primordial Surge", rarity: "Legendary", stat: "manaRegen", modifier: 1.42 },
};

const STAT_LABEL: Record<BoostedStat, string> = {
  health: "unit health",
  damage: "unit damage",
  attackSpeed: "attack speed",
  range: "attack range",
  speed: "move speed",
  manaRegen: "liquid regen",
};

const BOOSTED_STATS = Object.keys(STAT_LABEL) as BoostedStat[];

export type Modifiers = Record<BoostedStat, number>;

export const NO_MODIFIERS: Readonly<Modifiers> = Object.freeze(
  Object.fromEntries(BOOSTED_STATS.map((s) => [s, 1])) as Modifiers,
);

export function getAugment(id: string): AugmentDef | undefined {
  return Object.hasOwn(AUGMENTS, id) ? AUGMENTS[id] : undefined;
}

/** Combined multipliers for a loadout's augments. Unknown ids are ignored. */
export function combineAugments(augmentIds: string[]): Modifiers {
  const mods: Modifiers = { ...NO_MODIFIERS };
  for (const id of augmentIds) {
    const aug = getAugment(id);
    if (aug) mods[aug.stat] *= aug.modifier;
  }
  return mods;
}

const percent = (modifier: number) => `+${Math.round((modifier - 1) * 100)}%`;

/** "+10% unit health" — for one augment, or for a combined stat. */
export function describeBoost(stat: BoostedStat, modifier: number): string {
  return `${percent(modifier)} ${STAT_LABEL[stat]}`;
}

/** Player-facing text for one augment, e.g. "+10% unit health". Undefined for unknown ids. */
export function describeAugment(id: string): string | undefined {
  const aug = getAugment(id);
  return aug && describeBoost(aug.stat, aug.modifier);
}

/** One line per boosted stat, e.g. ["+65% unit health", "+25% unit damage"]. */
export function describeModifiers(mods: Modifiers): string[] {
  return BOOSTED_STATS.filter((s) => mods[s] !== 1).map((s) => describeBoost(s, mods[s]));
}

/**
 * Returns distinct augment options for in-match drafting:
 * - "silver": 3 Common augments for kickoff
 * - "gold_or_legendary": 3 Rare or Legendary augments for comeback after conceding
 */
export function getDraftOptions(
  tier: "silver" | "gold_or_legendary",
  count = 3,
  rng: () => number = Math.random,
): (AugmentDef & { effect: string })[] {
  const pool = Object.values(AUGMENTS).filter((a) =>
    tier === "silver" ? a.rarity === "Common" : a.rarity === "Rare" || a.rarity === "Legendary",
  );

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count).map((a) => ({
    ...a,
    effect: describeAugment(a.id) ?? "",
  }));
}
