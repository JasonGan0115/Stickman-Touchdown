# Touchdown PVP - Master Development Roadmap

This roadmap codifies the game design and mechanics specified in `Idea.txt` and expands them into a full production backlog covering core mechanics, troop archetypes, visual polish, in-match augment drafts, and testing.

---

## 🏈 Vision & Core Pillars
1. **High-Speed Tactical Football/PVP**: Summon sticky troops onto a 9:16 gridiron to push into the enemy touchdown zone.
2. **First to 3 Wins**: Each touchdown scores 1 point, resets the pitch with 5 Sticky Liquid, and restarts the drive.
3. **Sticky Liquid Management**: Start with 3 Sticky Liquid, generate 1 per second (max 10), with a mandatory 2-second troop placement cooldown.
4. **8-Troop Deck with Card Cycling**: Players bring 8 sticky troops into battle; 4 are active in hand, and cards rotate upon use.
5. **Dynamic Augment Drafting**:
   - Pre-match: Preview 4 random opponent troops, then both players draft a **Silver Augment**.
   - Comeback mechanic: Losing a point grants the conceding player a choice of higher-tier augment (**Gold / Legendary**).
   - Augments expire after 24 hours of acquisition.
6. **64 Unique Sticky Troops**: Varied movement classes (**Walking, Running, Sliding, Flying**) with distinct combat playstyles.

---

## 🗺️ Phases & Milestones

### Phase 1: Core Mechanics Alignment with `Idea.txt` *(COMPLETED)*
- [x] **1.1 Sticky Liquid System**
  - Updated starting liquid from 0 to 3.
  - Constant 1 liquid / second generation (max 10).
  - Sticky Liquid branding and meter UI across server and client.
- [x] **1.2 Touchdown Round Reset & First to 3**
  - Scoring a touchdown awards 1 point, wipes active field entities, resets both players' liquid to 5, and triggers the celebration banner.
  - First player to 3 points wins the match immediately (`WINNING_SCORE = 3`).
- [x] **1.3 2-Second Summon Cooldown**
  - Global placement cooldown timer of 2.0s after dropping any troop, preventing spam and enforcing tactical timing.
  - Client visual cooldown indicator with countdown overlay on troop cards.
- [x] **1.4 8-Troop Deck with Clash-Style Card Cycling**
  - Increased loadout unit capacity from 4 to 8.
  - Active hand displays 4 troops at a time with a dedicated "NEXT" card queue preview.
  - When a troop is deployed, the 5th troop in the cycle enters the hand, and the deployed troop rotates to the back of the 8-card queue.

---

### Phase 2: Movement Archetypes & Troop Roster (Path to 64 Troops) *(PHASE 1 BATCH COMPLETE)*
- [x] **2.1 Movement Archetypes Engine**
  - **Walking**: Standard pace and lane engagement.
  - **Running**: High-speed sprinters (Touchdown Sprinter) that rapidly push for the endzone.
  - **Sliding**: Low-friction swift gliders (Slime Skater).
  - **Flying**: Aerial units (Sticky Bat, Glue Bomber) that hover above ground units; ground melee cannot hit flying units.
- [x] **2.2 Initial 8 Sticky Troops Roster**
  - Implemented complete 8-troop starter deck covering all 4 movement classes:
    1. `card_footsoldier`: Melee / Walking (cost 1)
    2. `card_archer`: Ranged / Walking (cost 2)
    3. `card_shield_bearer`: Tank / Walking (cost 3)
    4. `card_battle_mage`: Caster / Walking (cost 4, AOE)
    5. `card_speed_skater`: Melee / Sliding (cost 2)
    6. `card_sticky_runner`: Melee / Running (cost 3, high speed)
    7. `card_bat_flyer`: Ranged / Flying (cost 3)
    8. `card_glue_bomber`: Caster / Flying (cost 4, aerial AOE)
- [x] **2.3 Stickman Animation & Visual Variants**
  - Flying units feature aerial wings and elevated ground shadow.
  - Running units feature an aggressive forward stride.
  - Sliding units feature slide runners.
- [x] **2.4 Complete 64 Sticky Troops Catalog (Batches 2 through 5)**
  - Fully implemented all 64 unique sticky troops across 4 movement archetypes (Walking, Running, Sliding, Flying) and 4 combat roles (Melee, Ranged, Tank, Caster):
    - **Batch 2 (Troops 9-16)**:
      9. `card_slime_ninja`: Melee / Sliding (cost 3, fast flanker)
      10. `card_sky_valkyrie`: Melee / Flying (cost 4, aerial dive attacker)
      11. `card_tar_golem`: Tank / Walking (cost 5, colossal 360 HP heavy shield)
      12. `card_blitz_rusher`: Tank / Running (cost 4, high-speed armored charger)
      13. `card_spitfire_wasp`: Ranged / Flying (cost 2, swift aerial harasser)
      14. `card_frost_slider`: Caster / Sliding (cost 4, slick ice magic splash)
      15. `card_linebacker`: Melee / Running (cost 3, fierce running tackler)
      16. `card_acid_spitter`: Ranged / Walking (cost 3, corrosive spit)
    - **Batch 3 (Troops 17-32, Gridiron Specialists & Tactical Classes)**:
      17. `card_quarterback`: Ranged / Running (cost 4, deep sideline passer)
      18. `card_wide_receiver`: Melee / Running (cost 2, ultra-fast breakaway runner)
      19. `card_center_guard`: Tank / Walking (cost 4, immovable frontline blocker)
      20. `card_referee`: Caster / Walking (cost 3, magical whistle shockwave)
      21. `card_cheerleader`: Caster / Running (cost 2, spirited wave caster)
      22. `card_cornerback`: Melee / Running (cost 3, lockdown coverage tackler)
      23. `card_halfback`: Melee / Sliding (cost 3, slippery tackle breaker)
      24. `card_safety`: Ranged / Running (cost 3, deep backfield interceptor)
      25. `card_tight_end`: Tank / Running (cost 5, heavy offensive hybrid)
      26. `card_kicker`: Ranged / Walking (cost 2, ultra long-range sniper)
      27. `card_punter`: Caster / Walking (cost 3, high-arc artillery blast)
      28. `card_sky_falcon`: Melee / Flying (cost 3, high-speed aerial raptor)
      29. `card_aerial_drone`: Ranged / Flying (cost 4, rapid laser flyer)
      30. `card_storm_cloud`: Caster / Flying (cost 5, electrical tempest storm)
      31. `card_ice_striker`: Melee / Sliding (cost 4, bladed skate slasher)
      32. `card_glacier_turtle`: Tank / Sliding (cost 4, sliding frozen shell)
    - **Batch 4 (Troops 33-48, Slime Mutations & Goo Aberrations)**:
      33. `card_slime_puppy`: Melee / Running (cost 1, cheap fast distractor)
      34. `card_toxic_crawler`: Melee / Walking (cost 2, venomous multi-leg striker)
      35. `card_ooze_lobber`: Caster / Walking (cost 3, toxic glob lobber)
      36. `card_sludge_bruiser`: Melee / Walking (cost 4, heavy mud brawler)
      37. `card_sticky_spider`: Melee / Walking (cost 3, swarming lane trapper)
      38. `card_plasma_wisp`: Ranged / Flying (cost 1, cheap floating scout)
      39. `card_bog_behemoth`: Tank / Walking (cost 6, colossal 380 HP titan)
      40. `card_glue_mortar`: Caster / Walking (cost 5, giant glue siege mortar)
      41. `card_mud_slider`: Melee / Sliding (cost 2, slippery mud skimmer)
      42. `card_tar_dragon`: Caster / Flying (cost 6, mythical tar-fire drake)
      43. `card_gargoyle`: Tank / Flying (cost 5, heavy flying stone tank)
      44. `card_harpy`: Melee / Flying (cost 2, winged dive harasser)
      45. `card_frost_weaver`: Caster / Walking (cost 3, slowing ice web spinner)
      46. `card_dart_goblin`: Ranged / Running (cost 2, rapid blowpipe gunner)
      47. `card_iron_slug`: Tank / Sliding (cost 3, armored sliding mollusk)
      48. `card_lightning_rod`: Caster / Running (cost 4, charged shock runner)
    - **Batch 5 (Troops 49-64, Mythic Legends & Endzone Enforcers)**:
      49. `card_titan_linebacker`: Tank / Running (cost 5, all-pro run stopper)
      50. `card_stealth_skater`: Melee / Sliding (cost 3, elusive assassin)
      51. `card_sky_phoenix`: Caster / Flying (cost 5, solar blast mythical bird)
      52. `card_voodoo_witch`: Caster / Walking (cost 4, backfield curse chanter)
      53. `card_shadow_assassin`: Melee / Running (cost 4, high-damage burst blade)
      54. `card_crystal_archer`: Ranged / Walking (cost 4, crystalline piercing bow)
      55. `card_magma_golem`: Tank / Walking (cost 5, burning cleaving colossus)
      56. `card_zephyr_scout`: Ranged / Flying (cost 3, aerial target picker)
      57. `card_ice_breaker`: Melee / Running (cost 4, line-smashing runner)
      58. `card_slime_cannon`: Ranged / Walking (cost 5, heavy artillery cannon)
      59. `card_sonic_bat`: Ranged / Flying (cost 4, ultrasonic pulse flyer)
      60. `card_whirlwind_dervish`: Melee / Sliding (cost 3, spinning blade skater)
      61. `card_abyssal_warden`: Tank / Walking (cost 4, deep void guardian)
      62. `card_inferno_imp`: Ranged / Running (cost 1, quick fire-dart imp)
      63. `card_sky_dreadnought`: Tank / Flying (cost 6, flying armored juggernaut)
      64. `card_touchdown_god`: Melee / Running (cost 6, the ultimate golden gridiron deity)

---

### Phase 3: Pre-Match Scouting & In-Match Augment Drafting *(COMPLETED)*
- [x] **3.1 Opponent Scouting Preview**
  - Reveals 4 random cards from the opponent's 8-troop deck during the pre-match sequence with card miniatures and stats.
- [x] **3.2 Silver Augment Kickoff Draft**
  - Generates 3 distinct Silver (Common) augments for both players to choose before the whistle blows.
  - Sockets confirm draft pick and apply multipliers to loadouts immediately.
- [x] **3.3 Concession Comeback Draft**
  - When a player concedes a touchdown, the server presents that player with 3 Gold / Legendary augments during the round reset.
  - Conceding player taps to pick their comeback upgrade, which stacks into their modifiers for the rest of the match.
- [x] **3.4 Augment Collection & Tiers**
  - Expanded augment catalogue across Silver (Common), Gold (Rare), and Legendary tiers:
    - *Silver*: Swift Boots, Iron Skin, Quick Hands, Heavy Impact, Eagle Sight, Spring Step, Slime Plating, Rapid Jab, Liquid Trickle.
    - *Gold*: Mana Surge, Berserker Rage, Eagle Eye, Iron Golem, Wind Stride, Frenzy Strike, Blast Flask, Liquid Overflow.
    - *Legendary*: Titan's Blessing, Phoenix Heart, Colossus Might, Celestial Wings, Infinite Current, Sniper's Perch.
  - Augments expire after 24 hours of acquisition (`AUGMENT_DURATION_MS`).

---

### Phase 4: Arena Visual Polish, UI & Audio *(COMPLETED)*
- [x] **4.1 Arena Turf & Slime Polish**
  - Gridiron turf graphics with alternating grass bands, yard line markers, hash marks at 33% & 67%, sideline yard numbers (`10, 20, 30, 40, 50, 40, 30, 20, 10`), and centerfield football emblem (`🏈`).
  - Auto-orienting field text and emblems counter-rotated for rotated Player 2 perspective.
  - Gooey Sticky Liquid meter with segment dividers, dynamic fill, and live capacity indicator.
- [x] **4.2 Touchdown Spectacle & FX**
  - Explosive "TOUCHDOWN!" celebration overlay with round reset banner.
  - Placement cooldown overlay with real-time numeric countdown.
  - Tactile haptic feedback on card selection, unit spawn, and score events.
- [x] **4.3 Sound & Haptic Architecture**
  - `SoundService` with tactile vibration sequences for spawn, weapon impact, touchdown burst, referee whistle, cooldown warning, and augment draft pick.

---

### Phase 5: Home Screen & Deck Builder Navigation *(COMPLETED)*
- [x] **5.1 Three-Tab Home Screen**
  - **Sticky Home** (`HomeScreen.tsx`): 1v1 Ranked Gridiron queue card, active loadout status pill, weekly tournament banner, AI duel & spectate launcher, and gridiron pro tips.
  - **Sticky Deck** (`DeckBuilderScreen.tsx`): 8-Troop Deck Builder + 24-hour Augment Vault supporting all 16 unlocked troops with drag-and-drop slots.
  - **Sticky Tournament** (`TournamentScreen.tsx`): Weekly mirror championship hub, mirror match rule highlights, live countdown timer to weekly reset, 8-player bracket visualizer, and direct tournament queue entry.
  - Clean bottom navigation bar with active indicators and instant tab switching.
- [x] **5.2 Deck Validation**
  - Enforced 8 unique troops per loadout; server validates and defaults to starter roster if empty, ensuring zero empty-deck exploits.

---

### Phase 6: Automated Testing & Balance
- [ ] **6.1 Headless Bot Simulation Suite**
  - Automated match sim running 1000s of matches between AI archetypes to test balance.
- [ ] **6.2 Unit and Regression Tests**
  - Server test suite for touchdown resets, 2s cooldown rejection, 8-card rotation, augment expiration, and client render stability.
