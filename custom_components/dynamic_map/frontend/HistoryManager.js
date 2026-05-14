export class HistoryManager {
    constructor() {
        this.history = [];
        this.historyIndex = -1;
    }

    saveState(rooms, shortcuts) {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(JSON.parse(JSON.stringify({ rooms, shortcuts })));
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            return JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        }
        return null;
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            return JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        }
        return null;
    }

    reset() {
        this.history = [];
        this.historyIndex = -1;
    }
}
