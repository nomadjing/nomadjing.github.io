export interface SiteProject { title: string; description: string; status?: string; url?: string; }
export interface SiteConfig { siteName: string; baseUrl: string; contentRoot: string; fallbackContentRoot?: string; author: string; tagline: string; subtitle: string; intro?: string; researchKeywords?: string; hobbies?: string[]; projects?: SiteProject[]; featuredWriting?: string[]; }
export type NoteStatus = "seed" | "growing" | "stable";
export interface Note { sourcePath: string; relativePath: string; title: string; url: string; outputPath: string; markdown: string; html: string; date?: string; updated?: string; tags: string[]; status?: NoteStatus; }
