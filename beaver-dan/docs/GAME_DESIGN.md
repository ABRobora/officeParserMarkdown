# Beaver Dan — Game Design Document

*An artful, true-to-nature game about the life of a beaver. Free to play; donations flow to beaver and wetland charities.*

---

## 1. Vision

You are **Dan**, a North American beaver. The game follows his whole life — kit, yearling, disperser, dam-builder, parent, elder — and every mechanic is drawn from real beaver biology. By the time a player finishes Chapter One they will know, without ever reading a textbook, why beavers build dams, what they actually eat, why deep water means safety, and why ecologists call them keystone species.

**Tone references:** *Old Man's Journey* (painterly layered vistas, wordless melancholy-warmth) meets *Lumino City* (handcrafted, tactile, lovingly lit scenes). The game should feel like playing inside a picture book painted by someone who has sat by a real beaver pond at dusk.

### Design pillars

1. **Truth first.** If real beavers don't do it, Dan doesn't do it. No fish-eating, no living *in* the dam, no cartoon hard-hats. The fantasy is intimacy with a real animal's life, not anthropomorphism.
2. **Learning by doing.** Facts arrive as *Field Notes* the first time the player performs the matching action — never as quizzes or interrupting tutorials.
3. **The valley is the progress bar.** The player's reward is watching the world transform: stream → pond → wetland → thriving ecosystem. Biodiversity is the score.
4. **Gentle, but honest.** Predators, winter, drought and humans are real pressures. Failure is a "close call" and a lesson, never a gore screen — but tension is real, because a beaver's life is tense.

---

## 2. The life of a beaver → game structure

The game is organised into **chapters that mirror a beaver's actual life history**. Each chapter changes the verbs available to the player, so gameplay keeps evolving for tens of hours.

| Chapter | Life stage (real biology) | Player experience |
|---|---|---|
| **1. Born in the Dark** | Kits are born in spring inside the lodge; nursed ~6 weeks; can swim within days | First-person tutorial inside the lodge: learn to swim through the underwater entrance, follow mother, eat your first bark. Small, warm, safe. |
| **2. The Family Trade** | Yearlings stay a second year: groom kits, haul mud, repair the dam, stockpile the cache | Third-person isometric around the *parents'* pond. Teaches repair, foraging, the trickle-sound = leak instinct, babysitting minigames. Safe-ish: parents tail-slap warnings. |
| **3. The Long Walk** (dispersal) | At ~2 years beavers leave to find unclaimed territory; highest-mortality period of their life; may travel 10–50 km | A tense overland/downstream journey. Roads, dogs, coyotes, dry ridges. Stamina management; water is sanctuary. Ends when Dan smells an unclaimed valley. |
| **4. A River of Your Own** | Site selection, dam construction, pond formation, lodge building | **The prototype chapter (playable now).** Fell aspens, float logs, raise the dam in stages, watch the valley flood, raise a lodge. |
| **5. The White Season** | Food cache under ice; pond must not freeze to the bottom; fat stored in tail | Under-ice swimming between lodge and cache; manage air pockets and energy; the dam's depth is literally the margin of survival. |
| **6. Two by the Water** | Beavers pair for life; new mate arrives from another watershed | A stranger arrives. Court (mutual grooming, scent mounds), patrol territory together, build a second food cache. Co-op verbs; optionally a second local player. |
| **7. Kits of Your Own** | 2–4 kits/year; both parents + yearlings provision them | The lodge interior becomes a nursery (first-person scenes). Escort kits on first swims; teach-by-doing missions replay Chapter 1 from the other side. |
| **8. The Engineers** | Colonies dig canals, build secondary dams, coppice willow; ponds silt up into meadows | Empire-of-mud endgame: canal-digging reshapes the map, secondary dams open new flats, biodiversity meter (herons, otters, frogs, trout, dragonflies) climbs as the wetland matures. |
| **9. People of the Valley** | Human–beaver conflict: culverts, flooding fields, trapping history; modern coexistence tools | Humans arrive downstream. Story arc resolves through real coexistence tech — flow devices ("beaver deceivers"), tree guards, relocation — introduced by a sympathetic biologist character. Direct tie-in to the donation screen. |
| **10. The Old Beaver** | Beavers live 10–12 years wild; colonies persist for generations | Elegiac closing chapter: Dan hands the valley to a daughter. New game+ as the next generation, inheriting the transformed map. |

**Session rhythm:** day/night cycle (~3 min prototype, ~8 min target) with seasons. Beavers are crepuscular — dusk is when work begins and when wolves hunt, which gives every game-day a natural tension curve.

---

## 3. Perspective & camera

- **Third-person isometric** for the living world: the valley as a hand-painted diorama, depth-sorted, with parallax painted hills behind the playfield.
- **First-person** for intimate interiors and vignettes: inside the lodge (darkness, the glowing underwater door, kits breathing), under the ice (blue-green light, silver air pockets), gnawing close-ups, and the dispersal-night prologue.
- Camera gently zooms with context (wide while swimming the pond; close while gnawing).

## 4. Core mechanics (Chapter 4, implemented in prototype)

- **Three movement states, one lesson:** Dan walks slowly and vulnerably on land, swims fast afloat, and can **dive** in deep water — hidden from predators on a breath timer. Wolves *wade*: the shallows are lunge range, so only the deep water a dam creates is true sanctuary.
- **Gnaw & fell:** hold to gnaw aspen/willow (pines resist — beavers prefer soft hardwoods); escalating crunch audio; trees fall, drop logs, leave stumps that resprout (coppicing) and can be nibbled for food.
- **Float, haul & build:** logs felled into water **drift downstream with the current** and self-deliver at the narrows — *where* you log becomes the puzzle. The dam rises in stages and **the water level actually rises**, staged as a letterboxed cinematic: camera pull-out, a 3-second water sweep, snags graying in one by one. Then build the lodge in the new deep water.
- **Dig canals:** soft ground beside water can be excavated; the tile drops below the waterline and joins the floating network — the elevation model does the rest. (Beavers are second only to humans in reshaping terrain.)
- **Maintain the dam:** at dusk a **leak** can spring — a spatialized trickle you locate by ear, exactly like a real beaver. Patch it with mud, or it tears wider overnight and the pond drops a stage. The defining beaver behaviour is the daily ritual.
- **Tail-slap:** the player's iconic warning verb — a gunshot crack that sends nearby wolves loping for the treeline.
- **Needs:** one honest meter — energy. Eat bark, lily tubers, pond plants. Collapse = wake in a bank burrow, humbled, your log left behind.
- **Predation:** wolves hunt at night, in pairs from night three. Being caught is a scripted *close call*: Dan escapes shaken, drops his log, and the Field Note explains why dispersing beavers die on land.
- **Field Notes:** 23 in the prototype, each triggered by the player's own action, archived permanently in the **Field Journal**.
- **Sleep & save:** enter the lodge by swimming up through its underwater door (first-person, interactive); sleep to dawn — but a leak left running will cost you. Autosave at every beat; CONTINUE from the title.
- **Audio:** fully procedural WebAudio — river ambience, trickle-as-gameplay-cue, tail-slap, growls, chimes, dawn/dusk piano stings, title motif. Zero binary assets, every call-site swappable for recorded audio.

### Engagement & retention (full game)
- The valley persists and matures in real time between sessions (slow silt, regrowth, seasonal birds) — something new every return visit.
- Daily "rounds": dawn patrol (find and patch the night's leak — procedurally placed), scent-mound border checks, cache top-ups.
- Photo mode with painterly frames; share cards that carry one Field Note each (organic education spread).
- Seasonal live events mirroring real phenology: spring kits, autumn cache rush, winter ice. No energy timers, no paywalls, no ads — retention through tendlikeness ("my pond"), not coercion.

## 5. Art direction

- **Palette:** dusk ochres and rose over deep pine teals; water carries the sky's colour. Defined in `src/palette.ts` as the single source of truth.
- **Shape language:** soft rounded silhouettes, no outlines, layered like cut paper; tiles get per-tile hue jitter so nothing looks stamped.
- **Light is the storyteller:** time-of-day washes, the lodge's underwater door glowing like a hearth, moon-glint logging runs.
- The prototype's procedural art is a *placeholder with the right bones*: every texture is generated in `src/art.ts` and can be swapped for final painted sprites one key at a time without touching game code.
- **Audio direction (not yet implemented):** solo piano + folk strings (Old Man's Journey register); diegetic water everywhere; the *trickle* of a leak as an actual gameplay cue; tail-slap as the loudest sound in the game.

## 6. Education design

- Field Notes are short (≤ 2 sentences), conversational, and only ever describe what the player just did or saw.
- A collectible **Field Journal** (menu) archives unlocked notes — the "encyclopedia" is earned, never assigned.
- Chapter 9 carries the conservation payload: coexistence tools the player *uses as mechanics* are the same ones the donation-screen charities deploy in reality.
- Science review pass before store release (Beaver Institute / Beaver Trust literature; ideally a wildlife-biologist consult).

## 7. Business model

- **Free. Forever. No ads, no IAP advantages.**
- A **donation screen** (in-game + main menu) lists vetted charities: Beaver Trust (UK), The Beaver Institute (US), Worth A Dam (US), Rewilding Europe — player picks the recipient.
- **90% to the charity, 10% to us** to fund development — stated verbatim on the screen. Implemented at release via platform payment links / IAP with published accounting.
- Optional cosmetic "thank-you" after donating (lily crown for Dan); visible, never powerful.

## 8. Technical architecture

- **Phaser 3 + TypeScript + Vite**, wrapped with **Capacitor** for iOS and Android (`capacitor.config.ts` ready; `npm run cap:add:ios` / `cap:add:android`).
- One codebase → web (instant playtesting / press demos) + both stores.
- World model (`src/world.ts`) is pure data: elevation field + water level per row → flooding falls out of the terrain math, not scripted regions.
- Scenes: `Boot → Title → Story → Game (+UI overlay) ⇄ Lodge → Donate`.
- Headless smoke test (`scripts/smoke.mjs`) boots the built game in Chromium, plays through title → prologue → open world → full dam/lodge/epilogue sequence, and fails on any runtime error.

## 9. Milestones

1. **M0 — vertical slice:** Chapter 4, procedural art, smoke-tested. ✅
2. **M1 — feel:** procedural audio pass ✅, tail-slap ✅, dive ✅, leak/repair loop ✅, staged flood cinematic ✅, log floating + canals ✅, save system ✅, Field Journal ✅, native iOS/Android projects scaffolded ✅. Remaining: haptics, on-device touch tuning, painted hero textures for Dan/trees/lodge, recorded audio replacing synthesis.
3. **M2 — winter:** Chapter 5 under-ice slice (dive + breath mechanics now exist to build on).
4. **M3 — dispersal:** Chapter 3 journey + Chapter 1–2 tutorial-as-childhood; full life-loop demo.
5. **M4 — stores:** signed device builds, donation rails, charity agreements, science review, accessibility (one-thumb play, colour-blind safe water/land contrast).
6. **M5 — live:** seasons in real time, photo mode, chapters 6–10 episodic releases.
