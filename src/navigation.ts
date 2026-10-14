export const siteViews = {
  home: "/",
  notes: "/notes/",
  tags: "/tags/",
  about: "/about/",
};

export type PageKind = "home" | "notes" | "tags" | "tag" | "about" | "directory" | "note";
export interface Breadcrumb { label: string; url: string; }

export function pageNavigation(
  siteName: string,
  url: string,
  title: string,
  kind: PageKind,
  directoryLabels: Map<string, string> = new Map(),
) {
  const breadcrumbs: Breadcrumb[] = [{ label: siteName, url: siteViews.home }];
  let directory = "/";
  if (kind === "about") {
    breadcrumbs.push({ label: "About", url });
    directory = "/about";
  }
  else if (kind === "tags" || kind === "tag") {
    breadcrumbs.push({ label: "Tags", url: siteViews.tags });
    if (kind === "tag") breadcrumbs.push({ label: title, url });
    directory = url.replace(/\/$/, "");
  }
  else if (kind !== "home") {
    breadcrumbs.push({ label: "Notes", url: siteViews.notes });
    directory = "/notes";
    if (kind === "directory" || kind === "note") {
      const segments = url.split("/").filter(Boolean);
      const directories = kind === "note" ? segments.slice(0, -1) : segments;
      directories.forEach((segment, index) => {
        const directoryUrl = `/${directories.slice(0, index + 1).join("/")}/`;
        breadcrumbs.push({ label: directoryLabels.get(directoryUrl) ?? segment, url: directoryUrl });
      });
      directory = `/notes${directories.length ? `/${directories.join("/")}` : ""}`;
      if (kind === "note") breadcrumbs.push({ label: title, url });
    }
  }
  return {
    breadcrumbs,
    parentUrl: breadcrumbs.at(-2)?.url,
    directory,
    section: kind === "home" ? "" : kind === "about" ? "about" : kind === "tags" || kind === "tag" ? "tags" : "notes",
  };
}
