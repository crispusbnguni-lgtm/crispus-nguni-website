"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowDown, ArrowUp, Copy, FilePlus2, Heart, NotebookPen, RotateCcw, Search, SendToBack, Trash2 } from "lucide-react";
import { LiquidLensSurface } from "@/components/ui/LiquidLensSurface";
import { WORKSPACE_BLOCK_TYPES } from "@/lib/personal-workspace-pages-core";

type Page = { id: string; parentId: string | null; title: string; iconKey: string | null; isFavorite: boolean; isPinned: boolean; sortOrder: number; revision: number; archivedAt: string | null; deletedAt: string | null; updatedAt: string };
type Block = { id: string; type: string; parentBlockId: string | null; sortOrder: number; revision: number; content: Record<string, unknown>; plainText: string; mediaAssetId?: string | null; items?: Array<{ text: string; checkedAt: string | null; dueAt: string | null }>; tableColumns?: Array<{ id: string; label: string; sortOrder: number }>; tableRows?: Array<{ id: string; cells: Array<{ columnId: string; value: string }> }> ; pageReference?: { targetPageId: string } | null; reminders?: Array<{ remindAt: string; timezone: string; status: string }> };
type SaveState = "saved" | "saving" | "unsaved" | "conflict" | "error";
type Template = { id: string; title: string; version: number; blockCount: number };

const EMPTY_CONTENT: Record<string, unknown> = {
  PARAGRAPH: { text: "" }, HEADING: { text: "Heading", level: 2 },
  BULLETED_LIST: { items: ["First item"] }, NUMBERED_LIST: { items: ["First item"] },
  CHECKLIST: { items: ["First item"] }, TODO: { items: ["First task"] },
  QUOTE: { text: "A thought worth keeping", attribution: "" }, CALLOUT: { text: "Useful context", tone: "info" },
  DIVIDER: {}, CODE: { code: "", language: "text" }, TABLE: { columns: ["Column 1", "Column 2"], rows: [["", ""]] },
  IMAGE: { assetId: null, alt: "Describe this image" }, LINK: { label: "Link", url: "https://" },
  TOGGLE: { title: "Expandable note", text: "Details" }, PAGE_REFERENCE: { targetPageId: "" },
  DATE: { date: new Date().toISOString(), label: "Date" }, REMINDER: { remindAt: new Date(Date.now() + 86_400_000).toISOString(), timezone: "Africa/Nairobi", label: "Reminder" },
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", credentials: "same-origin", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const body = await response.json() as { success?: boolean; data?: T; message?: string; code?: string; currentRevision?: number };
  if (!response.ok || !body.success) {
    const error = new Error(body.message ?? "Workspace request failed.") as Error & { status?: number; code?: string; currentRevision?: number };
    error.status = response.status; error.code = body.code; error.currentRevision = body.currentRevision; throw error;
  }
  return body.data as T;
}

function contentForEditor(block: Block): string {
  if (Array.isArray(block.items)) return JSON.stringify(block.items.map((item) => ({ text: item.text, checked: Boolean(item.checkedAt), dueAt: item.dueAt ?? null })), null, 2);
  if (block.type === "TABLE" && block.tableColumns && block.tableRows) {
    return JSON.stringify({ columns: block.tableColumns.map((column) => column.label), rows: block.tableRows.map((row) => block.tableColumns!.map((column) => row.cells.find((cell) => cell.columnId === column.id)?.value ?? "")) }, null, 2);
  }
  if (block.type === "PAGE_REFERENCE" && block.pageReference) return JSON.stringify({ targetPageId: block.pageReference.targetPageId }, null, 2);
  if (block.type === "IMAGE") return JSON.stringify({ assetId: block.mediaAssetId ?? null, alt: block.content.alt ?? "" }, null, 2);
  const content = { ...block.content };
  delete content.type;
  return JSON.stringify(content, null, 2);
}

function requestContent(block: Block, draft: string): unknown {
  if (["BULLETED_LIST", "NUMBERED_LIST", "CHECKLIST", "TODO"].includes(block.type)) {
    const items = JSON.parse(draft) as unknown;
    if (!Array.isArray(items)) throw new Error("List content must be a list of items.");
    return { items };
  }
  try { return JSON.parse(draft) as unknown; } catch { throw new Error("Enter valid JSON for this block before saving."); }
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 16) : "";
}

export function WorkspacePagesEditor() {
  const [pages, setPages] = useState<Page[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pageReload, setPageReload] = useState(0);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [mode, setMode] = useState<"active" | "favorites" | "pinned" | "archive" | "trash">("active");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Page[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const queues = useRef(new Map<string, Promise<void>>());
  const draftVersion = useRef(new Map<string, number>());
  const revisions = useRef(new Map<string, number>());
  const blockPages = useRef(new Map<string, string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const selectedPageId = selectedPage?.id ?? null;
  const selectedPageIdRef = useRef<string | null>(selectedPageId);
  useEffect(() => { selectedPageIdRef.current = selectedPageId; }, [selectedPageId]);
  const pageById = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const childIdsByParent = useMemo(() => {
    const children = new Map<string | null, string[]>();
    for (const page of pages) children.set(page.parentId, [...(children.get(page.parentId) ?? []), page.id]);
    return children;
  }, [pages]);
  const visiblePages = useMemo(() => pages.filter((page) => {
    let parentId = page.parentId;
    let depth = 0;
    while (parentId && depth < 6) {
      if (!expandedIds.has(parentId)) return false;
      parentId = pageById.get(parentId)?.parentId ?? null;
      depth += 1;
    }
    return !parentId;
  }), [pages, expandedIds, pageById]);

  const fetchPages = useCallback(async (view: typeof mode) => {
    const fetchParentPages = async (parentId: string) => {
      const result: Page[] = [];
      let cursor: string | null = null;
      do {
        const params: URLSearchParams = new URLSearchParams();
        params.set("parentId", parentId); params.set("view", view); params.set("limit", "100");
        if (cursor) params.set("cursor", cursor);
        const batch: Page[] = await api<Page[]>(`/api/dashboard/workspace/pages?${params.toString()}`);
        result.push(...batch);
        const lastPage: Page | undefined = batch[batch.length - 1];
        cursor = batch.length === 100 ? lastPage?.id ?? null : null;
      } while (cursor && result.length < 500);
      return result.slice(0, 500);
    };
    const first = await fetchParentPages(view === "active" ? "root" : "all");
    const all: Page[] = [];
    let frontier = first;
    while (frontier.length && all.length < 500) {
      all.push(...frontier.slice(0, 500 - all.length));
      if (view !== "active") break;
      const nested = await Promise.all(frontier.map((page) => fetchParentPages(page.id)));
      frontier = nested.flat().slice(0, 500 - all.length);
    }
    return all;
  }, []);

  const refreshPages = useCallback(async (view = mode) => {
    const all = await fetchPages(view);
    setPages(all);
    setSelectedId((current) => current || all[0]?.id || "");
  }, [fetchPages, mode]);

  const loadPage = useCallback(async (id: string) => {
    const page = await api<Page & { blocks: Block[] }>(`/api/dashboard/workspace/pages/${encodeURIComponent(id)}`);
    const initial: Record<string, string> = {};
    const restored = new Set<string>();
    for (const block of page.blocks ?? []) {
      blockPages.current.set(block.id, page.id);
      const localDraft = sessionStorage.getItem(`workspace-draft:${page.id}:${block.id}`);
      initial[block.id] = localDraft ?? contentForEditor(block);
      if (localDraft !== null) restored.add(block.id);
      revisions.current.set(block.id, block.revision);
      draftVersion.current.set(block.id, 0);
    }
    return { page, initial, states: Object.fromEntries(Object.keys(initial).map((key) => [key, restored.has(key) ? "unsaved" as SaveState : "saved" as SaveState])) };
  }, []);

  const openPage = useCallback((id: string) => {
    setError("");
    if (selectedId === id) setPageReload((current) => current + 1);
    else setSelectedId(id);
    setExpandedIds((current) => {
      const next = new Set(current);
      let page = pageById.get(id);
      let depth = 0;
      while (page?.parentId && depth < 5) { next.add(page.parentId); page = pageById.get(page.parentId); depth += 1; }
      return next;
    });
  }, [selectedId, pageById]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchPages("active"), api<Template[]>("/api/dashboard/workspace/templates")]).then(([items, pageTemplates]) => { if (active) { setPages(items); setSelectedId((current) => current || items[0]?.id || ""); setTemplates(pageTemplates); } }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to load workspace pages."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchPages]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    void loadPage(selectedId).then(({ page, initial, states: initialStates }) => { if (active) { setSelectedPage(page); setBlocks(page.blocks ?? []); setDrafts(initial); setStates(initialStates); } }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Unable to open this page."); });
    return () => { active = false; };
  }, [selectedId, pageReload, loadPage]);
  useEffect(() => {
    const activeTimers = timers.current;
    return () => { for (const timer of activeTimers.values()) clearTimeout(timer); activeTimers.clear(); };
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => { void api<Page[]>(`/api/dashboard/workspace/search?q=${encodeURIComponent(query.trim())}`).then((items) => { if (active) setResults(items); }).catch(() => { if (active) setResults([]); }); }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const saveBlock = useCallback((block: Block, localDraft: string, version: number) => {
    const pageIdForBlock = blockPages.current.get(block.id);
    const previous = queues.current.get(block.id) ?? Promise.resolve();
    setStates((current) => ({ ...current, [block.id]: "saving" }));
    const next = previous.catch(() => {}).then(async () => {
      const content = requestContent(block, localDraft);
      const expectedRevision = revisions.current.get(block.id) ?? block.revision;
      const saved = await api<Block>(`/api/dashboard/workspace/blocks/${encodeURIComponent(block.id)}`, { method: "PATCH", body: JSON.stringify({ expectedRevision, type: block.type, content }) });
      revisions.current.set(block.id, saved.revision);
      setBlocks((current) => current.map((item) => item.id === block.id ? saved : item));
      if (pageIdForBlock) {
        const page = await api<Page & { blocks: Block[] }>(`/api/dashboard/workspace/pages/${encodeURIComponent(pageIdForBlock)}`);
        setSelectedPage((current) => current?.id === pageIdForBlock ? { ...current, revision: page.revision } : current);
      }
      if (draftVersion.current.get(block.id) === version) {
        if (pageIdForBlock) sessionStorage.removeItem(`workspace-draft:${pageIdForBlock}:${block.id}`);
        setStates((current) => ({ ...current, [block.id]: "saved" }));
      }
    }).catch((cause: unknown) => {
      const conflict = cause as Error & { status?: number };
      setStates((current) => ({ ...current, [block.id]: conflict.status === 409 ? "conflict" : "error" }));
      setError(conflict.message);
    });
    queues.current.set(block.id, next);
  }, []);

  const changeDraft = useCallback((block: Block, value: string) => {
    setDrafts((current) => ({ ...current, [block.id]: value }));
    try { sessionStorage.setItem(`workspace-draft:${selectedPageIdRef.current}:${block.id}`, value); } catch { /* Keep the draft in component state if browser storage is unavailable. */ }
    setStates((current) => ({ ...current, [block.id]: "unsaved" }));
    const version = (draftVersion.current.get(block.id) ?? 0) + 1;
    draftVersion.current.set(block.id, version);
    const currentTimer = timers.current.get(block.id);
    if (currentTimer) { clearTimeout(currentTimer); timers.current.delete(block.id); }
  }, []);

  useEffect(() => {
    const activeTimers = timers.current;
    for (const block of blocks) {
      if (states[block.id] !== "unsaved" || activeTimers.has(block.id)) continue;
      const draft = drafts[block.id] ?? contentForEditor(block);
      const version = draftVersion.current.get(block.id) ?? 0;
      activeTimers.set(block.id, setTimeout(() => {
        activeTimers.delete(block.id);
        saveBlock(block, draft, version);
      }, 750));
    }
    return () => {
      for (const [id, timer] of activeTimers) {
        if (states[id] !== "unsaved") { clearTimeout(timer); activeTimers.delete(id); }
      }
    };
  }, [blocks, drafts, states, saveBlock]);

  async function createPage(templateId?: string, parentId?: string | null) {
    setError("");
    try {
      const page = await api<Page>("/api/dashboard/workspace/pages", { method: "POST", body: JSON.stringify({ title: templateId ? templates.find((item) => item.id === templateId)?.title : "Untitled", ...(parentId ? { parentId } : {}), ...(templateId ? { templateId } : {}) }) });
      if (parentId) setExpandedIds((current) => new Set(current).add(parentId));
      await refreshPages("active"); setSelectedId(page.id); setNotice(templateId ? "Template applied to your new page." : "Page created."); setMenuOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create the page."); }
  }

  async function addBlock(type: string) {
    if (!selectedPage) return;
    try {
      const block = await api<Block>(`/api/dashboard/workspace/pages/${encodeURIComponent(selectedPage.id)}/blocks`, { method: "POST", body: JSON.stringify({ type, content: EMPTY_CONTENT[type] }) });
      blockPages.current.set(block.id, selectedPage.id);
      revisions.current.set(block.id, block.revision);
      setBlocks((current) => [...current, block]); setDrafts((current) => ({ ...current, [block.id]: contentForEditor(block) })); setStates((current) => ({ ...current, [block.id]: "saved" })); setNotice("Block saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add this block."); }
  }

  async function changePage(fields: Record<string, unknown>) {
    if (!selectedPage) return;
    try {
      const page = await api<Page>(`/api/dashboard/workspace/pages/${encodeURIComponent(selectedPage.id)}`, { method: "PATCH", body: JSON.stringify({ ...fields, expectedRevision: selectedPage.revision }) });
      setSelectedPage(page); setPages((current) => current.map((item) => item.id === page.id ? page : item)); setNotice("Page saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update this page."); }
  }

  async function shiftPage(direction: -1 | 1) {
    if (!selectedPage) return;
    const siblings = pages.filter((page) => page.parentId === selectedPage.parentId).sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
    const index = siblings.findIndex((page) => page.id === selectedPage.id);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[index], reordered[destination]] = [reordered[destination]!, reordered[index]!];
    try {
      const saved = await api<Page[]>("/api/dashboard/workspace/pages/reorder", { method: "POST", body: JSON.stringify({ parentId: selectedPage.parentId, pageIds: reordered.map((page) => page.id) }) });
      setPages((current) => current.map((page) => saved.find((item) => item.id === page.id) ?? page));
      const currentSelected = saved.find((page) => page.id === selectedPage.id);
      if (currentSelected) setSelectedPage((page) => page ? { ...page, revision: currentSelected.revision, sortOrder: currentSelected.sortOrder } : page);
      setNotice("Page order saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reorder pages."); }
  }

  async function shiftBlock(block: Block, direction: -1 | 1) {
    if (!selectedPage) return;
    const siblings = blocks.filter((item) => item.parentBlockId === block.parentBlockId).sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
    const index = siblings.findIndex((item) => item.id === block.id);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[index], reordered[destination]] = [reordered[destination]!, reordered[index]!];
    try {
      const saved = await api<{ blocks: Array<{ id: string; parentBlockId: string | null; sortOrder: number; revision: number }>; page: { revision: number } }>(`/api/dashboard/workspace/pages/${encodeURIComponent(selectedPage.id)}/blocks/reorder`, { method: "POST", body: JSON.stringify({ parentBlockId: block.parentBlockId, blockIds: reordered.map((item) => item.id) }) });
      setBlocks((current) => current.map((item) => { const next = saved.blocks.find((candidate) => candidate.id === item.id); if (!next) return item; revisions.current.set(item.id, next.revision); return { ...item, sortOrder: next.sortOrder, revision: next.revision }; }));
      setSelectedPage((page) => page ? { ...page, revision: saved.page.revision } : page);
      setNotice("Block order saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to reorder blocks."); }
  }

  async function pageAction(action: "duplicate" | "archive" | "restore" | "trash" | "move") {
    if (!selectedPage) return;
    const suffix = action === "trash" ? "" : `/${action}`;
    try {
      if (action === "trash") await api(`/api/dashboard/workspace/pages/${selectedPage.id}`, { method: "DELETE" });
      else if (action === "move") await api(`/api/dashboard/workspace/pages/${selectedPage.id}/move`, { method: "POST", body: JSON.stringify({ parentId: null, expectedRevision: selectedPage.revision }) });
      else await api(`/api/dashboard/workspace/pages/${selectedPage.id}${suffix}`, { method: "POST" });
      setSelectedPage(null); setSelectedId(""); await refreshPages(mode); setNotice(`Page ${action === "trash" ? "moved to trash" : `${action}d`}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Unable to ${action} this page.`); }
  }

  async function exportDraft(block: Block) {
    const blob = new Blob([drafts[block.id] ?? ""], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `workspace-block-${block.id}.txt`; link.click(); URL.revokeObjectURL(link.href);
  }

  const breadcrumbs = useMemo(() => { const chain: Page[] = []; let cursor = selectedPage; while (cursor) { chain.unshift(cursor); cursor = cursor.parentId ? pageById.get(cursor.parentId) ?? null : null; } return chain; }, [selectedPage, pageById]);
  const toggleExpanded = (pageId: string) => setExpandedIds((current) => { const next = new Set(current); if (next.has(pageId)) next.delete(pageId); else next.add(pageId); return next; });

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 pb-20 pt-8 text-white sm:px-6 lg:grid-cols-[290px_minmax(0,1fr)] lg:px-8">
      <aside className={`${menuOpen ? "fixed inset-3 z-[70] block max-w-sm" : "hidden"} lg:relative lg:inset-auto lg:block lg:max-w-none`}>
        <LiquidLensSurface radius={24} className="flex max-h-[calc(100vh-2rem)] min-h-[28rem] flex-col overflow-hidden p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]">
          <div className="flex items-start justify-between gap-2"><div><p className="text-xs uppercase tracking-[.18em] text-[#D9A441]">Private workspace</p><h1 className="mt-1 text-xl font-semibold">Pages & notes</h1></div><button type="button" onClick={() => setMenuOpen(false)} className="rounded-lg px-2 py-1 text-sm text-white/60 lg:hidden">Close</button></div>
          <label className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-3"><Search size={15} className="text-white/45"/><input aria-label="Search pages" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages" className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"/></label>
          <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/15 p-1 text-xs">{(["active", "favorites", "pinned", "archive", "trash"] as const).map((item) => <button key={item} type="button" onClick={() => { setMode(item); setSelectedId(""); setPages([]); void refreshPages(item); }} className={`shrink-0 rounded-lg px-2 py-2 capitalize ${mode === item ? "bg-white/10 text-white" : "text-white/45 hover:text-white"}`}>{item}</button>)}</div>
          {mode === "active" && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void createPage()} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#D9A441]/30 bg-[#D9A441]/10 text-xs font-semibold text-[#F2CF86]"><FilePlus2 size={15}/> New page</button><details className="group relative"><summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] text-xs text-white/70"><NotebookPen size={15}/> Template</summary><div className="absolute right-0 z-10 mt-2 grid w-48 gap-1 rounded-xl border border-white/10 bg-[#111722] p-2 shadow-xl">{templates.map((template) => <button type="button" key={template.id} onClick={() => void createPage(template.id)} className="rounded-lg px-3 py-2 text-left text-xs hover:bg-white/10">{template.title}</button>)}</div></details></div>}
          <nav aria-label="Workspace page tree" className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {query.trim().length >= 2 ? results.map((page) => <PageItem key={page.id} page={page} selected={selectedId === page.id} hasChildren={false} expanded={false} onToggle={() => {}} onClick={() => { void openPage(page.id); setMenuOpen(false); }} depth={0}/>) : visiblePages.map((page) => <PageItem key={page.id} page={page} selected={selectedId === page.id} hasChildren={(childIdsByParent.get(page.id)?.length ?? 0) > 0} expanded={expandedIds.has(page.id)} onToggle={() => toggleExpanded(page.id)} onClick={() => { void openPage(page.id); setMenuOpen(false); }} depth={depthOf(page, pageById)}/>) }
            {!loading && pages.length === 0 && <p className="px-2 py-6 text-sm text-white/40">{mode === "active" ? "Your first page can start here." : `No pages in ${mode}.`}</p>}
          </nav>
          <p className="border-t border-white/10 pt-3 text-[11px] leading-5 text-white/40">Private to your account. Timed reminders are stored, but this app does not send timed notifications. Private image uploads are available in the media library below.</p>
        </LiquidLensSurface>
      </aside>
      {menuOpen && <button type="button" aria-label="Close page navigation" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-[60] bg-black/60 lg:hidden"/>}
      <main className="min-w-0">
        <div className="mb-4 flex items-center justify-between"><button type="button" onClick={() => setMenuOpen(true)} className="rounded-xl border border-white/10 bg-white/[.04] px-3 py-2 text-sm lg:hidden">Pages</button><span className="text-xs text-white/45">{loading ? "Loading pages…" : "Your work stays private"}</span></div>
        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-300/5 p-3 text-sm text-rose-100">{error}</div>}{notice && <p aria-live="polite" className="mb-4 text-sm text-emerald-200/80">{notice}</p>}
        {selectedPage ? <LiquidLensSurface radius={26} className="min-h-[65vh] p-5 sm:p-8">
          <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-white/45">{breadcrumbs.map((item, index) => <span key={item.id}>{index ? " / " : ""}{index === breadcrumbs.length - 1 ? <strong className="text-white/75">{item.title}</strong> : item.title}</span>)}</div>
          <div className="flex flex-wrap items-start justify-between gap-3"><label className="min-w-[14rem] flex-1"><span className="sr-only">Page title</span><input value={selectedPage.title} onChange={(event) => setSelectedPage((page) => page ? { ...page, title: event.target.value } : page)} onBlur={() => { if (selectedPage.title.trim()) void changePage({ title: selectedPage.title.trim() }); }} className="w-full bg-transparent text-3xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]"/></label><div className="flex flex-wrap gap-2"><button aria-label={selectedPage.isFavorite ? "Remove favorite" : "Add favorite"} onClick={() => void changePage({ isFavorite: !selectedPage.isFavorite })} className="rounded-lg border border-white/10 p-2 text-white/65 hover:text-[#F2CF86]"><Heart size={17} fill={selectedPage.isFavorite ? "currentColor" : "none"}/></button><button aria-label={selectedPage.isPinned ? "Unpin page" : "Pin page"} onClick={() => void changePage({ isPinned: !selectedPage.isPinned })} className="rounded-lg border border-white/10 p-2 text-white/65 hover:text-[#F2CF86]"><SendToBack size={17}/></button>{mode === "active" && <><button aria-label="Move page up" onClick={() => void shiftPage(-1)} className="rounded-lg border border-white/10 p-2 text-white/65"><ArrowUp size={16}/></button><button aria-label="Move page down" onClick={() => void shiftPage(1)} className="rounded-lg border border-white/10 p-2 text-white/65"><ArrowDown size={16}/></button></>}{mode !== "archive" && mode !== "trash" && <><button onClick={() => void createPage(undefined, selectedPage.id)} className="rounded-lg border border-[#D9A441]/30 px-3 py-2 text-xs text-[#F2CF86]"><FilePlus2 size={14} className="mr-1 inline"/>New subpage</button><button onClick={() => void pageAction("duplicate")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65"><Copy size={14} className="mr-1 inline"/>Duplicate</button></>}{mode === "archive" || mode === "trash" ? <button onClick={() => void pageAction("restore")} className="rounded-lg border border-emerald-300/20 px-3 py-2 text-xs text-emerald-100/80"><RotateCcw size={14} className="mr-1 inline"/>Restore</button> : <><button onClick={() => void pageAction("archive")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65"><Archive size={14} className="mr-1 inline"/>Archive</button><button onClick={() => void pageAction("trash")} className="rounded-lg border border-rose-300/20 px-3 py-2 text-xs text-rose-100/70"><Trash2 size={14} className="mr-1 inline"/>Trash</button></>}</div></div>
          <div className="mt-8 grid gap-4">{blocks.map((block) => { const siblings = blocks.filter((item) => item.parentBlockId === block.parentBlockId).sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id)); const index = siblings.findIndex((item) => item.id === block.id); return <BlockEditor key={block.id} block={block} canMoveUp={index > 0} canMoveDown={index >= 0 && index < siblings.length - 1} onMoveUp={() => void shiftBlock(block, -1)} onMoveDown={() => void shiftBlock(block, 1)} value={drafts[block.id] ?? contentForEditor(block)} state={states[block.id] ?? "saved"} onChange={(value) => changeDraft(block, value)} onExport={() => void exportDraft(block)} onRetry={() => changeDraft(block, drafts[block.id] ?? contentForEditor(block))} onReload={() => { if (confirm("Discard this local draft and load the latest saved page? Export first if you may need it.")) void openPage(selectedPage.id); }} onDelete={() => { void api(`/api/dashboard/workspace/blocks/${block.id}`, { method: "DELETE" }).then(() => { setBlocks((current) => current.filter((item) => item.id !== block.id)); sessionStorage.removeItem(`workspace-draft:${selectedPage.id}:${block.id}`); setNotice("Block deleted."); }).catch((cause: Error) => setError(cause.message)); }}/>; })}</div>
          <div className="mt-6 flex flex-wrap gap-2"><select id="new-workspace-block" className="min-h-10 max-w-full rounded-xl border border-white/10 bg-[#111722] px-3 text-xs text-white">{WORKSPACE_BLOCK_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ").toLowerCase()}</option>)}</select><button type="button" onClick={() => { const select = document.getElementById("new-workspace-block") as HTMLSelectElement | null; if (select) void addBlock(select.value); }} className="rounded-xl border border-[#D9A441]/30 bg-[#D9A441]/10 px-4 py-2 text-xs font-semibold text-[#F2CF86]">Add block</button>{mode !== "archive" && mode !== "trash" && <button type="button" onClick={() => void pageAction("move")} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/65">Move to top level</button>}</div>
          <p className="mt-8 text-xs text-white/35">Autosave is revision checked. Conflicts keep your local text available for export; no server refresh replaces your edits.</p>
        </LiquidLensSurface> : <LiquidLensSurface radius={26} className="grid min-h-[65vh] place-items-center p-8 text-center"><div><NotebookPen className="mx-auto text-[#D9A441]" size={30}/><h2 className="mt-4 text-xl font-semibold">Start with a page</h2><p className="mt-2 max-w-sm text-sm leading-6 text-white/50">Create a page or choose a template. Your workspace is separate from your public portfolio.</p><button onClick={() => void createPage()} className="mt-5 rounded-full border border-[#D9A441]/30 bg-[#D9A441]/10 px-5 py-2.5 text-sm font-semibold text-[#F2CF86]">Create a page</button></div></LiquidLensSurface>}
      </main>
    </div>
  );
}

function depthOf(page: Page, pages: Map<string, Page>) { let depth = 0; let cursor = page.parentId; while (cursor && depth < 5) { cursor = pages.get(cursor)?.parentId ?? null; depth += 1; } return depth; }

function PageItem({ page, selected, hasChildren, expanded, onToggle, onClick, depth }: { page: Page; selected: boolean; hasChildren: boolean; expanded: boolean; onToggle: () => void; onClick: () => void; depth: number }) {
  return <div className="mb-1 flex min-h-10 items-center gap-1" style={{ paddingLeft: `${depth * 15}px` }}><button type="button" onClick={onClick} className={`flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left text-sm ${selected ? "bg-[#D9A441]/15 text-[#F2CF86]" : "text-white/65 hover:bg-white/[.06] hover:text-white"}`}><span aria-hidden="true" className="text-white/35">{page.isPinned ? "⌑" : page.isFavorite ? "♡" : "▰"}</span><span className="truncate">{page.title || "Untitled"}</span></button>{hasChildren && <button type="button" aria-label={`${expanded ? "Collapse" : "Expand"} ${page.title || "Untitled"} child pages`} aria-expanded={expanded} onClick={onToggle} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/55 hover:bg-white/[.06] hover:text-white">{expanded ? "−" : "+"}</button>}</div>;
}

function BlockEditor({ block, value, state, onChange, onExport, onRetry, onReload, onDelete, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: { block: Block; value: string; state: SaveState; onChange: (value: string) => void; onExport: () => void; onRetry: () => void; onReload: () => void; onDelete: () => void; canMoveUp: boolean; canMoveDown: boolean; onMoveUp: () => void; onMoveDown: () => void }) {
  const label = state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "conflict" ? "Conflict — local text kept" : state === "error" ? "Unsaved — retry by editing" : "Unsaved changes";
  return <section style={{ marginLeft: block.parentBlockId ? 20 : 0 }} className="rounded-2xl border border-white/10 bg-white/[.025] p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#D9A441]/80">{block.type.replaceAll("_", " ").toLowerCase()}</p><div className="flex items-center gap-2"><span aria-live="polite" className={`text-[11px] ${state === "conflict" || state === "error" ? "text-rose-200" : "text-white/40"}`}>{label}</span><button aria-label="Move block up" disabled={!canMoveUp} onClick={onMoveUp} className="rounded-md p-1 text-white/45 disabled:opacity-20"><ArrowUp size={14}/></button><button aria-label="Move block down" disabled={!canMoveDown} onClick={onMoveDown} className="rounded-md p-1 text-white/45 disabled:opacity-20"><ArrowDown size={14}/></button>{(state === "conflict" || state === "error") && <button onClick={onExport} className="text-[11px] underline">Export draft</button>}{state === "conflict" && <button onClick={onReload} className="text-[11px] underline">Reload latest</button>}{state === "error" && <button onClick={onRetry} className="text-[11px] underline">Retry</button>}<button aria-label="Delete block" onClick={onDelete} className="rounded-md p-1 text-white/35 hover:text-rose-200"><Trash2 size={14}/></button></div></div>{block.type === "DIVIDER" ? <hr className="border-white/10"/> : ["BULLETED_LIST", "NUMBERED_LIST", "CHECKLIST", "TODO"].includes(block.type) ? <ListBlockEditor value={value} onChange={onChange} checklist={["CHECKLIST", "TODO"].includes(block.type)}/> : <StructuredBlockEditor block={block} value={value} onChange={onChange}/>}</section>;
}

function StructuredBlockEditor({ block, value, onChange }: { block: Block; value: string; onChange: (value: string) => void }) {
  let data: Record<string, unknown> = {};
  try { const parsed = JSON.parse(value) as unknown; if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) data = parsed as Record<string, unknown>; } catch { /* Each control rewrites a valid structured value. */ }
  const update = (key: string, next: unknown) => onChange(JSON.stringify({ ...data, [key]: next }, null, 2));
  const inputClass = "min-h-10 w-full rounded-xl border border-white/[.08] bg-black/10 px-3 text-sm text-white/80 outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]";
  const textAreaClass = "min-h-24 w-full rounded-xl border border-white/[.08] bg-black/10 p-3 text-sm leading-6 text-white/80 outline-none focus-visible:ring-2 focus-visible:ring-[#D9A441]";
  const text = (key: string) => typeof data[key] === "string" ? data[key] as string : "";
  if (block.type === "PARAGRAPH") return <textarea aria-label="Paragraph text" value={text("text")} onChange={(event) => update("text", event.target.value)} className={textAreaClass}/>;
  if (block.type === "HEADING") return <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]"><input aria-label="Heading text" value={text("text")} onChange={(event) => update("text", event.target.value)} className={inputClass}/><select aria-label="Heading level" value={Number(data.level) || 2} onChange={(event) => update("level", Number(event.target.value))} className={`${inputClass} bg-[#111722]`}><option value={1}>Heading 1</option><option value={2}>Heading 2</option><option value={3}>Heading 3</option></select></div>;
  if (["QUOTE", "CALLOUT"].includes(block.type)) return <div className="grid gap-2"><textarea aria-label="Block text" value={text("text")} onChange={(event) => update("text", event.target.value)} className={textAreaClass}/>{block.type === "QUOTE" ? <input aria-label="Attribution" value={text("attribution")} onChange={(event) => update("attribution", event.target.value)} placeholder="Attribution (optional)" className={inputClass}/> : <select aria-label="Callout tone" value={text("tone") || "info"} onChange={(event) => update("tone", event.target.value)} className={`${inputClass} bg-[#111722]`}>{["neutral", "info", "success", "warning"].map((tone) => <option key={tone}>{tone}</option>)}</select>}</div>;
  if (block.type === "TOGGLE") return <div className="grid gap-2"><input aria-label="Toggle title" value={text("title")} onChange={(event) => update("title", event.target.value)} className={inputClass}/><textarea aria-label="Toggle details" value={text("text")} onChange={(event) => update("text", event.target.value)} className={textAreaClass}/></div>;
  if (block.type === "CODE") return <div className="grid gap-2"><input aria-label="Code language" value={text("language")} onChange={(event) => update("language", event.target.value)} className={inputClass}/><textarea aria-label="Code text" value={text("code")} onChange={(event) => update("code", event.target.value)} className={`${textAreaClass} font-mono`}/></div>;
  if (block.type === "LINK") return <div className="grid gap-2 sm:grid-cols-2"><input aria-label="Link label" value={text("label")} onChange={(event) => update("label", event.target.value)} className={inputClass}/><input aria-label="Link URL" inputMode="url" value={text("url")} onChange={(event) => update("url", event.target.value)} className={inputClass}/></div>;
  if (block.type === "IMAGE") return <div className="grid gap-2"><input aria-label="Image alt text" value={text("alt")} onChange={(event) => update("alt", event.target.value)} className={inputClass}/><p className="text-xs text-white/40">{data.assetId ? "Private media reference attached." : "Private uploads are managed in the media library below. Page-image rendering is not enabled yet."}</p></div>;
  if (block.type === "TABLE") {
    const columns = Array.isArray(data.columns) ? data.columns.map((item) => String(item)) : ["Column 1"];
    const rows = Array.isArray(data.rows) ? data.rows.map((row) => Array.isArray(row) ? row.map((item) => String(item)) : []) : [[""]];
    const setTable = (nextColumns: string[], nextRows: string[][]) => onChange(JSON.stringify({ columns: nextColumns, rows: nextRows }, null, 2));
    return <div className="grid gap-2 overflow-x-auto"><table className="min-w-full border-collapse text-sm"><thead><tr>{columns.map((column, columnIndex) => <th key={columnIndex} className="min-w-36 border border-white/10 p-1"><input aria-label={`Table column ${columnIndex + 1}`} value={column} onChange={(event) => { const next = [...columns]; next[columnIndex] = event.target.value; setTable(next, rows); }} className="w-full bg-transparent px-2 py-1 text-left font-medium outline-none"/></th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{columns.map((_, columnIndex) => <td key={columnIndex} className="border border-white/10 p-1"><input aria-label={`Table row ${rowIndex + 1} column ${columnIndex + 1}`} value={row[columnIndex] ?? ""} onChange={(event) => { const next = rows.map((current) => [...current]); next[rowIndex]![columnIndex] = event.target.value; setTable(columns, next); }} className="w-full min-w-36 bg-transparent px-2 py-1 outline-none"/></td>)}</tr>)}</tbody></table><div className="flex gap-2"><button type="button" disabled={columns.length >= 20} onClick={() => setTable([...columns, `Column ${columns.length + 1}`], rows.map((row) => [...row, ""]))} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 disabled:opacity-40">Add column</button><button type="button" disabled={rows.length >= 50} onClick={() => setTable(columns, [...rows, columns.map(() => "")])} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 disabled:opacity-40">Add row</button></div></div>;
  }
  if (block.type === "PAGE_REFERENCE") return <input aria-label="Referenced page ID" value={text("targetPageId")} onChange={(event) => update("targetPageId", event.target.value)} className={inputClass}/>;
  if (block.type === "DATE") return <div className="grid gap-2 sm:grid-cols-2"><input aria-label="Date" type="date" value={text("date").slice(0, 10)} onChange={(event) => update("date", event.target.value)} className={inputClass}/><input aria-label="Date label" value={text("label")} onChange={(event) => update("label", event.target.value)} className={inputClass}/></div>;
  if (block.type === "REMINDER") return <div className="grid gap-2 sm:grid-cols-3"><input aria-label="Reminder time" type="datetime-local" value={toLocalDateTime(text("remindAt"))} onChange={(event) => update("remindAt", event.target.value ? new Date(event.target.value).toISOString() : "")} className={inputClass}/><input aria-label="Reminder timezone" value={text("timezone")} onChange={(event) => update("timezone", event.target.value)} className={inputClass}/><input aria-label="Reminder label" value={text("label")} onChange={(event) => update("label", event.target.value)} className={inputClass}/><p className="text-xs text-white/40 sm:col-span-3">Reminder is stored in your workspace. This app does not send timed notifications.</p></div>;
  return <textarea aria-label={`${block.type.replaceAll("_", " ")} content`} value={value} onChange={(event) => onChange(event.target.value)} className={textAreaClass}/>;
}

function ListBlockEditor({ value, onChange, checklist }: { value: string; onChange: (value: string) => void; checklist: boolean }) {
  let items: Array<{ text: string; checked: boolean; dueAt: string | null }> = [];
  try { const parsed = JSON.parse(value) as unknown; if (Array.isArray(parsed)) items = parsed.filter((item): item is { text: string; checked: boolean; dueAt: string | null } => typeof item === "object" && item !== null && typeof item.text === "string"); } catch { /* Keep the editor responsive while a local draft is incomplete. */ }
  function change(index: number, patch: Partial<(typeof items)[number]>) { onChange(JSON.stringify(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item), null, 2)); }
  return <div className="grid gap-2">{items.map((item, index) => <div key={`${index}-${item.text}`} className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-black/10 px-3 py-2">{checklist && <input aria-label={`Mark ${item.text || `item ${index + 1}`} complete`} type="checkbox" checked={item.checked} onChange={(event) => change(index, { checked: event.target.checked })} className="h-4 w-4 accent-[#D9A441]"/>}<input aria-label={`Item ${index + 1}`} value={item.text} onChange={(event) => change(index, { text: event.target.value })} className="min-h-9 min-w-0 flex-1 bg-transparent text-sm text-white/80 outline-none"/><button type="button" disabled={items.length <= 1} aria-label={`Remove item ${index + 1}`} onClick={() => onChange(JSON.stringify(items.filter((_, itemIndex) => itemIndex !== index), null, 2))} className="px-1 text-white/35 hover:text-rose-200 disabled:opacity-20">×</button></div>)}<button type="button" disabled={items.length >= 100} onClick={() => onChange(JSON.stringify([...items, { text: "", checked: false, dueAt: null }], null, 2))} className="justify-self-start rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 disabled:opacity-40">Add item</button></div>;
}
