import { escapeHtml } from "../html.js";
import { latestDate } from "../site.js";
import type { Note } from "../types.js";

/** Titles with their latest date flush right; used by the home page and tag pages. */
export function noteList(notes: Note[]): string {
  return `<ul class="writing-list">${notes.map((note) => {
    const date = latestDate(note);
    return `<li><a href="${note.url}">${escapeHtml(note.title)}</a>${date ? `<time datetime="${date}">${date}</time>` : ""}</li>`;
  }).join("")}</ul>`;
}
