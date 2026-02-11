import type { EditorCommand } from "@/editor/commands";

export class UndoRedoService {
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

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
