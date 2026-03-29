#!/usr/bin/env python3
"""
fetch-news.py — Gathers daily headlines for The Daily Brief.
Writes data/news.json with 5-6 articles per category.

Categories:
  - world-politics: World/global politics headlines
  - dfw-politics: Dallas-Fort Worth politics & government
  - ai-news: AI industry news
  - jpmorgan-chase: JPMorgan Chase company news
  - dfw-events: Upcoming DFW events & things to do

Usage: python3 fetch-news.py
  Called by the daily cron job, or manually.
  Requires the external-tool CLI for web search access.
"""

import asyncio
import json
import os
import sys
from datetime import datetime

# The search queries for each category
SEARCH_QUERIES = {
    "world-politics": [
        "world politics news today",
        "international affairs headlines today"
    ],
    "dfw-politics": [
        "Dallas Fort Worth politics news today",
        "DFW Texas local government news"
    ],
    "ai-news": [
        "artificial intelligence news today",
        "AI industry latest developments"
    ],
    "jpmorgan-chase": [
        "JPMorgan Chase news today",
        "JPMorgan Chase latest developments"
    ],
    "dfw-events": [
        "Dallas Fort Worth upcoming events this week",
        "DFW things to do events concerts festivals"
    ]
}

async def search_web(queries):
    """Use the external-tool CLI to search the web."""
    import subprocess
    results = []
    for query in queries:
        try:
            cmd = json.dumps({
                "source_id": "perplexity_search",
                "tool_name": "web_search",
                "arguments": {"query": query}
            })
            proc = await asyncio.create_subprocess_exec(
                "external-tool", "call", cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode == 0:
                data = json.loads(stdout.decode())
                results.append(data)
            else:
                print(f"  Search error for '{query}': {stderr.decode()}", file=sys.stderr)
        except Exception as e:
            print(f"  Search exception for '{query}': {e}", file=sys.stderr)
    return results


def parse_search_results(raw_results, max_articles=6):
    """Parse search API results into article objects."""
    articles = []
    seen_urls = set()
    
    for result in raw_results:
        # Handle different response formats
        items = []
        if isinstance(result, dict):
            content = result.get("content", result)
            if isinstance(content, str):
                try:
                    content = json.loads(content)
                except:
                    pass
            if isinstance(content, dict):
                items = content.get("results", content.get("items", content.get("web", {}).get("results", [])))
                if isinstance(items, str):
                    try:
                        items = json.loads(items)
                    except:
                        items = []
            elif isinstance(content, list):
                items = content
        elif isinstance(result, list):
            items = result
            
        for item in items:
            if len(articles) >= max_articles:
                break
            if not isinstance(item, dict):
                continue
                
            url = item.get("url", item.get("link", ""))
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            
            title = item.get("title", item.get("name", ""))
            summary = item.get("snippet", item.get("description", item.get("content", "")))
            image = item.get("image", item.get("thumbnail", item.get("thumbnailUrl", item.get("og_image", ""))))
            source = item.get("source", item.get("displayUrl", item.get("publisher", "")))
            
            # Extract source name from URL if not provided
            if not source and url:
                try:
                    from urllib.parse import urlparse
                    source = urlparse(url).netloc.replace("www.", "")
                except:
                    source = ""
            
            if title and url:
                # Truncate summary to ~200 chars
                if summary and len(summary) > 250:
                    summary = summary[:247] + "..."
                    
                articles.append({
                    "title": title,
                    "url": url,
                    "summary": summary or "",
                    "image": image or "",
                    "source": source or ""
                })
    
    return articles[:max_articles]


async def fetch_all_categories():
    """Fetch news for all categories."""
    data = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "generated_at": datetime.now().isoformat(),
        "categories": {}
    }
    
    for cat_id, queries in SEARCH_QUERIES.items():
        print(f"Fetching {cat_id}...")
        raw = await search_web(queries)
        articles = parse_search_results(raw, max_articles=6)
        data["categories"][cat_id] = articles
        print(f"  Found {len(articles)} articles")
    
    return data


async def main():
    print("=== The Daily Brief — News Fetch ===")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print()
    
    data = await fetch_all_categories()
    
    # Write to data/news.json
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    
    output_path = os.path.join(data_dir, "news.json")
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    
    print(f"\nWrote {output_path}")
    
    # Summary
    total = sum(len(articles) for articles in data["categories"].values())
    print(f"Total articles: {total}")
    for cat_id, articles in data["categories"].items():
        print(f"  {cat_id}: {len(articles)}")


if __name__ == "__main__":
    asyncio.run(main())
