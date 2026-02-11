// service/InteractionService.ts
import { ToolMode } from "@/editor/types";
import { CommandStack } from "@/editor/commands/CommandStack";
import type { EditorCommand } from "@/editor/commands/EditorCommand";
import type { TileId } from "@/tiles/tileTypes";

/* ================================
   Interaction (tools / tiles)
================================ */
export type InteractionState = {
  baseTool: ToolMode;
  transientTool?: ToolMode;
  selectedTile?: TileId;
  selectedCharacter?: string;
  source?: "ui" | "keyboard" | "mouse";
};

type InteractionListener = (state: InteractionState) => void;

/* ================================
   Selection (box / lasso / future)
================================ */
export type SelectionRect = {
  x: number; // world-space center X
  y: number; // world-space center Y
  width: number; // world-space width
  height: number; // world-space height
};

export type SelectionPhase = "start" | "update" | "end" | "clear";

export type SelectionEvent = {
  phase: SelectionPhase;
  rect?: SelectionRect;
  source?: InteractionState["source"];
};

type SelectionListener = (event: SelectionEvent) => void;

/* ================================
   Command (undo / redo)
================================ */
export type CommandState = {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;
  redoLabel?: string;
};

type CommandListener = (state: CommandState) => void;

export class InteractionService {
  /* ----------------------------
     Interaction state
  ---------------------------- */
  private state: InteractionState = {
    baseTool: ToolMode.CREATE,
  };

  private listeners = new Set<InteractionListener>();

  /* ----------------------------
     Selection listeners
  ---------------------------- */
  private selectionListeners = new Set<SelectionListener>();

  /* ----------------------------
     Command stack
  ---------------------------- */
  readonly commandStack = new CommandStack();
  private commandListeners = new Set<CommandListener>();

  /* ============================
     Interaction subscription
  ============================ */
  subscribe(fn: InteractionListener): () => void {
    this.listeners.add(fn);
    fn(this.state); // immediate sync
    return () => this.listeners.delete(fn);
  }

  private emitInteraction() {
    for (const l of this.listeners) l(this.state);
  }

  /* ============================
     Selection subscription
  ============================ */
  subscribeSelection(fn: SelectionListener): () => void {
    this.selectionListeners.add(fn);
    return () => this.selectionListeners.delete(fn);
  }

  private emitSelection(event: SelectionEvent) {
    for (const l of this.selectionListeners) l(event);
  }

  /* ============================
     Command subscription
  ============================ */
  subscribeCommands(fn: CommandListener): () => void {
    this.commandListeners.add(fn);
    fn(this.getCommandState()); // immediate sync
    return () => this.commandListeners.delete(fn);
  }

  private emitCommandState() {
    const state = this.getCommandState();
    for (const l of this.commandListeners) l(state);
  }

  private getCommandState(): CommandState {
    return {
      canUndo: this.commandStack.canUndo,
      canRedo: this.commandStack.canRedo,
      undoLabel: this.commandStack.peekUndo()?.label,
      redoLabel: this.commandStack.peekRedo()?.label,
    };
  }

  /* ============================
     Accessors
  ============================ */
  get selectedCharacter(): string | undefined {
    return this.state.selectedCharacter;
  }

  /* ============================
     Tool control
  ============================ */
  setBaseTool(tool: ToolMode, source: InteractionState["source"] = "ui") {
    this.state = { ...this.state, baseTool: tool, source };
    this.emitInteraction();
  }

  beginTransientTool(
    tool: ToolMode,
    source: InteractionState["source"] = "keyboard",
  ) {
    this.state = { ...this.state, transientTool: tool, source };
    this.emitInteraction();
  }

  endTransientTool(tool: ToolMode) {
    if (this.state.transientTool !== tool) return;
    this.state = { ...this.state, transientTool: undefined };
    this.emitInteraction();
  }

  /* ============================
     Tile / Character selection
  ============================ */
  setSelectedTile(tile: TileId) {
    this.state = {
      ...this.state,
      selectedTile: tile,
      selectedCharacter: undefined, // clear character selection
    };
    this.emitInteraction();
  }

  setSelectedCharacter(charId: string) {
    this.state = {
      ...this.state,
      selectedCharacter: charId,
      selectedTile: undefined, // clear tile selection
    };
    this.emitInteraction();
  }

  /* ============================
   Selection control (box / lasso)
============================ */
  beginSelection(
    rect: SelectionRect,
    source: InteractionState["source"] = "mouse",
  ) {
    this.emitSelection({
      phase: "start",
      rect,
      source,
    });
  }

  updateSelection(
    rect: SelectionRect,
    source: InteractionState["source"] = "mouse",
  ) {
    this.emitSelection({
      phase: "update",
      rect,
      source,
    });
  }

  endSelection(
    rect: SelectionRect,
    source: InteractionState["source"] = "mouse",
  ) {
    this.emitSelection({
      phase: "end",
      rect,
      source,
    });
  }

  clearSelection(source: InteractionState["source"] = "ui") {
    this.emitSelection({
      phase: "clear",
      source,
    });
  }

  /* ============================
     Command API
  ============================ */
  executeCommand(cmd: EditorCommand) {
    this.commandStack.execute(cmd);
    this.emitCommandState();
  }

  undo() {
    this.commandStack.undo();
    this.emitCommandState();
  }

  redo() {
    this.commandStack.redo();
    this.emitCommandState();
  }

  /* ============================
     Derived / helpers
  ============================ */
  get effectiveTool(): ToolMode {
    return this.state.transientTool ?? this.state.baseTool;
  }

  get isPlacingTile(): boolean {
    return this.effectiveTool === ToolMode.CREATE && !!this.state.selectedTile;
  }

  get isPlacingCharacter(): boolean {
    return (
      this.effectiveTool === ToolMode.CREATE && !!this.state.selectedCharacter
    );
  }
}
