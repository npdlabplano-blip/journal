import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation, useParams } from "wouter";
import type { JournalEntry } from "@shared/schema";
import { marked } from "marked";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Save,
  Eye,
  Pencil,
  GitBranch,
  Check,
  Loader2,
  Moon,
  Sun,
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Minus,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { Link } from "wouter";

const CATEGORIES = ["entries", "bible-study", "prayers", "sermons"];

// Configure marked for safe HTML rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function formatCategoryLabel(cat: string) {
  return cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " ");
}

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const isEditing = Boolean(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("entries");
  const [tagsInput, setTagsInput] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState("");

  // Load all entries for the sidebar
  const { data: allEntries = [] } = useQuery<JournalEntry[]>({
    queryKey: ["/api/entries"],
  });

  // Load existing entry
  const { data: existingEntry, isLoading: loadingEntry } = useQuery<JournalEntry>({
    queryKey: ["/api/entries", params.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `./api/entries/${params.id}`);
      return res.json();
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingEntry) {
      setTitle(existingEntry.title);
      setContent(existingEntry.content);
      setCategory(existingEntry.category);
      const tags = JSON.parse(existingEntry.tags || "[]");
      setTagsInput(tags.join(", "));
    }
  }, [existingEntry]);

  // Reset form when navigating to /new
  useEffect(() => {
    if (!isEditing) {
      setTitle("");
      setContent("");
      setCategory("entries");
      setTagsInput("");
      setIsDirty(false);
    }
  }, [isEditing]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      category: string;
      tags: string;
      createdAt: string;
      updatedAt: string;
    }) => {
      const res = await apiRequest("POST", "./api/entries", data);
      return res.json();
    },
    onSuccess: (entry: JournalEntry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      setIsDirty(false);
      toast({
        title: "Entry created",
        description: entry.synced ? "Saved and synced to GitHub." : "Saved locally. GitHub sync pending.",
      });
      navigate(`/edit/${entry.id}`);
    },
    onError: () => {
      toast({ title: "Error creating entry", variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      category: string;
      tags: string;
    }) => {
      const res = await apiRequest("PATCH", `./api/entries/${params.id}`, data);
      return res.json();
    },
    onSuccess: (entry: JournalEntry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries", params.id] });
      setIsDirty(false);
      toast({
        title: "Entry saved",
        description: entry.synced ? "Synced to GitHub." : "Saved. GitHub sync pending.",
      });
    },
    onError: () => {
      toast({ title: "Error saving entry", variant: "destructive" });
    },
  });

  const handleSave = useCallback(() => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Title and content are required", variant: "destructive" });
      return;
    }

    const tags = JSON.stringify(
      tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    );
    const now = new Date().toISOString();

    if (isEditing) {
      updateMutation.mutate({ title, content, category, tags });
    } else {
      createMutation.mutate({
        title,
        content,
        category,
        tags,
        createdAt: now,
        updatedAt: now,
      });
    }
  }, [title, content, category, tagsInput, isEditing]);

  // Auto-save on content changes (debounced)
  useEffect(() => {
    if (!isEditing || !isDirty) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const timer = setTimeout(() => {
      if (title.trim() && content.trim()) {
        handleSave();
      }
    }, 3000);
    setAutoSaveTimer(timer);
    return () => clearTimeout(timer);
  }, [content, title, category, tagsInput, isDirty, isEditing]);

  // Mark dirty on changes
  const markDirty = () => setIsDirty(true);

  // Toolbar formatting helpers
  const insertFormatting = (before: string, after = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${before}${selected || "text"}${after}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    markDirty();
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + (selected || "text").length);
    }, 0);
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const renderedHtml = (() => {
    try {
      return marked(content || "Nothing to preview yet...");
    } catch {
      return "<p>Error rendering markdown</p>";
    }
  })();

  // Group entries by category for sidebar
  const filteredEntries = allEntries.filter((e) => {
    if (!sidebarSearch) return true;
    return e.title.toLowerCase().includes(sidebarSearch.toLowerCase());
  });

  const groupedEntries = CATEGORIES.reduce(
    (acc, cat) => {
      const catEntries = filteredEntries.filter((e) => e.category === cat);
      if (catEntries.length > 0) acc[cat] = catEntries;
      return acc;
    },
    {} as Record<string, JournalEntry[]>
  );

  if (loadingEntry) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="button-toggle-sidebar"
              aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </Button>
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <span className="text-sm text-muted-foreground">
              {isEditing ? "Editing" : "New entry"}
            </span>
            {isEditing && existingEntry && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                {existingEntry.synced ? (
                  <>
                    <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <span className="text-green-600 dark:text-green-400">Synced</span>
                  </>
                ) : (
                  <>
                    <GitBranch className="h-3 w-3" />
                    Pending sync
                  </>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              data-testid="button-toggle-preview"
            >
              {showPreview ? (
                <>
                  <Pencil className="h-4 w-4 mr-1.5" />
                  Edit
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1.5" />
                  Preview
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !title.trim() || !content.trim()}
              data-testid="button-save"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </header>

      {/* Body: sidebar + editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "w-72" : "w-0"
          } flex-shrink-0 border-r border-border bg-card transition-all duration-200 overflow-hidden`}
        >
          <div className="w-72 h-full flex flex-col">
            {/* Sidebar header */}
            <div className="p-3 border-b border-border space-y-2">
              <Link href="/new">
                <Button size="sm" className="w-full" data-testid="button-sidebar-new">
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Entry
                </Button>
              </Link>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  data-testid="input-sidebar-search"
                />
              </div>
            </div>

            {/* Entries list */}
            <div className="flex-1 overflow-y-auto">
              {Object.keys(groupedEntries).length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {sidebarSearch ? "No matching entries" : "No entries yet"}
                </div>
              ) : (
                Object.entries(groupedEntries).map(([cat, entries]) => (
                  <div key={cat}>
                    <div className="px-3 pt-3 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {formatCategoryLabel(cat)}
                      </span>
                    </div>
                    {entries.map((entry) => {
                      const isActive = params.id === String(entry.id);
                      return (
                        <Link key={entry.id} href={`/edit/${entry.id}`}>
                          <button
                            className={`w-full text-left px-3 py-2 transition-colors ${
                              isActive
                                ? "bg-primary/10 border-l-2 border-primary"
                                : "hover:bg-accent border-l-2 border-transparent"
                            }`}
                            data-testid={`sidebar-entry-${entry.id}`}
                          >
                            <div className="truncate text-sm font-medium leading-tight">
                              {entry.title}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {format(parseISO(entry.createdAt), "MMM d, yyyy")}
                              </span>
                              {entry.synced ? (
                                <Check className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                              ) : (
                                <GitBranch className="h-2.5 w-2.5 text-muted-foreground" />
                              )}
                            </div>
                          </button>
                        </Link>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Editor area */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-6">
            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                markDirty();
              }}
              placeholder="Entry title..."
              className="w-full text-xl font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/50 mb-4"
              style={{ fontFamily: "'General Sans', 'Satoshi', sans-serif", letterSpacing: '-0.02em' }}
              data-testid="input-title"
            />

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mb-5 pb-5 border-b border-border">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    markDirty();
                  }}
                  className="text-sm bg-secondary rounded-md px-2.5 py-1 border-none outline-none text-secondary-foreground"
                  data-testid="select-category"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {formatCategoryLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground font-medium">Tags</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => {
                    setTagsInput(e.target.value);
                    markDirty();
                  }}
                  placeholder="faith, work, family..."
                  className="flex-1 text-sm bg-secondary rounded-md px-2.5 py-1 border-none outline-none placeholder:text-muted-foreground/50"
                  data-testid="input-tags"
                />
              </div>
              {isEditing && existingEntry && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(existingEntry.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </span>
              )}
            </div>

            {showPreview ? (
              /* Preview */
              <div
                className="prose-journal min-h-[400px]"
                dangerouslySetInnerHTML={{ __html: renderedHtml as string }}
                data-testid="div-preview"
              />
            ) : (
              /* Editor */
              <div>
                {/* Formatting toolbar */}
                <div className="flex items-center gap-0.5 mb-3 pb-3 border-b border-border flex-wrap">
                  <ToolbarButton icon={Bold} label="Bold" onClick={() => insertFormatting("**", "**")} />
                  <ToolbarButton icon={Italic} label="Italic" onClick={() => insertFormatting("_", "_")} />
                  <div className="w-px h-5 bg-border mx-1" />
                  <ToolbarButton icon={Heading2} label="Heading" onClick={() => insertFormatting("## ", "")} />
                  <ToolbarButton icon={Quote} label="Quote" onClick={() => insertFormatting("> ", "")} />
                  <div className="w-px h-5 bg-border mx-1" />
                  <ToolbarButton icon={List} label="Bullet list" onClick={() => insertFormatting("- ", "")} />
                  <ToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => insertFormatting("1. ", "")} />
                  <div className="w-px h-5 bg-border mx-1" />
                  <ToolbarButton icon={Code} label="Code" onClick={() => insertFormatting("`", "`")} />
                  <ToolbarButton icon={LinkIcon} label="Link" onClick={() => insertFormatting("[", "](url)")} />
                  <ToolbarButton icon={Minus} label="Divider" onClick={() => insertFormatting("\n---\n", "")} />
                </div>

                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    markDirty();
                  }}
                  placeholder="Start writing in Markdown..."
                  className="w-full min-h-[500px] bg-transparent border-none outline-none resize-none text-sm leading-relaxed placeholder:text-muted-foreground/50 font-mono"
                  style={{ tabSize: 2 }}
                  data-testid="textarea-content"
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Status bar */}
      <footer className="border-t border-border bg-background">
        <div className="px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{content.split(/\s+/).filter(Boolean).length} words</span>
          <div className="flex items-center gap-3">
            {isDirty && <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>}
            {isEditing && existingEntry?.githubPath && (
              <span className="hidden sm:inline">{existingEntry.githubPath}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
