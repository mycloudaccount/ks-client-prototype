import type { EditorCommand } from "./EditorCommand";

export class CommandStack {
  private undoStack: EditorCommand[] = [];
  private redoStack: EditorCommand[] = [];

  execute(cmd: EditorCommand) {
    cmd.apply();
    this.undoStack.push(cmd);
    this.redoStack.length = 0; // clear redo on new action
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return;

    cmd.revert();
    this.redoStack.push(cmd);
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return;

    cmd.apply();
    this.undoStack.push(cmd);
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  peekUndo(): EditorCommand | undefined {
    return this.undoStack[this.undoStack.length - 1];
  }

  peekRedo(): EditorCommand | undefined {
    return this.redoStack[this.redoStack.length - 1];
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
