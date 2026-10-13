#!/usr/bin/env python3
"""Turn a LinkedIn post into a scene script for pipeline.py, using Claude.

Needs ANTHROPIC_API_KEY in the environment (set on the server, never in the repo or the browser).
VIDEO_STUDIO_MODEL picks the model (default claude-sonnet-5-5).
VIDEO_STUDIO_FAKE_SCRIPT=<file> skips Claude and reads that script instead (tests only).
"""
import json
import os
import re
from pathlib import Path

DEFAULT_MODEL = "claude-sonnet-5-5"

SYSTEM = """You write the script for a 45-60 second animated explainer video for a LinkedIn post.

Return ONLY a JSON object, no prose, with this shape:
{"title": "short title",
 "scenes": [ {"type": "...", "narration": "...", "caption": "...", "data": {...}}, ... ]}

Use 5 to 7 scenes, in this order of story: the problem (a comparison or a document), the
turn to the solution (quote), how the product works (app), and an end card.

Scene types and their data:
- "compare": data = {"left": {"label": "...", "sub": "...", "value": "5%"}, "right": {"label": "...", "sub": "...", "value": "12%"}, "badge": "≠"}
    Two big numbers side by side: the standard and the actual. Values are short (a number with unit).
- "problem": data = {"pages": "38", "waiting": "+6 waiting"}
    A long document landing on a person's desk. Use for workload or the overlooked detail.
- "app": data = {"screen_title": "Playbooks", "playbook_name": "...", "rule_code": "UPPER_CASE", "rule": "the rule as one sentence"}
    The product screen where a team sets its rule. Only use this for the product's own feature.
- "quote": data = {"text": "one bold statement, 6-14 words"}
    A statement on a dark background. Put the key phrase in <em>...</em>.
- "end": data = {"kicker": "...", "text": "...", "question": "...", "cta": "signverse.vtuae.com"}
    Closing card with a question for readers. cta is always signverse.vtuae.com.

Rules:
- Every scene has "narration" (1-2 spoken sentences, natural and warm, written for the ear) and
  "caption" (a short on-screen line of at most 14 words, the same idea as the narration).
  Captions may use <em>...</em> around one key phrase; do not use any other markup.
- Use only facts that are in the post. Never invent numbers, names, prices or results.
- Keep the post's meaning and its numbers exactly. Numbers in captions are digits.
- No emojis in narration or captions. Keep the post's call to action as the end question.
- Text limits: narration 20-400 characters, caption at most 130, rule at most 220, other text at most 170.
"""


def _extract_json(text):
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fenced:
        text = fenced.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("the model did not return a JSON object")
    return json.loads(text[start:end + 1])


def write_script(post, title=None):
    fake = os.environ.get("VIDEO_STUDIO_FAKE_SCRIPT")
    if fake:
        return json.loads(Path(fake).read_text(encoding="utf-8"))
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set on the server")
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    model = os.environ.get("VIDEO_STUDIO_MODEL", DEFAULT_MODEL)
    user = "LinkedIn post:\n\n" + post.strip()
    if title:
        user += f"\n\nTitle for the video: {title.strip()}"
    msg = client.messages.create(model=model, max_tokens=3000, system=SYSTEM,
                                 messages=[{"role": "user", "content": user}])
    text = "".join(block.text for block in msg.content if getattr(block, "type", "") == "text")
    return _extract_json(text)
