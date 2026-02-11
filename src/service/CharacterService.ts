// service/CharacterService.ts
import type { PlacedCharacter } from "@/editor/commands/PlaceCharacterCommand";

/**
 * CharacterService
 * Minimal service to track selected characters for box/group selection.
 */
export class CharacterService {
  public selectedCharacters = new Set<PlacedCharacter>();

  /** Selection change listeners */
  private listeners = new Set<(selection: PlacedCharacter[]) => void>();

  /** ---------------------------
   *  Listener API
   * --------------------------- */
  subscribe(fn: (selection: PlacedCharacter[]) => void): () => void {
    this.listeners.add(fn);
    fn(this.getSelection()); // initial sync
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const sel = this.getSelection();
    for (const l of this.listeners) l(sel);
  }

  /** ---------------------------
   *  Selection API
   * --------------------------- */

  getSelection(): PlacedCharacter[] {
    return Array.from(this.selectedCharacters);
  }

  select(chars: PlacedCharacter[], additive = false) {
    if (!additive) this.clearSelection();
    for (const c of chars) this.selectedCharacters.add(c);
    this.notify();
  }

  deselect(chars: PlacedCharacter[]) {
    for (const c of chars) this.selectedCharacters.delete(c);
    this.notify();
  }

  clearSelection() {
    this.selectedCharacters.clear();
    this.notify();
  }
}
