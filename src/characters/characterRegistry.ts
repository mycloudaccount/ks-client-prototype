// characters/characterRegistry.ts
import type { DiscoveredCharacter } from "./CharacterDiscoveryService";
import { CharacterDiscoveryService } from "./CharacterDiscoveryService";

let registry: Map<string, DiscoveredCharacter> | null = null;

export async function loadCharacterRegistry(): Promise<void> {
  if (registry) return;

  console.group("[Characters] Loading registry");

  const discovery = new CharacterDiscoveryService();

  registry = discovery.discoverAll();

  // Ensure config exists for every character
  for (const [id, character] of registry.entries()) {
    if (!character.config) {
      throw new Error(`[Characters] Missing config for character: ${id}`);
    }
    if (!character.configPath) {
      throw new Error(`[Characters] Missing configPath for character: ${id}`);
    }
  }

  console.log(`Loaded ${registry.size} characters`, [...registry.keys()]);

  console.groupEnd();
}

export function getCharacterRegistry() {
  if (!registry) {
    throw new Error("Character registry not loaded");
  }
  return registry;
}
