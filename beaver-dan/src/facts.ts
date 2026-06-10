/**
 * Field Notes — the educational heart of Beaver Dan.
 * Every fact is triggered the first time the player *does* the thing,
 * so learning rides on play instead of interrupting it.
 * Sources: established beaver ecology (Castor canadensis / Castor fiber).
 */
export interface FieldNote {
  id: string;
  title: string;
  body: string;
}

export const FIELD_NOTES: Record<string, FieldNote> = {
  firstSwim: {
    id: 'firstSwim',
    title: 'Built for water',
    body:
      'Beavers swim at up to 8 km/h using their webbed hind feet and rudder-like tail. ' +
      'Transparent eyelids work like goggles, and valves seal their ears and nose shut underwater.'
  },
  firstDive: {
    id: 'firstDive',
    title: 'Six-minute breath',
    body:
      'A beaver can stay submerged for up to 15 minutes, though most dives last 5–6. ' +
      'Oversized lungs and oxygen-rich blood make the pond the safest place a beaver knows.'
  },
  firstGnaw: {
    id: 'firstGnaw',
    title: 'Teeth that never stop',
    body:
      "A beaver's orange incisors grow continuously — about 1 mm every few days. " +
      'The orange enamel is hardened with iron, and gnawing keeps the teeth chisel-sharp.'
  },
  firstFell: {
    id: 'firstFell',
    title: 'The forester',
    body:
      'A beaver can fell a 15 cm aspen in under an hour. They prefer aspen, willow and birch — ' +
      'and many of these trees resprout from the stump, a natural coppice the beaver returns to for years.'
  },
  firstEat: {
    id: 'firstEat',
    title: 'A vegetarian, actually',
    body:
      'Beavers never eat fish. They eat bark, cambium (the sweet layer under bark), ' +
      'leaves, water-lily tubers and pond plants. The aspen they fell is dinner as much as lumber.'
  },
  firstLog: {
    id: 'firstLog',
    title: 'Strong jaws, stronger habits',
    body:
      'Beavers drag and float branches many times their own weight, ' +
      'often digging canals so they can swim materials to the dam instead of hauling them overland.'
  },
  damStage1: {
    id: 'damStage1',
    title: 'Why build a dam at all?',
    body:
      'A dam is not a home — it is a moat-maker. By backing up the stream, ' +
      'the beaver surrounds itself with deep water that wolves, coyotes and bears cannot cross quietly.'
  },
  damStage2: {
    id: 'damStage2',
    title: 'Mud, stone and sticks',
    body:
      'Beavers weave sticks, then plaster the upstream face with mud and stones until it seals. ' +
      'The sound of trickling water triggers repair behaviour — they literally cannot stand a leak.'
  },
  damStage4: {
    id: 'damStage4',
    title: 'Ecosystem engineers',
    body:
      'Beaver ponds raise the water table, filter sediment, slow floods and survive droughts. ' +
      'Frogs, fish, herons, otters and dragonflies all move into the wetland one beaver built.'
  },
  firstFlood: {
    id: 'firstFlood',
    title: 'Dead trees, new life',
    body:
      'Trees drowned by a new pond become standing snags — prime real estate for woodpeckers, ' +
      'owls and ducks that nest in cavities. Nothing in a beaver wetland goes to waste.'
  },
  lodgeBuilt: {
    id: 'lodgeBuilt',
    title: 'The lodge',
    body:
      'A lodge is a stick-and-mud island fortress. Its only doors are underwater, ' +
      'and the living chamber sits dry above the waterline with a built-in chimney for fresh air.'
  },
  firstSleep: {
    id: 'firstSleep',
    title: 'Night shift',
    body:
      'Beavers are mostly crepuscular and nocturnal — they work from dusk through the night ' +
      'and sleep through the bright, dangerous hours of the day.'
  },
  wolfEscape: {
    id: 'wolfEscape',
    title: 'The tail-slap',
    body:
      'When a beaver senses danger it slaps its tail on the water like a gunshot, ' +
      'warning every beaver in earshot before diving. On land a beaver is slow; in water it is nearly untouchable.'
  },
  wolfCaught: {
    id: 'wolfCaught',
    title: 'A dangerous walk',
    body:
      'Predators take most beavers on land, often during dispersal — the journey a two-year-old ' +
      'makes to find its own stream. It is the most dangerous trip of a beaver\'s life.'
  },
  nightFall: {
    id: 'nightFall',
    title: 'Dusk is opening time',
    body:
      'Most of a beaver\'s work happens after sundown. Moonlit logging runs are normal — ' +
      'but so are the wolves that hunt the same hours.'
  },
  winterComes: {
    id: 'winterComes',
    title: 'The food cache',
    body:
      'Before freeze-up, beavers sink a raft of branches beside the lodge. All winter they swim ' +
      'under the ice to this larder — the pond must be deep enough not to freeze solid, which is exactly why the dam matters.'
  },
  tailFat: {
    id: 'tailFat',
    title: 'A pantry in the tail',
    body:
      "A beaver's tail stores fat for winter and works as a rudder, a prop for standing, " +
      'and a radiator for shedding heat in summer. It can shrink visibly by spring.'
  },
  mateForLife: {
    id: 'mateForLife',
    title: 'Family',
    body:
      'Beavers usually pair for life. A colony is a family: two parents, this year\'s kits ' +
      'and last year\'s yearlings, who babysit, groom and help with repairs before dispersing at two.'
  },
  keystone: {
    id: 'keystone',
    title: 'Keystone species',
    body:
      'Hunted nearly to extinction for fur and castoreum, beavers are returning across Europe and ' +
      'North America. Where they return, wetlands, fish and birds return with them.'
  },
  coexist: {
    id: 'coexist',
    title: 'Living with beavers',
    body:
      'Flow devices ("beaver deceivers") and tree guards let people and beavers share a valley ' +
      'without trapping. Many wildlife charities exist to make exactly that happen.'
  }
};
