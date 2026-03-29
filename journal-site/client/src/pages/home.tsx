import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import type { JournalEntry } from "@shared/schema";
import { format, parseISO } from "date-fns";
import { Plus, Moon, Sun, BookOpen, GitBranch, Check, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/entries"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `./api/entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      toast({ title: "Entry deleted" });
    },
  });

  const categories = ["all", ...Array.from(new Set(entries.map((e) => e.category)))];

  const filtered = entries.filter((entry) => {
    const matchCategory = selectedCategory === "all" || entry.category === selectedCategory;
    const matchSearch =
      !searchQuery ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-label="Journal logo">
              <rect x="5" y="3" width="22" height="26" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M10 10h12M10 15h12M10 20h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <rect x="3" y="8" width="2" height="4" rx="1" fill="currentColor" />
              <rect x="3" y="16" width="2" height="4" rx="1" fill="currentColor" />
            </svg>
            <h1 className="text-lg font-semibold" style={{ fontFamily: "'Zodiak', Georgia, serif" }} data-testid="text-app-title">
              Journal
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/new">
              <Button size="sm" data-testid="button-new-entry">
                <Plus className="h-4 w-4 mr-1.5" />
                New Entry
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
                data-testid={`button-filter-${cat}`}
              >
                {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Entries list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-card border border-border p-5 animate-pulse">
                <div className="h-5 bg-muted rounded w-1/3 mb-3" />
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-lg font-medium mb-2" style={{ fontFamily: "'Zodiak', Georgia, serif" }}>
              {entries.length === 0 ? "Start your journal" : "No matching entries"}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {entries.length === 0
                ? "Write your first entry. It will be saved as Markdown and synced to your GitHub repository."
                : "Try a different search or category filter."}
            </p>
            {entries.length === 0 && (
              <Link href="/new">
                <Button data-testid="button-empty-new">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Write your first entry
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((entry) => {
              const preview = entry.content.replace(/[#*_`>\-\[\]()]/g, "").slice(0, 180);
              const tags: string[] = JSON.parse(entry.tags || "[]");
              return (
                <article
                  key={entry.id}
                  className="group rounded-xl bg-card border border-border p-5 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => navigate(`/edit/${entry.id}`)}
                  data-testid={`card-entry-${entry.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(entry.createdAt), "MMM d, yyyy")}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {entry.category}
                        </Badge>
                        {entry.synced ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
                            <Check className="h-3 w-3" />
                            synced
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <GitBranch className="h-3 w-3" />
                            pending
                          </span>
                        )}
                      </div>
                      <h2
                        className="font-semibold text-base mb-1 truncate"
                        style={{ fontFamily: "'Zodiak', Georgia, serif" }}
                        data-testid={`text-entry-title-${entry.id}`}
                      >
                        {entry.title}
                      </h2>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {preview}...
                      </p>
                      {tags.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-delete-${entry.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{entry.title}" and remove it from GitHub.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(entry.id)}
                              className="bg-destructive text-destructive-foreground"
                              data-testid={`button-confirm-delete-${entry.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pb-8 text-center">
          <p className="text-xs text-muted-foreground">
            Entries sync to{" "}
            <a
              href="https://github.com/namsler1/journal"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              namsler1/journal
            </a>{" "}
            on GitHub
          </p>
        </footer>
      </main>
    </div>
  );
}
