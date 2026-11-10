#!/usr/bin/env python3
"""
Image + tool-calling dataset for Seishin's multimodal on-device agent.

Renders synthetic photos/screenshots the user would attach in the agent chat —
class schedules, event posters, bills, assignment sheets, chat screenshots,
handwritten notes, plus plain shape pictures for visual grounding — each with
its ground truth, and writes conversations where the model reads the image and
calls the right Seishin tools (add_event / add_todo / add_note), or just answers.

Mixed with text-only conversations from generate_dataset.py so the model keeps
its text tool-calling skills.

    pip install pillow
    python3 generate_vision_dataset.py --train 1600 --eval 160 --out data_vision/

Images are sized to ≤ 262k pixels (≤ 256 Qwen3-VL image tokens), matching the
app's `image_max_tokens: 256`. User turns put the image first, then text —
the order llama.rn renders an attachment in.
"""
from __future__ import annotations

import argparse
import glob
import json
import math
import random
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

import generate_dataset as G

HERE = Path(__file__).resolve().parent
SIZES = [(512, 512), (448, 576), (576, 448), (384, 640), (640, 384)]

# --------------------------------------------------------------------------- #
# Rendering helpers                                                            #
# --------------------------------------------------------------------------- #

_FONTS: dict[str, list[str]] = {}


def renders_latin(path: str) -> bool:
    """Reject fonts that draw tofu boxes for Latin text (CJK/symbol-only fonts)."""
    try:
        f = ImageFont.truetype(path, 24)
        a, b = f.getmask("abcdefgh"), f.getmask("hgfedcba")
        return a.getbbox() is not None and bytes(a) != bytes(b) and bytes(f.getmask("0123")) != bytes(f.getmask("3210"))
    except OSError:
        return False


def fonts(kind: str) -> list[str]:
    if not _FONTS:
        every = [f for f in glob.glob("/usr/share/fonts/**/*.[ot]tf", recursive=True)
                 if not any(x in f.lower() for x in ("emoji", "symbol", "math", "music", "dingbat", "thin", "light", "hairline"))
                 and renders_latin(f)]
        _FONTS["bold"] = [f for f in every if "bold" in f.lower()] or every
        _FONTS["hand"] = [f for f in every if any(x in f.lower() for x in ("italic", "oblique", "script", "comic"))] or every
        _FONTS["any"] = every
    return _FONTS[kind]


def font(rng: random.Random, size: int, kind: str = "any") -> ImageFont.FreeTypeFont:
    choices = fonts(kind)
    if choices:
        try:
            return ImageFont.truetype(rng.choice(choices), size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def fit(d: ImageDraw.ImageDraw, rng: random.Random, text: str, size: int, max_w: int, kind: str = "any"):
    """A font of at most `size` px whose rendering of `text` fits in `max_w` — ground truth must stay visible."""
    path = rng.choice(fonts(kind)) if fonts(kind) else None
    while True:
        f = ImageFont.truetype(path, size) if path else ImageFont.load_default(size=size)
        if d.textlength(text, font=f) <= max_w or size <= 10:
            return f
        size -= 2


def palette(rng: random.Random) -> tuple[tuple, tuple, tuple]:
    """(background, ink, accent) with readable contrast."""
    light = [(255, 255, 255), (250, 247, 240), (240, 244, 248), (255, 252, 230), (236, 240, 233), (245, 245, 245)]
    dark = [(20, 20, 24), (30, 36, 52), (44, 30, 60), (12, 50, 45)]
    accents = [(220, 60, 60), (40, 110, 220), (230, 140, 30), (40, 160, 90), (150, 70, 200), (0, 0, 0)]
    if rng.random() < 0.75:
        return rng.choice(light), rng.choice([(15, 15, 15), (40, 40, 60), (30, 30, 30)]), rng.choice(accents)
    return rng.choice(dark), (245, 245, 245), rng.choice(accents[:-1])


def wrap(draw: ImageDraw.ImageDraw, text: str, f, width: int) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        nxt = f"{cur} {word}".strip()
        if draw.textlength(nxt, font=f) <= width:
            cur = nxt
        else:
            if cur:
                lines.append(cur)
            cur = word
    return lines + ([cur] if cur else [])


def photo_effects(img: Image.Image, rng: random.Random) -> Image.Image:
    """Make renders look like phone photos: tilt, blur, noise, JPEG-ish softness."""
    if rng.random() < 0.5:
        bg = tuple(rng.randint(60, 200) for _ in range(3))
        img = img.rotate(rng.uniform(-6, 6), resample=Image.BICUBIC, expand=False, fillcolor=bg)
    if rng.random() < 0.35:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.3, 1.0)))
    if rng.random() < 0.35:
        noise = Image.effect_noise(img.size, rng.uniform(8, 25)).convert("RGB")
        img = Image.blend(img, noise, rng.uniform(0.04, 0.1))
    if rng.random() < 0.3:  # uneven lighting
        shade = Image.linear_gradient("L").resize(img.size).rotate(rng.choice([0, 90, 180, 270]))
        img = Image.composite(img, Image.new("RGB", img.size, (0, 0, 0)), shade.point(lambda p: 255 - p // 4))
    return img


def canvas(rng: random.Random):
    w, h = rng.choice(SIZES)
    bg, ink, accent = palette(rng)
    img = Image.new("RGB", (w, h), bg)
    return img, ImageDraw.Draw(img), w, h, ink, accent


# --------------------------------------------------------------------------- #
# Date phrasing on images                                                      #
# --------------------------------------------------------------------------- #

def future(rng: random.Random, now: datetime, lo=1, hi=30) -> datetime:
    return now + timedelta(days=rng.randint(lo, hi))


def date_on_image(rng: random.Random, d: datetime) -> str:
    wd, mon = G.WEEKDAYS[d.weekday()], G.MONTHS[d.month - 1]
    return rng.choice([f"{wd}, {mon} {d.day}", f"{wd[:3].upper()} {mon[:3].upper()} {d.day}", f"{mon} {d.day}, {d.year}",
                       f"{d.month}/{d.day}/{d.year}", f"{d.day} {mon[:3]} {d.year}", f"{mon[:3]} {d.day}"])


def time_on_image(rng: random.Random, h: int, m: int) -> str:
    h12, ap = h % 12 or 12, "AM" if h < 12 else "PM"
    return rng.choice([f"{h12}:{m:02d} {ap}", f"{h12}:{m:02d}{ap.lower()}", f"{h:02d}:{m:02d}"] +
                      ([f"{h12} {ap}", f"{h12}{ap.lower()}"] if m == 0 else []))


def at(d: datetime, h: int, m: int) -> datetime:
    return d.replace(hour=h, minute=m, second=0, microsecond=0)


# --------------------------------------------------------------------------- #
# Image kinds. Each returns (image, facts) — facts drive the conversation.     #
# --------------------------------------------------------------------------- #

VENUES = ["SMX Convention Center", "UP Theater", "Room 302, Engineering Bldg", "The Ruins, Poblacion", "Zoom",
          "Café Lupe", "BGC Amphitheater", "Main Library, 3F", "Ramen Nagi, SM Aura", "Covered Court"]
POSTER_ORGS = ["", "", "CS Society", "Rotaract", "DevFest", "Barangay 12", "AIESEC", "Math Club", "UP Mountaineers",
               "Green Org", "Student Council", "Lions Club", "IEEE"]
POSTER_EVENTS = ["Career Fair", "Acoustic Night", "Hackathon", "Blood Donation Drive", "Film Screening", "Pitch Night",
                 "Fun Run", "General Assembly", "Python Workshop", "Art Exhibit", "Coastal Cleanup", "Quiz Bee",
                 "Open Mic", "Job Expo", "Design Talk", "Leadership Summit", "Tree Planting", "Book Fair", "Game Night",
                 "Photography Walk", "Concert for a Cause", "Seminar on AI", "Basketball Finals", "Bazaar"]
SUBJECTS = ["Calculus II", "Data Structures", "Physics 71", "Philippine History", "Technical Writing", "Statistics",
            "Operating Systems", "Discrete Math", "Chemistry Lab", "Economics"]
BILLERS = [("Meralco", "electricity"), ("PLDT Home", "internet"), ("Globe Postpaid", "phone"), ("Maynilad", "water"),
           ("Converge", "internet"), ("BPI Credit Card", "credit card")]


def img_poster(rng, now):
    img, d, w, h, ink, accent = canvas(rng)
    title = f"{rng.choice(POSTER_ORGS)} {rng.choice(POSTER_EVENTS)}".strip()
    day = future(rng, now, 2, 40)
    hh, mm = rng.choice([(9, 0), (10, 0), (13, 0), (14, 30), (17, 0), (18, 0), (19, 0), (19, 30)])
    venue = rng.choice(VENUES)
    d.rectangle([0, 0, w, rng.randint(8, 30)], fill=accent)
    y = int(h * rng.uniform(0.1, 0.2))
    tsize = rng.randint(34, 50)
    tf = font(rng, tsize, "bold")
    tcol = accent if rng.random() < 0.4 else ink
    for line in wrap(d, title.upper() if rng.random() < 0.5 else title, tf, w - 60):
        d.text((30, y), line, fill=tcol, font=tf)
        y += tsize + 12
    y += 20
    fs = rng.randint(22, 28)
    dstr, tstr = date_on_image(rng, day), time_on_image(rng, hh, mm)
    for line in [dstr, tstr, venue]:
        d.text((30, y), line, fill=ink, font=fit(d, rng, line, fs, w - 50))
        y += fs + 14
    if rng.random() < 0.6:
        d.text((30, h - 60), rng.choice(["Free entrance!", "Register at the door", "Open to all", "Bring a friend"]),
               fill=ink, font=font(rng, 18))
    for _ in range(rng.randint(0, 4)):  # decoration
        x0, y0 = rng.randint(w // 2, w), rng.randint(h // 2, h)
        d.ellipse([x0 - 40, y0 - 40, x0 + 40, y0 + 40], outline=accent, width=4)
    start = at(day, hh, mm)
    return img, {"kind": "poster", "title": title, "start": start, "venue": venue,
                 "text": f"{title}\n{dstr}\n{tstr}\n{venue}"}


def img_bill(rng, now):
    img, d, w, h, ink, accent = canvas(rng)
    biller, what = rng.choice(BILLERS)
    due = future(rng, now, 2, 25)
    amount = rng.choice([845.5, 1299, 1699, 2340.75, 3120, 4870.2, 999, 15500])
    acct = "".join(rng.choice("0123456789") for _ in range(10))
    cur = rng.choice(["PHP", "Php", "P"])  # many fonts lack the ₱ glyph
    d.rectangle([0, 0, w, 70], fill=accent)
    d.text((24, 18), biller, fill=(255, 255, 255), font=font(rng, 30, "bold"))
    rows = [("Account No.", acct), ("Billing period", f"{G.MONTHS[(due.month - 2) % 12][:3]} 1–{28}"),
            ("Amount due", f"{cur} {amount:,.2f}"), ("Due date", dstr := date_on_image(rng, due))]
    rng.shuffle(rows[:2])
    y = 110
    f = font(rng, 22 if w >= 500 else 18)
    vx = max(w // 2, int(max(d.textlength(k, font=f) for k, _ in rows)) + 44)
    for k, v in rows:
        d.text((24, y), k, fill=ink, font=f)
        d.text((vx, y), v, fill=ink, font=fit(d, rng, v, 22, w - vx - 12, "bold" if k in ("Amount due", "Due date") else "any"))
        y += 48
    d.line([24, y, w - 24, y], fill=ink, width=2)
    d.text((24, y + 16), "Pay on time to avoid disconnection.", fill=ink, font=font(rng, 16))
    return img, {"kind": "bill", "biller": biller, "what": what, "due": at(due, 23, 59), "amount": amount,
                 "text": f"{biller}\nAccount No. {acct}\nAmount due {cur} {amount:,.2f}\nDue date {dstr}"}


def img_assignment(rng, now):
    img, d, w, h, ink, accent = canvas(rng)
    subj = rng.choice(SUBJECTS)
    num = rng.randint(1, 9)
    kind = rng.choice(["Problem Set", "Homework", "Lab Report", "Worksheet", "Reading Quiz"])
    due = future(rng, now, 1, 14)
    hh, mm = rng.choice([(23, 59), (17, 0), (8, 0), (12, 0)])
    n_items = rng.randint(2, 5)
    items = [f"Question {i}" for i in range(1, n_items + 1)] if rng.random() < 0.6 else \
        rng.sample(["Read pages 40-55", "Answer review questions", "Draw the free-body diagram", "Show all solutions",
                    "Submit as PDF", "Cite 3 sources", "Write a 1-page summary"], n_items)
    d.text((24, 24), subj, fill=accent, font=fit(d, rng, subj, 26, w - 40, "bold"))
    d.text((24, 64), f"{kind} {num}", fill=ink, font=fit(d, rng, f"{kind} {num}", 30, w - 40, "bold"))
    due_line = f"Due: {date_on_image(rng, due)}, {time_on_image(rng, hh, mm)}"
    d.text((24, 112), due_line, fill=ink, font=fit(d, rng, due_line, 22, w - 40))
    y = 160
    for i, it in enumerate(items, 1):
        line = f"{i}. {it}" if not it.startswith("Question") else it
        d.text((36, y), line, fill=ink, font=fit(d, rng, line, 20, w - 50))
        y += 34
        if y > h - 40:
            items = items[:i]
            break
    title = f"{subj} {kind.lower()} {num}" if rng.random() < 0.5 else f"{subj} — {kind} {num}"
    return img, {"kind": "assignment", "title": title, "due": at(due, hh, mm), "items": items,
                 "text": f"{subj}\n{kind} {num}\n{due_line}\n" + "\n".join(items)}


def img_schedule(rng, now):
    img, d, w, h, ink, accent = canvas(rng)
    n = rng.randint(2, 4)
    days = rng.sample(range(5), n)
    rows = []
    for wd, subj in zip(sorted(days), rng.sample(SUBJECTS, n)):
        hh = rng.choice([7, 8, 9, 10, 13, 14, 15, 16])
        mm = rng.choice([0, 30])
        rows.append((wd, hh, mm, subj, f"Rm {rng.randint(100, 450)}", time_on_image(rng, hh, mm)))
    d.text((20, 20), rng.choice(["CLASS SCHEDULE", "My Schedule", "Weekly Timetable"]), fill=accent, font=font(rng, 28, "bold"))
    cols = [20, int(w * 0.24), int(w * 0.46), int(w * 0.82)]
    y = 80
    for txt, x in zip(["Day", "Time", "Subject", "Room"], cols):
        d.text((x, y), txt, fill=ink, font=font(rng, 18, "bold"))
    y += 34
    d.line([16, y - 6, w - 16, y - 6], fill=ink, width=2)
    fs = 17 if w < 500 else 19
    for wd, hh, mm, subj, room, tstr in rows:
        for txt, x, nx in zip([G.WEEKDAYS[wd][:3], tstr, subj, room], cols, cols[1:] + [w - 8]):
            d.text((x, y), txt, fill=ink, font=fit(d, rng, txt, fs, nx - x - 8))
        y += 40
        d.line([16, y - 8, w - 16, y - 8], fill=(160, 160, 160), width=1)
    events = [(subj, at(G.next_weekday(now, wd), hh, mm), room) for wd, hh, mm, subj, room, _ in rows]
    return img, {"kind": "schedule", "rows": events,
                 "text": "\n".join(f"{G.WEEKDAYS[wd][:3]} {t} {s} {r}" for wd, hh, mm, s, r, t in rows)}


def img_chat(rng, now):
    img, d, w, h, ink, accent = canvas(rng)
    who = rng.choice(G.PEOPLE[:15])
    plan = rng.choice(["dinner", "lunch", "coffee", "study session", "movie", "badminton", "videoke"])
    place = rng.choice(["Ramen Nagi", "Starbucks Katipunan", "SM North", "the library", "Gerry's Grill", "UP Town Center"])
    day_txt, day = rng.choice([("tomorrow", now + timedelta(days=1)), ("bukas", now + timedelta(days=1))] +
                              [(G.WEEKDAYS[i].lower(), G.next_weekday(now, i)) for i in range(7) if i != now.weekday()])
    hh = rng.choice([10, 12, 15, 17, 18, 19, 20])
    t_txt = f"{hh % 12 or 12}{'am' if hh < 12 else 'pm'}"
    msgs = [(who, rng.choice([f"{plan} {day_txt} {t_txt} at {place}?", f"tara {plan} {day_txt}, {t_txt} sa {place}",
                              f"hey! {plan} {day_txt} at {t_txt}? {place}"])),
            ("me", rng.choice(["sure!", "g!", "yes see you", "game"])),
            (who, rng.choice(["ok see you!", "nice, I'll reserve", "dont be late haha"]))]
    d.rectangle([0, 0, w, 56], fill=accent)
    d.text((18, 14), who, fill=(255, 255, 255), font=font(rng, 24, "bold"))
    y = 80
    f = font(rng, 19)
    for sender, txt in msgs:
        lines = wrap(d, txt, f, int(w * 0.6))
        bh = 16 + 26 * len(lines)
        bw = max(d.textlength(l, font=f) for l in lines) + 28
        x0 = 16 if sender != "me" else w - bw - 16
        fill = (228, 230, 235) if sender != "me" else accent
        d.rounded_rectangle([x0, y, x0 + bw, y + bh], radius=16, fill=fill)
        for i, l in enumerate(lines):
            d.text((x0 + 14, y + 8 + 26 * i), l, fill=(20, 20, 20) if sender != "me" else (255, 255, 255), font=f)
        y += bh + 14
    title = f"{plan.capitalize()} with {who}"
    return img, {"kind": "chat", "title": title, "start": at(day, hh, 0), "venue": place, "who": who,
                 "text": "\n".join(f"{s}: {t}" for s, t in msgs)}


def img_note(rng, now):
    bg = rng.choice([(255, 244, 150), (255, 200, 210), (190, 230, 255), (210, 245, 200), (255, 255, 255)])
    w, h = rng.choice(SIZES)
    img = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(img)
    if rng.random() < 0.3:
        title, body, _ = rng.choice(G.NOTE_TOPICS)
        items = [s.strip() for s in body.replace(";", ",").replace(". ", ", ").split(",") if s.strip()][:6]
    else:
        title, pool = rng.choice(NOTE_LISTS)
        items = rng.sample(pool, rng.randint(2, min(6, len(pool))))
    if rng.random() < 0.5:
        for yy in range(70, h, 36):
            d.line([0, yy, w, yy], fill=(170, 190, 220), width=1)
    f = font(rng, rng.randint(22, 28), "hand")
    d.text((26, 22), title, fill=(30, 30, 90), font=font(rng, 30, "hand"))
    y = 76
    for it in items:
        for line in wrap(d, ("• " if rng.random() < 0.6 else "- ") + it, f, w - 50):
            d.text((30, y), line, fill=(30, 30, 90), font=f)
            y += 36
    return img, {"kind": "note", "title": title, "items": items, "text": title + "\n" + "\n".join(items)}


NOTE_LISTS = [
    ("Groceries", ["eggs", "milk", "rice 5kg", "bread", "coffee", "bananas", "chicken", "soap", "toothpaste", "onions", "garlic", "tuyo"]),
    ("Packing list", ["passport", "charger", "toothbrush", "3 shirts", "jacket", "umbrella", "meds", "slippers", "power bank"]),
    ("Ideas", ["offline habit tracker", "P2P grocery list", "study timer widget", "voice notes to tasks", "budget bot"]),
    ("To buy", ["HDMI cable", "notebook", "ballpen", "printer ink", "extension cord", "phone case"]),
    ("Meeting notes", ["ship v2 Friday", "Josh owns QA", "Mia: release notes", "budget approved", "next sync Monday"]),
    ("Reviewer topics", ["recursion", "linked lists", "Big-O", "hash tables", "BFS vs DFS", "heaps"]),
    ("Weekend", ["laundry", "call Mom", "clean room", "jog 5k", "meal prep", "fix bike"]),
    ("Movies to watch", ["Past Lives", "Spirited Away", "Dune Part Two", "Heneral Luna", "Coco", "Interstellar"]),
    ("Gift ideas", ["orchid plant", "scarf", "cooking class", "wireless earbuds", "photo album", "mug"]),
    ("Budget", ["rent 12000", "food 6000", "transport 2000", "savings 5000", "load 300", "netflix 549"]),
]
SHAPES = ["circle", "square", "triangle"]
COLORS = {"red": (220, 40, 40), "blue": (40, 90, 220), "green": (40, 170, 70), "yellow": (240, 210, 30),
          "orange": (245, 140, 20), "purple": (140, 60, 190), "black": (15, 15, 15)}


def img_shapes(rng, now):
    w, h = rng.choice(SIZES)
    img = Image.new("RGB", (w, h), (255, 255, 255) if rng.random() < 0.7 else (235, 235, 235))
    d = ImageDraw.Draw(img)
    n = rng.randint(1, 4)
    objs = []
    for i in range(n):
        shape, (cname, col) = rng.choice(SHAPES), rng.choice(list(COLORS.items()))
        cx, cy = int(w * (i + 0.5) / n), rng.randint(h // 3, 2 * h // 3)
        r = min(w // (2 * n), 90) - 6
        if shape == "circle":
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
        elif shape == "square":
            d.rectangle([cx - r, cy - r, cx + r, cy + r], fill=col)
        else:
            d.polygon([(cx, cy - r), (cx - r, cy + r), (cx + r, cy + r)], fill=col)
        objs.append((cname, shape))
    return img, {"kind": "shapes", "objs": objs, "text": ""}


KINDS = [(16, img_poster), (14, img_bill), (16, img_assignment), (12, img_schedule), (14, img_chat), (14, img_note),
         (6, img_shapes)]


# --------------------------------------------------------------------------- #
# Conversations about an image                                                 #
# --------------------------------------------------------------------------- #

def ocr_noise(rng: random.Random, text: str) -> str:
    """The app runs ML Kit OCR on attachments and sends the text too; imitate its slips."""
    swaps = {"0": "O", "1": "l", "5": "S", "rn": "m", "₱": "P"}
    for a, b in swaps.items():
        if rng.random() < 0.15:
            text = text.replace(a, b, 1)
    return text


def user_turn(rng, text: str, facts: dict, image_name: str) -> dict:
    text = G.user(text, rng)["content"]  # the app never sends an attachment without typed text
    if facts["text"] and rng.random() < 0.4:  # app also attaches OCR text (see agent.tsx → extractedContext)
        text = f"{text}\n\n[Attached content]\n[Image: {image_name}]\n{ocr_noise(rng, facts['text'])}".strip()
    parts = [{"type": "image"}]
    if text:
        parts.append({"type": "text", "text": text})
    return {"role": "user", "content": parts}


def convo(rng: random.Random, c: G.Ctx, facts: dict, name: str) -> list[dict]:
    k, now = facts["kind"], c.now
    ask_only = rng.random() < 0.2 and k != "shapes"

    if k == "shapes":
        objs = facts["objs"]
        q, a = rng.choice([
            ("what's in this picture?", ", ".join(f"a {col} {sh}" for col, sh in objs).capitalize() + "."),
            ("how many shapes are there?", f"There {'is' if len(objs) == 1 else 'are'} {len(objs)}."),
            ("what color is the first shape?", f"It's {objs[0][0]}."),
        ])
        return [user_turn(rng, q, facts, name), G.say(a)]

    if ask_only:  # read or answer about the image, no tool
        if k == "bill":
            q, a = rng.choice([("when is this due?", f"It's due {G.human_day(facts['due'], now)}."),
                               ("how much do I owe?", f"₱{facts['amount']:,.2f} to {facts['biller']}, due {G.human_day(facts['due'], now)}.")])
        elif k in ("poster", "chat"):
            s = facts["start"]
            q, a = ("when is this?", f"{G.cap(G.human_day(s, now))} at {G.human_time(s)}, at {facts['venue']}.")
        elif k == "assignment":
            q, a = ("what's this about?", f"It's {facts['title']}, due {G.human_day(facts['due'], now)} at {G.human_time(facts['due'])}, with {len(facts['items'])} items.")
        else:
            q, a = rng.choice(["what does this say?", "can you read this for me?", "transcribe this"]), facts["text"].replace("\n", "; ") if k != "note" else facts["title"] + ": " + ", ".join(facts["items"]) + "."
        return [user_turn(rng, q, facts, name), G.say(a)]

    if k in ("poster", "chat"):
        s = facts["start"]
        q = rng.choice(["add this to my calendar", "save this event", "schedule this", "put this in my calendar",
                        "pa-add nito sa calendar", "remind me about this", "add it"])
        args = {"title": facts["title"], "startDate": G.iso(s)}
        if rng.random() < 0.6:
            args["description"] = facts["venue"]
        call = c.call("add_event", args)
        return [user_turn(rng, q, facts, name), G.assistant_calls(call),
                G.tool_msg(call, f"Added event: \"{facts['title']}\" on {G.locale_string(s)}"),
                G.say(f"Added \"{facts['title']}\" {G.human_day(s, now)} at {G.human_time(s)}" + (f" at {facts['venue']}." if "description" in args else "."))]

    if k == "bill":
        title = f"Pay {facts['biller']} bill"
        persistent = rng.random() < 0.5
        q = rng.choice(["remind me to pay this", "add this bill to my tasks", "don't let me forget this bill",
                        "remind me until I pay this"] if persistent else ["remind me to pay this", "add this bill to my tasks", "add this"])
        persistent = persistent and ("until" in q or "forget" in q)
        args = {"title": title, "dueDate": G.iso(facts["due"])}
        if persistent:
            args["reminder"] = "persistent"
        call = c.call("add_todo", args)
        res = f"Added task \"{title}\" due {G.short_due(facts['due'])}." if not persistent else \
            f"Added task \"{title}\" due {G.short_due(facts['due'])}. I'll keep reminding until it's done."
        return [user_turn(rng, q, facts, name), G.assistant_calls(call), G.tool_msg(call, res),
                G.say(f"Added \"{title}\" (₱{facts['amount']:,.2f}), due {G.human_day(facts['due'], now)}." +
                      (" I'll keep reminding you until it's paid." if persistent else ""))]

    if k == "assignment":
        q = rng.choice(["add this homework", "add this to my tasks", "remind me about this assignment",
                        "make a task with each question", "add this, keep reminding me until done"])
        args = {"title": facts["title"], "dueDate": G.iso(facts["due"])}
        if "question" in q or rng.random() < 0.5:
            args["items"] = facts["items"]
        if "keep reminding" in q:
            args["reminder"] = "persistent"
        call = c.call("add_todo", args)
        res = f"Added task \"{facts['title']}\" due {G.short_due(facts['due'])}"
        if "items" in args:
            res += f" with {len(facts['items'])} checklist item{'s' if len(facts['items']) > 1 else ''}"
        res += ". I'll keep reminding until it's done." if "reminder" in args else "."
        return [user_turn(rng, q, facts, name), G.assistant_calls(call), G.tool_msg(call, res),
                G.say(f"Added \"{facts['title']}\", due {G.human_day(facts['due'], now)} at {G.human_time(facts['due'])}" +
                      (f" with {len(facts['items'])} checklist items." if "items" in args else "."))]

    if k == "schedule":
        q = rng.choice(["add my classes to the calendar", "put this schedule in my calendar", "add these classes this week"])
        calls = [c.call("add_event", {"title": s, "startDate": G.iso(d), "description": r}) for s, d, r in facts["rows"]]
        return [user_turn(rng, q, facts, name), G.assistant_calls(*calls),
                *[G.tool_msg(cl, f"Added event: \"{s}\" on {G.locale_string(d)}") for cl, (s, d, _) in zip(calls, facts["rows"])],
                G.say(f"Added {len(calls)} classes: " + ", ".join(f"{s} {G.WEEKDAYS[d.weekday()][:3]} {G.human_time(d)}" for s, d, _ in facts["rows"]) + ".")]

    # note
    q = rng.choice(["save this as a note", "write this down", "note this", "save this"])
    args = {"title": facts["title"], "body": "\n".join(facts["items"])}
    call = c.call("add_note", args)
    return [user_turn(rng, q, facts, name), G.assistant_calls(call), G.tool_msg(call, f"Added note: \"{facts['title']}\""),
            G.say(f"Saved \"{facts['title']}\" to your notes.")]


def make_vision_example(rng: random.Random, tools: list[dict], img_dir: Path, idx: str) -> dict:
    now = datetime(2026, 1, 1) + timedelta(days=rng.randint(0, 729), hours=rng.randint(6, 22), minutes=rng.randint(0, 59))
    c = G.Ctx(rng, now)
    fn = rng.choices([f for _, f in KINDS], weights=[w for w, _ in KINDS])[0]
    img, facts = fn(rng, now)
    if facts["kind"] != "shapes":
        img = photo_effects(img, rng)
    path = img_dir / f"{idx}.jpg"
    img.save(path, quality=rng.randint(70, 92))
    msgs = convo(rng, c, facts, rng.choice(["photo", "IMG_2041.jpg", "screenshot", "image"]))
    return {"scenario": "vision_" + facts["kind"], "images": [str(path.name)],
            "messages": [{"role": "system", "content": G.system_prompt(now, G.known_context(rng))}] + msgs,
            "tools": tools}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", type=int, default=1600, help="image conversations")
    ap.add_argument("--eval", type=int, default=160)
    ap.add_argument("--text-ratio", type=float, default=0.4, help="extra text-only conversations, as a share of the image ones")
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--tools", default=str(HERE / "tools.json"))
    ap.add_argument("--out", default=str(HERE / "data_vision"))
    a = ap.parse_args()
    tools = json.loads(Path(a.tools).read_text())
    out = Path(a.out)
    (out / "images").mkdir(parents=True, exist_ok=True)
    for split, n, seed in (("train", a.train, a.seed), ("eval", a.eval, a.seed + 1000)):
        rng = random.Random(seed)
        rows = [make_vision_example(rng, tools, out / "images", f"{split}-{i:05d}") for i in range(n)]
        rows += [G.make_example(rng, tools) for _ in range(math.ceil(n * a.text_ratio))]
        rng.shuffle(rows)
        with open(out / f"{split}.jsonl", "w") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"{split}: {len(rows)} conversations ({n} with images) → {out / f'{split}.jsonl'}")


if __name__ == "__main__":
    main()
