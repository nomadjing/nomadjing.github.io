// One published note contributes to the day of its latest frontmatter date.
export function renderNoteHeatmap(notes, now = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const start = today - (((new Date(today).getUTCDay() + 6) % 7) + 11 * 7) * dayMs;
  const counts = new Map();
  let undated = 0;

  for (const note of notes) {
    const value = note.updated || note.date;
    const match = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const day = match && Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (!match || new Date(day).toISOString().slice(0, 10) !== value) { undated += 1; continue; }
    if (day >= start && day <= today) counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const date = (day) => new Date(day).toISOString().slice(0, 10);
  const shades = ["·", "░", "▒", "█"];
  const rows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, weekday) => {
    const cells = Array.from({ length: 12 }, (_, week) => {
      const day = start + (week * 7 + weekday) * dayMs;
      return day > today ? " " : shades[Math.min(counts.get(day) ?? 0, 3)];
    });
    return `${label} ${cells.join(" ")}`;
  });

  return [`Published notes · ${date(start)} → ${date(today)}`, ...rows,
    "· 0   ░ 1   ▒ 2   █ 3+ notes",
    `${counts.size} active day(s) · ${undated} note(s) without date/updated`,
    "Each note counts once at its latest frontmatter date, not its edit history.",
  ].join("\n");
}
