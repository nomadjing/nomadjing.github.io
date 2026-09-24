export interface DatedNote {
  date?: string;
  updated?: string;
}

export function renderNoteHeatmap(notes: DatedNote[], now?: Date): string;
