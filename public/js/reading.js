const wideQuery = "(min-width: 1100px)";
const outlineIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h10M4 18h13"/></svg>';

/**
 * Article reading aids: a seekable progress line on the header rule, and an
 * outline that sits beside the article on wide screens or slides in on narrow ones.
 * @param {import("./types.js").PageContext} context
 */
export function initReading({ document, window, requestAnimationFrame }) {
  /** @type {HTMLElement | null} */
  const article = document.querySelector("main > .note-layout > article") ?? document.querySelector("main > article");
  if (!article) return;
  /** @type {HTMLElement | null} */
  const layout = document.querySelector(".note-layout");
  const header = document.querySelector(".site-header");
  let headerHeight = 0;
  let scheduleUpdate = () => {};
  const measureHeader = () => {
    headerHeight = header?.getBoundingClientRect().height ?? 0;
    document.documentElement.style.setProperty("--reading-header-height", `${headerHeight}px`);
  };
  measureHeader();
  window.addEventListener("resize", measureHeader);
  if (header && "ResizeObserver" in window)
    new window.ResizeObserver(() => { measureHeader(); scheduleUpdate(); }).observe(header);

  const progress = document.createElement("div");
  progress.className = "reading-progress";
  progress.innerHTML = '<span class="reading-progress-track" role="slider" tabindex="0" aria-label="Article reading progress" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="reading-progress-fill"></span></span>';
  document.body.append(progress);
  const track = /** @type {HTMLElement} */ (progress.querySelector(".reading-progress-track"));

  const outline = createOutline({ document, window, requestAnimationFrame, article, layout });

  const readingRange = () => {
    const bounds = article.getBoundingClientRect();
    return { start: bounds.top + window.scrollY - headerHeight, end: bounds.bottom + window.scrollY - window.innerHeight };
  };
  const currentFraction = () => {
    const { start, end } = readingRange();
    return end > start ? Math.min(1, Math.max(0, (window.scrollY - start) / (end - start))) : 0;
  };
  const jumpToFraction = (/** @type {number} */ fraction) => {
    const { start, end } = readingRange();
    if (end > start) window.scrollTo(0, start + Math.min(1, Math.max(0, fraction)) * (end - start));
  };
  const seek = (/** @type {MouseEvent} */ event) => {
    const bounds = track.getBoundingClientRect();
    jumpToFraction((event.clientX - bounds.left) / bounds.width);
  };

  track.addEventListener("click", seek);
  /** @type {number | null} */
  let dragPointer = null;
  track.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    dragPointer = event.pointerId;
    track.setPointerCapture(event.pointerId);
    track.blur();
    seek(event);
  });
  track.addEventListener("pointermove", (event) => {
    if (event.pointerId === dragPointer) seek(event);
  });
  track.addEventListener("pointerup", (event) => {
    if (event.pointerId !== dragPointer) return;
    seek(event);
    dragPointer = null;
    track.releasePointerCapture(event.pointerId);
  });
  const stopDrag = () => { dragPointer = null; };
  track.addEventListener("pointercancel", stopDrag);
  track.addEventListener("lostpointercapture", stopDrag);
  /** @type {Record<string, number>} */
  const steps = { ArrowDown: 0.05, ArrowRight: 0.05, ArrowUp: -0.05, ArrowLeft: -0.05, PageDown: 0.2, PageUp: -0.2 };
  track.addEventListener("keydown", (event) => {
    if (event.key !== "Home" && event.key !== "End" && !(event.key in steps)) return;
    event.preventDefault();
    jumpToFraction(event.key === "Home" ? 0 : event.key === "End" ? 1 : currentFraction() + steps[event.key]);
  });

  let updatePending = false;
  const update = () => {
    updatePending = false;
    const { start, end } = readingRange();
    progress.hidden = end <= start;
    if (!progress.hidden) {
      const fraction = currentFraction();
      progress.style.setProperty("--reading-progress", String(fraction));
      track.setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
    }
    outline?.update();
  };
  scheduleUpdate = () => {
    if (updatePending) return;
    updatePending = true;
    requestAnimationFrame(update);
  };
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  if ("ResizeObserver" in window) new window.ResizeObserver(scheduleUpdate).observe(article);
  scheduleUpdate();
}

/**
 * Builds the outline from h2/h3 headings; articles with fewer than three get none.
 * @param {Pick<import("./types.js").PageContext, "document" | "window" | "requestAnimationFrame"> & { article: HTMLElement, layout: HTMLElement | null }} options
 */
function createOutline({ document, window, requestAnimationFrame, article, layout }) {
  const headings = /** @type {HTMLElement[]} */ ([...article.querySelectorAll(".prose h2, .prose h3")]);
  if (headings.length < 3) return null;
  document.body.classList.add("has-reading-outline");
  const wide = window.matchMedia(wideQuery);
  const outline = document.createElement("aside");
  outline.className = "reading-outline";
  const toggle = document.createElement("button");
  toggle.className = "reading-outline-toggle icon-button";
  toggle.type = "button";
  toggle.innerHTML = outlineIcon;
  toggle.setAttribute("aria-controls", "reading-outline-list");
  const nav = document.createElement("nav");
  nav.id = "reading-outline-list";
  nav.setAttribute("aria-label", "文章目录");
  const title = document.createElement("p");
  title.className = "reading-outline-title";
  title.textContent = "contents";
  const list = document.createElement("ol");

  let active = -1;
  const revealActive = () => {
    const link = links[active];
    if (!link || !nav.getClientRects().length) return;
    const navBounds = nav.getBoundingClientRect();
    const linkBounds = link.getBoundingClientRect();
    if (linkBounds.top < navBounds.top) nav.scrollTop += linkBounds.top - navBounds.top;
    else if (linkBounds.bottom > navBounds.bottom) nav.scrollTop += linkBounds.bottom - navBounds.bottom;
  };
  // On wide screens the outline is a permanent column; elsewhere it is a drawer.
  const setOpen = (/** @type {boolean} */ open) => {
    outline.classList.toggle("open", !wide.matches && open);
    toggle.setAttribute("aria-expanded", String(wide.matches || open));
    toggle.setAttribute("aria-label", open ? "收起目录" : "展开目录");
    if (open) requestAnimationFrame(revealActive);
  };
  // h3 entries nest under the preceding h2; `sections[i]` is the h2 item that owns heading i.
  /** @type {Array<HTMLLIElement | null>} */
  const sections = [];
  /** @type {HTMLLIElement | null} */
  let section = null;
  /** @type {HTMLOListElement | null} */
  let sublist = null;
  const links = headings.map((heading, index) => {
    if (!heading.id) heading.id = `article-section-${index + 1}`;
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${encodeURIComponent(heading.id)}`;
    link.textContent = (heading.textContent ?? "").trim();
    link.title = link.textContent;
    link.addEventListener("click", () => { if (!wide.matches) setOpen(false); });
    item.append(link);
    if (heading.tagName === "H3" && section) {
      if (!sublist) {
        sublist = document.createElement("ol");
        section.append(sublist);
        section.classList.add("has-subsections");
      }
      sublist.append(item);
    } else {
      list.append(item);
      section = heading.tagName === "H2" ? item : null;
      sublist = null;
    }
    sections.push(section);
    return link;
  });
  nav.append(title, list);
  outline.append(toggle, nav);
  (layout ?? document.body).append(outline);
  setOpen(false);
  toggle.addEventListener("click", () => setOpen(!outline.classList.contains("open")));
  wide.addEventListener("change", () => setOpen(false));
  document.addEventListener("click", (event) => {
    if (outline.classList.contains("open") && !outline.contains(/** @type {Node} */ (event.target))) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && outline.classList.contains("open")) {
      setOpen(false);
      toggle.focus();
    }
  });
  if (window.location.hash) {
    try {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target && headings.includes(target)) requestAnimationFrame(() => target.scrollIntoView());
    } catch { /* Ignore malformed fragments. */ }
  }

  return {
    update() {
      const reached = headings.findLastIndex((heading) => heading.getBoundingClientRect().top <= window.innerHeight * 0.35);
      const changed = reached !== active;
      active = reached;
      links.forEach((link, index) => {
        link.classList.toggle("active", index === active);
        if (index === active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      // Only the section being read shows its subsections (on wide screens, via CSS).
      const current = active >= 0 ? sections[active] : null;
      for (const item of new Set(sections)) item?.classList.toggle("expanded", item === current);
      if (changed) revealActive();
    },
  };
}
