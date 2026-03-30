import sys
print("starting ddg test", file=sys.stderr)
try:
    from duckduckgo_search import DDGS
    with DDGS() as ddgs:
        results = list(ddgs.text("top competitors for project management software", max_results=3, backend="html"))
        print(f"Got {len(results)} results", file=sys.stderr)
        for r in results:
            print(f"- {r.get('title', '')}: {r.get('body', '')[:50]}...")
    print("done", file=sys.stderr)
except Exception as e:
    print(f"Error: {e}")
