import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, BookOpen, Church } from "lucide-react";

type GenerateType = "devotional" | "sermon-notes";

interface GenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateDialog({ open, onOpenChange }: GenerateDialogProps) {
  const [topic, setTopic] = useState("");
  const [genType, setGenType] = useState<GenerateType>("devotional");
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Generate content
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "./api/generate-devotional", {
        topic: topic.trim(),
        type: genType,
      });
      return res.json() as Promise<{ title: string; content: string; category: string }>;
    },
    onSuccess: async (generated) => {
      // Create the entry
      const now = new Date().toISOString();
      const res = await apiRequest("POST", "./api/entries", {
        title: generated.title,
        content: generated.content,
        category: generated.category,
        tags: JSON.stringify(["ai-generated"]),
        createdAt: now,
        updatedAt: now,
      });
      const entry = await res.json();

      queryClient.invalidateQueries({ queryKey: ["/api/entries"] });
      onOpenChange(false);
      setTopic("");

      toast({
        title: genType === "sermon-notes" ? "Sermon notes generated" : "Devotional generated",
        description: `"${generated.title}" saved and syncing to GitHub.`,
      });

      // Navigate to the new entry
      navigate(`/edit/${entry.id}`);
    },
    onError: (err: Error) => {
      toast({
        title: "Generation failed",
        description: err.message || "Could not generate content. Check that your API key is configured.",
        variant: "destructive",
      });
    },
  });

  const isGenerating = generateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={isGenerating ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            style={{ fontFamily: "'General Sans', 'Satoshi', sans-serif" }}
          >
            <Sparkles className="h-5 w-5 text-primary" />
            Generate with AI
          </DialogTitle>
          <DialogDescription>
            Enter a topic, scripture reference, or theme. Your devotional companion will create
            personalized content informed by your recent journal entries and prayers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setGenType("devotional")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors ${
                genType === "devotional"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Devotional
            </button>
            <button
              type="button"
              onClick={() => setGenType("sermon-notes")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-3 text-sm font-medium transition-colors ${
                genType === "sermon-notes"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-accent"
              }`}
            >
              <Church className="h-4 w-4" />
              Sermon Notes
            </button>
          </div>

          {/* Topic input */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {genType === "devotional" ? "Topic or Scripture" : "Sermon Topic"}
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={
                genType === "devotional"
                  ? "e.g., Philippians 4:6-7, trusting God in uncertainty, patience with teenagers..."
                  : "e.g., The Prodigal Son, Grace under pressure, Psalm 23..."
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={3}
              disabled={isGenerating}
              data-testid="input-generate-topic"
              autoFocus
            />
          </div>

          {/* Generating state */}
          {isGenerating && (
            <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-primary">
                {genType === "devotional"
                  ? "Your devotional companion is writing..."
                  : "Generating sermon notes..."}
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!topic.trim() || isGenerating}
            data-testid="button-generate-submit"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
