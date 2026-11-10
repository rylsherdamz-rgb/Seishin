#!/usr/bin/env python3
"""
Synthetic tool-calling dataset for Seishin's on-device agent.

Every example is a full OpenAI-style chat — the exact system prompt that
`src/services/local-agent.ts` builds, the user turn, the assistant's tool calls,
the tool results in the exact strings the app's tools return, and the short
final reply. Tool schemas come from `tools.json`, dumped from the app's own
`createDefaultTools()` + `LOCAL_TOOL_NAMES`, so the model learns the real API.

    python3 generate_dataset.py --train 3000 --eval 300 --out data/

Deterministic for a given --seed. No dependencies beyond the stdlib.
"""
from __future__ import annotations

import argparse
import json
import random
import string
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]

# --------------------------------------------------------------------------- #
# Formatting that mirrors what the app (Hermes, en-US) prints                  #
# --------------------------------------------------------------------------- #

def hm12(d: datetime) -> str:
    """toLocaleTimeString en-US 2-digit: '09:05 AM'."""
    return d.strftime("%I:%M %p")


def system_prompt(now: datetime, known: str = "") -> str:
    """Byte-for-byte the prompt from createLocalSystemPrompt() in local-agent.ts."""
    date = f"{WEEKDAYS[now.weekday()]}, {MONTHS[now.month - 1]} {now.day}, {now.year}"
    context = f"\n\nWhat you know:\n{known[:1500]}" if known.strip() else ""
    return f"""You are Seishin, an assistant running fully on the user's phone, offline.
Today is {date}, {hm12(now)}.
Use the tools to add, read, change or delete the user's events, tasks and notes, and to remember facts about them.
- When the user asks for an action, call the tool right away. Never ask permission.
- "task", "todo", "homework", "deadline" → add_todo. "meeting", "event", "at <time>" → add_event. "note", "write down" → add_note.
- Resolve "tomorrow", "next Friday" etc. from today's date.
- After tools run, reply in one or two short sentences. If no tool fits, just answer.{context}"""


def iso(d: datetime) -> str:
    """Local ISO datetime, no zone — `new Date()` reads it as phone-local time."""
    return d.strftime("%Y-%m-%dT%H:%M:%S")


def locale_string(d: datetime) -> str:
    """new Date().toLocaleString(): '11/12/2026, 3:00:00 PM'."""
    return f"{d.month}/{d.day}/{d.year}, {d.hour % 12 or 12}:{d.minute:02d}:00 {'AM' if d.hour < 12 else 'PM'}"


def short_due(d: datetime) -> str:
    """toLocaleString([], {weekday:'short', month:'short', day, hour, minute}): 'Thu, Nov 12, 3:00 PM'."""
    return f"{WEEKDAYS[d.weekday()][:3]}, {MONTHS[d.month - 1][:3]} {d.day}, {d.hour % 12 or 12}:{d.minute:02d} {'AM' if d.hour < 12 else 'PM'}"


def human_time(d: datetime) -> str:
    return f"{d.hour % 12 or 12}:{d.minute:02d} {'AM' if d.hour < 12 else 'PM'}"


def human_day(d: datetime, now: datetime) -> str:
    delta = (d.date() - now.date()).days
    if delta == 0:
        return "today"
    if delta == 1:
        return "tomorrow"
    return f"{WEEKDAYS[d.weekday()]}, {MONTHS[d.month - 1][:3]} {d.day}"


def app_id(rng: random.Random, prefix: str) -> str:
    """Looks like uid(prefix) from utils/id.ts."""
    t = "".join(rng.choice(string.digits + "abcdefghijklmnopqrstuvwxyz") for _ in range(8))
    r = "".join(rng.choice(string.digits + "abcdefghijklmnopqrstuvwxyz") for _ in range(4))
    return f"{prefix}-{t}-{rng.randint(1, 999):x}-{r}"


# --------------------------------------------------------------------------- #
# Vocabulary                                                                   #
# --------------------------------------------------------------------------- #

PEOPLE = ["Mia", "Josh", "Ana", "Carlo", "Liza", "Ben", "Aiko", "Sam", "Nico", "Jade", "Paolo",
          "Rhea", "Marco", "Kai", "Elena", "Tomas", "Bea", "Leo", "Grace", "Dr. Santos", "Prof. Reyes"]
EVENTS = ["Dentist appointment", "Team standup", "Project sync", "Gym session", "Doctor's checkup",
          "Job interview", "Client call", "Yoga class", "Haircut", "Piano lesson", "Group study",
          "Thesis defense", "Sprint planning", "Car service", "Board meeting", "Parent-teacher meeting",
          "Movie night", "Basketball practice", "Church service", "Flight to Cebu", "Code review",
          "Coffee chat", "Design review", "1:1 with manager", "Vet appointment", "Birthday party",
          "Swimming lesson", "Lab session", "Seminar", "Concert"]
WITH_PERSON = ["Lunch with {p}", "Dinner with {p}", "Call with {p}", "Meeting with {p}",
               "Coffee with {p}", "Study session with {p}", "Date with {p}", "Catch-up with {p}"]
TASKS = ["Math homework", "Pay electricity bill", "Submit lab report", "Renew passport",
         "Buy groceries", "Finish slides", "Email the landlord", "Read chapter 5", "Fix the bike",
         "Pay rent", "Physics problem set", "Update resume", "Book flights", "Clean the room",
         "Water the plants", "Call the bank", "Return library books", "Write essay draft",
         "Review pull request", "Pay internet bill", "Prepare presentation", "History reading",
         "Submit tax forms", "Order birthday gift", "Laundry", "Study for chemistry quiz",
         "Reply to Prof. Reyes", "Backup photos", "Cancel gym membership", "Finish capstone chapter 2"]
CHECKLISTS = {
    "Buy groceries": ["Eggs", "Milk", "Rice", "Bread", "Coffee", "Bananas", "Chicken", "Soap"],
    "Physics problem set": ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"],
    "Prepare presentation": ["Outline", "Slides", "Speaker notes", "Rehearse"],
    "Write essay draft": ["Outline", "Introduction", "Body", "Conclusion", "References"],
    "Math homework": ["Exercise 1", "Exercise 2", "Exercise 3", "Exercise 4"],
    "Book flights": ["Compare prices", "Pick seats", "Pay"],
}
NOTE_TOPICS = [
    ("App ideas", "A habit tracker that works offline; a shared grocery list over P2P", "ideas"),
    ("Wifi password", "Home: sunflower-2026, Office: ask IT", "home"),
    ("Book recommendations", "Project Hail Mary, Piranesi, The Midnight Library", "books"),
    ("Meeting notes", "Ship v2 by Friday. Josh owns QA, Mia owns release notes.", "work"),
    ("Gift ideas for Mom", "Orchid plant, scarf, cooking class voucher", "family,gifts"),
    ("Workout plan", "Mon: legs, Wed: push, Fri: pull, Sat: run 5k", "fitness"),
    ("Recipe: adobo", "Chicken, soy sauce, vinegar, garlic, bay leaves, pepper. Simmer 40 min.", "recipes"),
    ("Thesis outline", "1. Intro 2. Related work 3. Method 4. Results 5. Discussion", "school"),
    ("Packing list", "Passport, charger, toothbrush, 3 shirts, jacket", "travel"),
    ("Quotes", "Simplicity is prerequisite for reliability.", "quotes"),
    ("Car parking", "Level B2, slot 47 near the elevator", ""),
    ("Movie list", "Dune Part Two, Past Lives, Spirited Away", "movies"),
    ("Budget", "Rent 12000, food 6000, transport 2000, savings 5000", "money"),
    ("Startup notes", "Talk to 10 users before building anything", "ideas,work"),
]
FACTS = [  # (user says, name, type, description)
    ("My sister's name is Ana and she lives in Davao", "Ana", "person", "User's sister; lives in Davao"),
    ("I'm allergic to peanuts", "Peanut allergy", "preference", "User is allergic to peanuts"),
    ("My manager is Josh", "Josh", "person", "User's manager"),
    ("I work at Globe as a data analyst", "Globe", "organization", "User works there as a data analyst"),
    ("I study computer science at UP Diliman", "UP Diliman", "place", "User studies computer science there"),
    ("my birthday is March 14", "User birthday", "event", "User's birthday is March 14"),
    ("I prefer meetings in the morning", "Morning meetings", "preference", "User prefers meetings in the morning"),
    ("My dog's name is Mochi", "Mochi", "pet", "User's dog"),
    ("I'm vegetarian", "Vegetarian", "preference", "User is vegetarian"),
    ("Carlo is my best friend from high school", "Carlo", "person", "User's best friend from high school"),
    ("My capstone project is called Seishin", "Seishin", "project", "User's capstone project"),
    ("I go to the gym at Anytime Fitness in BGC", "Anytime Fitness BGC", "place", "User's gym"),
    ("my girlfriend is Liza", "Liza", "person", "User's girlfriend"),
    ("I usually sleep at 11pm", "Sleep schedule", "preference", "User usually sleeps at 11pm"),
]
SMALL_TALK = [
    ("hi", "Hi! What can I help you with today?"),
    ("hello", "Hello! Need to add something to your calendar or tasks?"),
    ("thanks!", "You're welcome!"),
    ("thank you", "Anytime."),
    ("who are you?", "I'm Seishin, your assistant. I run fully on your phone and can manage your events, tasks and notes."),
    ("what can you do?", "I can add, find, change or delete your events, tasks and notes, check your inbox, and remember things you tell me."),
    ("are you online?", "No — I run entirely on your phone, offline. Your data stays on the device."),
    ("good morning", "Good morning! Want a look at what's on today?"),
    ("tell me a joke", "Why did the calendar break up with the clock? It needed more dates."),
    ("how do I stay focused while studying?", "Try 25-minute focus blocks with 5-minute breaks, and keep your phone out of reach. I can add study blocks to your calendar if you like."),
    ("what's 15% of 2400?", "15% of 2400 is 360."),
    ("convert 5 km to miles", "5 km is about 3.11 miles."),
    ("ok", "Okay! Let me know if you need anything."),
    ("give me a tip for better sleep", "Keep a fixed bedtime and skip screens for the last 30 minutes before sleeping."),
    ("what's the capital of Japan?", "Tokyo."),
    ("is it better to study at night or morning?", "Mornings work best for most people since you're rested, but consistency matters more than the hour."),
    ("salamat", "Walang anuman!"),
    ("kumusta?", "Ayos lang! Ano'ng maitutulong ko?"),
    ("how many days are in a leap year?", "366."),
    ("what's a good way to plan my week?", "List your fixed commitments first, then block time for your top three priorities. I can put those blocks on your calendar."),
    ("can you explain what a habit stack is?", "It's linking a new habit to one you already do, like stretching right after brushing your teeth."),
    ("what should I eat before a workout?", "Something light with carbs and a little protein about an hour before, like a banana with yogurt."),
    ("how long should a power nap be?", "About 10 to 20 minutes, so you wake up before deep sleep."),
    ("what does ASAP mean?", "As soon as possible."),
    ("translate 'good night' to Japanese", "Oyasumi nasai (おやすみなさい)."),
    ("what's 12 times 17?", "204."),
    ("how do I say no to extra work politely?", "Thank them, say your plate is full right now, and offer a later time or an alternative."),
    ("you're helpful", "Thanks! Happy to help."),
    ("never mind", "No problem."),
    ("what's the pomodoro technique?", "Work for 25 minutes, take a 5-minute break, and after four rounds take a longer 15–30 minute break."),
    ("do you store my data in the cloud?", "No. Everything stays on your phone."),
    ("bye", "Bye! Talk soon."),
    ("how far is the moon?", "About 384,000 km from Earth on average."),
    ("give me a motivational quote", "\"It always seems impossible until it's done.\" — Nelson Mandela"),
]
INBOX = [
    ("gmail", "Prof. Reyes", "Quiz moved to Thursday 10 AM"),
    ("messenger", "Mia", "Are we still on for lunch tomorrow?"),
    ("gmail", "Meralco", "Your bill of ₱2,340 is due Nov 20"),
    ("sms", "GCash", "You received ₱500 from Carlo"),
    ("slack", "Josh", "Can you review my PR before 5?"),
    ("gmail", "Shopee", "Your order has shipped"),
    ("viber", "Mom", "Call me when you're free"),
    ("gmail", "HR", "Interview scheduled Monday 2 PM"),
]

# --------------------------------------------------------------------------- #
# Time expressions: (phrase, resolved datetime)                                #
# --------------------------------------------------------------------------- #

def next_weekday(now: datetime, wd: int) -> datetime:
    days = (wd - now.weekday()) % 7 or 7
    return now + timedelta(days=days)


def pick_day(rng: random.Random, now: datetime) -> tuple[str, datetime]:
    r = rng.random()
    if r < 0.18:
        return "today", now
    if r < 0.45:
        return rng.choice(["tomorrow", "tmrw", "tomorrow", "bukas"]), now + timedelta(days=1)
    if r < 0.52:
        return "the day after tomorrow", now + timedelta(days=2)
    if r < 0.75:
        wd = rng.randrange(7)
        while wd == now.weekday():
            wd = rng.randrange(7)
        d = next_weekday(now, wd)
        return rng.choice([f"on {WEEKDAYS[wd]}", WEEKDAYS[wd].lower(), f"this {WEEKDAYS[wd]}", f"next {WEEKDAYS[wd]}"]), d
    if r < 0.85:
        n = rng.randint(2, 10)
        return f"in {n} days", now + timedelta(days=n)
    d = now + timedelta(days=rng.randint(3, 60))
    return rng.choice([f"on {MONTHS[d.month - 1]} {d.day}", f"on {MONTHS[d.month - 1][:3]} {d.day}", f"{d.month}/{d.day}"]), d


def pick_time(rng: random.Random) -> tuple[str, int, int]:
    r = rng.random()
    if r < 0.12:
        return "at noon", 12, 0
    if r < 0.2:
        return rng.choice([("in the morning", 9, 0), ("tonight", 20, 0), ("in the evening", 19, 0), ("in the afternoon", 15, 0)])
    h = rng.choice([7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20])
    m = rng.choice([0, 0, 0, 0, 15, 30, 30, 45])
    h12, ap = h % 12 or 12, "am" if h < 12 else "pm"
    if m == 0:
        txt = rng.choice([f"at {h12}{ap}", f"at {h12} {ap}", f"at {h12}{ap.upper()}", f"{h12}{ap}", f"at {h:02d}:00"])
    else:
        txt = rng.choice([f"at {h12}:{m:02d}{ap}", f"at {h12}:{m:02d} {ap}", f"{h12}:{m:02d}{ap}"])
    return txt, h, m


def when(rng: random.Random, now: datetime) -> tuple[str, datetime]:
    dtxt, day = pick_day(rng, now)
    for _ in range(10):
        ttxt, h, m = pick_time(rng)
        dt = day.replace(hour=h, minute=m, second=0, microsecond=0)
        if dt > now:
            break
    else:
        dtxt, day = "tomorrow", now + timedelta(days=1)
        ttxt, h, m = "at 10am", 10, 0
        dt = day.replace(hour=h, minute=m, second=0, microsecond=0)
    phrase = f"{dtxt} {ttxt}" if rng.random() < 0.7 else f"{ttxt} {dtxt}"
    return phrase, dt


# --------------------------------------------------------------------------- #
# Conversation builder                                                         #
# --------------------------------------------------------------------------- #

@dataclass
class Ctx:
    rng: random.Random
    now: datetime
    n_calls: int = 0

    def call(self, name: str, args: dict) -> dict:
        self.n_calls += 1
        return {"id": f"call_{self.n_calls}", "type": "function", "function": {"name": name, "arguments": args}}


def assistant_calls(*calls: dict) -> dict:
    return {"role": "assistant", "content": "", "tool_calls": list(calls)}


def tool_msg(call: dict, content: str) -> dict:
    return {"role": "tool", "tool_call_id": call["id"], "name": call["function"]["name"], "content": content}


def say(text: str) -> dict:
    return {"role": "assistant", "content": text}


def user(text: str, rng: random.Random) -> dict:
    for a, b in (("to at ", "to "), ("to on ", "to "), ("by on ", "by "), ("due on ", "due "), ("it to in ", "it to ")):
        text = text.replace(a, b)
    if rng.random() < 0.25:
        text = text.lower()
    if rng.random() < 0.3:
        text = text.rstrip(".!?")
    elif rng.random() < 0.2 and not text.endswith(("?", "!", ".")):
        text += rng.choice([".", "!", " pls", " please"])
    return {"role": "user", "content": text}


def cap(s: str) -> str:
    return s[:1].upper() + s[1:]


# --- scenarios: each returns a list of messages after the system prompt ----- #

def s_add_event(c: Ctx) -> list[dict]:
    rng = c.rng
    title = rng.choice(EVENTS) if rng.random() < 0.6 else rng.choice(WITH_PERSON).format(p=rng.choice(PEOPLE))
    phrase, dt = when(rng, c.now)
    args = {"title": title, "startDate": iso(dt)}
    dur_txt = ""
    if rng.random() < 0.3:
        hours = rng.choice([0.5, 1.5, 2, 3])
        args["endDate"] = iso(dt + timedelta(hours=hours))
        dur_txt = rng.choice([f" for {hours:g} hours" if hours != 0.5 else " for 30 minutes", f" for {int(hours * 60)} mins"])
    extra = ""
    if rng.random() < 0.15:
        loc = rng.choice(["at the clinic on 5th Ave", "in room 302", "on Zoom", "at SM North", "at the office"])
        args["description"] = cap(loc.removeprefix("at ").removeprefix("in ").removeprefix("on ").removeprefix("the "))
        extra = f" {loc}"
    t = title.lower() if rng.random() < 0.5 else title
    templates = [
        f"Add {t} {phrase}{dur_txt}{extra}",
        f"Schedule {t} {phrase}{dur_txt}{extra}",
        f"I have {t} {phrase}{extra}",
        f"put {t} on my calendar {phrase}{dur_txt}",
        f"Remind me about {t} {phrase}{extra}",
        f"Can you add an event: {t}, {phrase}{dur_txt}",
        f"{cap(t)} {phrase}{extra}",
        f"set a meeting — {t} {phrase}{dur_txt}",
        f"Pa-add naman ng {t} {phrase}",
        f"new event {t} {phrase}{extra}",
    ]
    msg = rng.choice(templates)
    if "endDate" in args and dur_txt not in msg:
        args.pop("endDate")
    if "description" in args and extra not in msg:
        args.pop("description")
    call = c.call("add_event", args)
    reply = rng.choice([
        f"Added \"{title}\" {human_day(dt, c.now)} at {human_time(dt)}.",
        f"Done — {title} is on your calendar for {human_day(dt, c.now)} at {human_time(dt)}.",
        f"Scheduled {title} for {human_day(dt, c.now)}, {human_time(dt)}.",
    ])
    return [user(msg, rng), assistant_calls(call),
            tool_msg(call, f"Added event: \"{title}\" on {locale_string(dt)}"), say(reply)]


def s_add_todo(c: Ctx) -> list[dict]:
    rng = c.rng
    title = rng.choice(TASKS)
    args: dict = {"title": title}
    parts = []
    due = None
    if rng.random() < 0.75:
        dtxt, day = pick_day(rng, c.now)
        if rng.random() < 0.5:
            due = day.replace(hour=23, minute=59, second=0, microsecond=0)
            parts.append(rng.choice([f"by {dtxt}".replace("by on ", "by "), f"due {dtxt}".replace("due on ", "due "), f"{dtxt}"]))
        else:
            ttxt, h, m = pick_time(rng)
            due = day.replace(hour=h, minute=m, second=0, microsecond=0)
            if due <= c.now:
                due = due + timedelta(days=1)
                dtxt = "tomorrow"
            parts.append(f"due {dtxt} {ttxt}".replace("due on ", "due "))
        args["dueDate"] = iso(due)
    priority_txt = ""
    if rng.random() < 0.25:
        p = rng.choice(["high", "high", "low"])
        args["priority"] = p
        priority_txt = rng.choice({"high": ["urgent", "important", "high priority"], "low": ["low priority", "not urgent"]}[p])
    persistent = False
    if rng.random() < 0.25:
        persistent = True
        args["reminder"] = "persistent"
    items = None
    if title in CHECKLISTS and rng.random() < 0.6:
        pool = CHECKLISTS[title]
        items = rng.sample(pool, k=rng.randint(2, min(5, len(pool))))
        args["items"] = items
    word = rng.choice(["task", "todo", "to-do", "reminder"]) if "homework" not in title.lower() else "homework"
    when_txt = (" " + parts[0]) if parts else ""
    pr = f" ({priority_txt})" if priority_txt else ""
    keep = rng.choice([" and keep reminding me until it's done", ", remind me until I finish it", " — nag me until it's done"]) if persistent else ""
    lst = (": " + ", ".join(items)) if items else ""
    t = title.lower() if rng.random() < 0.6 else title
    msg = rng.choice([
        f"Add a {word} to {t}{when_txt}{pr}{keep}{lst}",
        f"I need to {t}{when_txt}{pr}{keep}{lst}",
        f"new {word}: {t}{when_txt}{pr}{keep}{lst}",
        f"remind me to {t}{when_txt}{keep}{pr}{lst}",
        f"{cap(t)}{when_txt}{pr}{keep}{lst}",
        f"todo {t}{when_txt}{pr}{lst}{keep}",
    ]).replace(" to to ", " to ")
    call = c.call("add_todo", args)
    res = f"Added task \"{title}\""
    if due:
        res += f" due {short_due(due)}"
    if items:
        res += f" with {len(items)} checklist item{'s' if len(items) > 1 else ''}"
    if persistent:
        res += ". I'll keep reminding until it's done"
    res += "."
    reply = f"Added \"{title}\"" + (f", due {human_day(due, c.now)} at {human_time(due)}" if due else "") + "."
    if persistent:
        reply += " I'll keep reminding you until it's done."
    elif items:
        reply += f" It has {len(items)} checklist items."
    return [user(msg, rng), assistant_calls(call), tool_msg(call, res), say(reply)]


def s_add_note(c: Ctx) -> list[dict]:
    rng = c.rng
    title, body, tags = rng.choice(NOTE_TOPICS)
    args: dict = {"title": title, "body": body}
    msg = rng.choice([
        f"Write down: {body}",
        f"Note this — {title.lower()}: {body}",
        f"Save a note called {title}: {body}",
        f"take a note: {body}",
        f"jot down my {title.lower()}: {body}",
        f"Make a note \"{title}\" — {body}",
    ])
    if tags and rng.random() < 0.4:
        args["tags"] = tags
        msg += f" (tag it {tags.replace(',', ' and ')})"
    if rng.random() < 0.15:
        args["pinned"] = True
        msg += " and pin it"
    call = c.call("add_note", args)
    return [user(msg, rng), assistant_calls(call), tool_msg(call, f"Added note: \"{title}\""),
            say(rng.choice([f"Saved your note \"{title}\".", f"Noted — \"{title}\" is in your notes.", f"Saved \"{title}\"" + (" and pinned it." if args.get("pinned") else "."), ]))]


def fake_events(c: Ctx, k: int) -> list[tuple[str, str, datetime]]:
    rng = c.rng
    out = []
    for _ in range(k):
        _, dt = when(rng, c.now)
        title = rng.choice(EVENTS) if rng.random() < 0.6 else rng.choice(WITH_PERSON).format(p=rng.choice(PEOPLE))
        out.append((app_id(rng, "evt"), title, dt))
    return sorted(out, key=lambda e: e[2])


def event_lines(evts) -> str:
    return "\n".join(f"- [id:{i}] {t} ({d.month}/{d.day}/{d.year} {hm12(d)})" for i, t, d in evts)


def s_list_events(c: Ctx) -> list[dict]:
    rng = c.rng
    evts = fake_events(c, rng.randint(0, 5))
    msg = rng.choice(["What's on my calendar?", "what do I have coming up", "show my events", "any meetings this week?",
                      "What's my schedule?", "do I have anything tomorrow?", "list my events", "Ano schedule ko?"])
    call = c.call("list_events", {})
    if not evts:
        return [user(msg, rng), assistant_calls(call), tool_msg(call, "No events found."),
                say("Your calendar is clear — no events coming up.")]
    first = evts[0]
    summary = "; ".join(f"{t} {human_day(d, c.now)} at {human_time(d)}" for _, t, d in evts[:3])
    reply = (f"You have {len(evts)} event{'s' if len(evts) > 1 else ''}: {summary}"
             + (f", and {len(evts) - 3} more." if len(evts) > 3 else "."))
    if "tomorrow" in msg:
        tm = [e for e in evts if (e[2].date() - c.now.date()).days == 1]
        reply = ("Tomorrow you have " + "; ".join(f"{t} at {human_time(d)}" for _, t, d in tm) + ".") if tm else \
            f"Nothing tomorrow. Next up is {first[1]} {human_day(first[2], c.now)} at {human_time(first[2])}."
    return [user(msg, rng), assistant_calls(call), tool_msg(call, event_lines(evts)), say(reply)]


def fake_todos(c: Ctx, k: int):
    rng = c.rng
    out = []
    for title in rng.sample(TASKS, k):
        due = c.now + timedelta(days=rng.randint(-2, 9), hours=rng.randint(0, 10))
        due = due.replace(minute=rng.choice([0, 30, 59]), second=0, microsecond=0)
        out.append((app_id(rng, "todo"), title, rng.choice(["medium", "medium", "high", "low"]), due))
    return sorted(out, key=lambda t: t[3])


def s_list_todos(c: Ctx) -> list[dict]:
    rng = c.rng
    todos = fake_todos(c, rng.randint(0, 5))
    args: dict = {}
    msg = rng.choice(["What tasks do I have?", "show my todos", "what's due?", "anything overdue?", "my to-do list",
                      "what homework do I have left", "list my tasks"])
    if rng.random() < 0.3:
        n = rng.choice([1, 3, 7])
        args["withinDays"] = n
        msg = rng.choice({1: ["what's due today or tomorrow?", "anything due by tomorrow?"],
                          3: ["what's due in the next 3 days?", "tasks for the next few days"],
                          7: ["what's due this week?", "tasks due within a week"]}[n])
        todos = [t for t in todos if t[3] <= c.now + timedelta(days=n)]
    call = c.call("list_todos", args)
    if not todos:
        return [user(msg, rng), assistant_calls(call), tool_msg(call, "No tasks found."),
                say("You're all caught up — no open tasks.")]
    lines = []
    for i, t, p, d in todos:
        s = f"- [id:{i}] {t} [{p}] due {short_due(d)}"
        if d < c.now:
            s += " — OVERDUE"
        lines.append(s)
    overdue = [t for t in todos if t[3] < c.now]
    reply = f"You have {len(todos)} open task{'s' if len(todos) > 1 else ''}"
    if overdue:
        reply += f"; {', '.join(t[1] for t in overdue)} {'is' if len(overdue) == 1 else 'are'} overdue"
    nxt = [t for t in todos if t[3] >= c.now]
    if nxt:
        reply += f". Next up: {nxt[0][1]}, due {human_day(nxt[0][3], c.now)} at {human_time(nxt[0][3])}"
    return [user(msg, rng), assistant_calls(call), tool_msg(call, "\n".join(lines)), say(reply + ".")]


def s_complete_todo(c: Ctx) -> list[dict]:
    rng = c.rng
    title = rng.choice(TASKS)
    q = title.lower() if rng.random() < 0.5 else " ".join(title.lower().split()[:2])
    done = rng.random() < 0.85
    if done:
        msg = rng.choice([f"I finished {q}", f"mark {q} as done", f"done with {q}", f"check off {q}", f"tapos na {q}"])
        args = {"query": q}
    else:
        msg = rng.choice([f"reopen {q}", f"mark {q} as not done", f"I'm not actually done with {q}"])
        args = {"query": q, "done": False}
    call = c.call("complete_todo", args)
    return [user(msg, rng), assistant_calls(call),
            tool_msg(call, f"Marked todo \"{title}\" as {'done' if done else 'not done'}."),
            say(rng.choice([f"Nice work — \"{title}\" is done.", f"Checked off \"{title}\"."]) if done else f"Reopened \"{title}\".")]


def s_update_event(c: Ctx) -> list[dict]:
    rng = c.rng
    title = rng.choice(EVENTS)
    q = title.lower() if rng.random() < 0.5 else title.split()[0].lower()
    phrase, dt = when(rng, c.now)
    kind = rng.random()
    if kind < 0.6:
        msg = rng.choice([f"Move my {q} to {phrase}", f"reschedule {q} to {phrase}", f"change {q} to {phrase}",
                          f"push the {q} to {phrase}"])
        args = {"query": q, "startDate": iso(dt)}
        reply = f"Moved \"{title}\" to {human_day(dt, c.now)} at {human_time(dt)}."
        new_title = title
    elif kind < 0.8:
        new_title = rng.choice(EVENTS)
        msg = f"rename {q} to {new_title}"
        args = {"query": q, "title": new_title}
        reply = f"Renamed it to \"{new_title}\"."
    else:
        note = rng.choice(["Bring the documents", "Room changed to 401", "Wear formal attire", "Bring laptop"])
        msg = f"add a note to my {q}: {note.lower()}"
        args = {"query": q, "notes": note}
        reply = f"Added that note to \"{title}\"."
        new_title = title
    call = c.call("update_event", args)
    return [user(msg, rng), assistant_calls(call), tool_msg(call, f"Updated event \"{new_title}\"."), say(reply)]


def s_update_todo(c: Ctx) -> list[dict]:
    rng = c.rng
    title = rng.choice(TASKS)
    q = title.lower()
    if rng.random() < 0.5:
        dtxt, day = pick_day(rng, c.now)
        due = day.replace(hour=23, minute=59, second=0, microsecond=0)
        msg = rng.choice([f"push {q} to {dtxt}", f"change the deadline of {q} to {dtxt}", f"{q} is now due {dtxt}"]).replace("to on ", "to ").replace("due on ", "due ")
        args = {"query": q, "dueDate": iso(due)}
        reply = f"\"{title}\" is now due {human_day(due, c.now)}."
    else:
        p = rng.choice(["high", "low"])
        msg = rng.choice([f"make {q} {p} priority", f"set {q} priority to {p}", f"{q} is {'urgent' if p == 'high' else 'not urgent'}"])
        args = {"query": q, "priority": p}
        reply = f"Set \"{title}\" to {p} priority."
    call = c.call("update_todo", args)
    return [user(msg, rng), assistant_calls(call), tool_msg(call, f"Updated todo \"{title}\"."), say(reply)]


def s_delete(c: Ctx) -> list[dict]:
    rng = c.rng
    kind = rng.choice(["event", "todo"])
    title = rng.choice(EVENTS if kind == "event" else TASKS)
    q = title.lower()
    msg = rng.choice([f"delete {q}", f"cancel my {q}", f"remove {q} from my {'calendar' if kind == 'event' else 'tasks'}",
                      f"I don't need {q} anymore, delete it", f"pakitanggal {q}"])
    call = c.call(f"delete_{kind}", {"query": q})
    return [user(msg, rng), assistant_calls(call), tool_msg(call, f"Deleted {kind} \"{title}\"."),
            say(rng.choice([f"Deleted \"{title}\".", f"Removed \"{title}\"."]))]


def s_ambiguous(c: Ctx) -> list[dict]:
    """Tool says several items match → the model asks, it does not guess."""
    rng = c.rng
    p1, p2 = rng.sample(PEOPLE, 2)
    msg = rng.choice(["delete my lunch", "cancel lunch", "move lunch to 2pm"])
    tool = "update_event" if "move" in msg else "delete_event"
    args = {"query": "lunch"}
    if tool == "update_event":
        _, dt = when(rng, c.now)
        dt = dt.replace(hour=14, minute=0)
        args["startDate"] = iso(dt)
    call = c.call(tool, args)
    return [user(msg, rng), assistant_calls(call),
            tool_msg(call, f"Error: Multiple events match \"lunch\": Lunch with {p1}, Lunch with {p2}. Ask which one or pass its id."),
            say(f"You have two lunches — with {p1} and with {p2}. Which one?")]


def s_list_then_act(c: Ctx) -> list[dict]:
    """Multi-step: read first, then act on the id found."""
    rng = c.rng
    evts = fake_events(c, rng.randint(2, 4))
    target = rng.choice(evts)
    msg = rng.choice(["cancel my next meeting", "delete the first event on my calendar", "move my next event an hour later"])
    if "next" in msg or "first" in msg:
        target = evts[0]
    c1 = c.call("list_events", {})
    out = [user(msg, rng), assistant_calls(c1), tool_msg(c1, event_lines(evts))]
    if "move" in msg:
        nd = target[2] + timedelta(hours=1)
        c2 = c.call("update_event", {"id": target[0], "startDate": iso(nd)})
        out += [assistant_calls(c2), tool_msg(c2, f"Updated event \"{target[1]}\"."),
                say(f"Moved \"{target[1]}\" to {human_time(nd)} {human_day(nd, c.now)}.")]
    else:
        c2 = c.call("delete_event", {"id": target[0]})
        out += [assistant_calls(c2), tool_msg(c2, f"Deleted event \"{target[1]}\"."),
                say(f"Cancelled \"{target[1]}\" ({human_day(target[2], c.now)} at {human_time(target[2])}).")]
    return out


def s_multi(c: Ctx) -> list[dict]:
    """Two actions in one message → two parallel tool calls."""
    rng = c.rng
    title = rng.choice(EVENTS)
    phrase, dt = when(rng, c.now)
    task = rng.choice(TASKS)
    dtxt, day = pick_day(rng, c.now)
    due = day.replace(hour=23, minute=59, second=0, microsecond=0)
    msg = rng.choice([f"add {title.lower()} {phrase} and a task to {task.lower()} by {dtxt}",
                      f"Schedule {title.lower()} {phrase}, also remind me to {task.lower()} by {dtxt}"]).replace("by on ", "by ")
    c1 = c.call("add_event", {"title": title, "startDate": iso(dt)})
    c2 = c.call("add_todo", {"title": task, "dueDate": iso(due)})
    return [user(msg, rng), assistant_calls(c1, c2),
            tool_msg(c1, f"Added event: \"{title}\" on {locale_string(dt)}"),
            tool_msg(c2, f"Added task \"{task}\" due {short_due(due)}."),
            say(f"Added {title} {human_day(dt, c.now)} at {human_time(dt)}, and \"{task}\" due {human_day(due, c.now)}.")]


def s_remember(c: Ctx) -> list[dict]:
    rng = c.rng
    said, name, typ, desc = rng.choice(FACTS)
    msg = rng.choice([said, f"remember that {said[0].lower() + said[1:]}", f"fyi {said[0].lower() + said[1:]}"])
    call = c.call("remember_entity", {"name": name, "type": typ, "description": desc})
    return [user(msg, rng), assistant_calls(call), tool_msg(call, f"Remembered \"{name}\" as a {typ}."),
            say(rng.choice(["Got it, I'll remember that.", "Noted — I'll remember.", f"I'll remember {name}."]))]


def s_recall(c: Ctx) -> list[dict]:
    rng = c.rng
    said, name, typ, desc = rng.choice(FACTS)
    qs = {"person": [f"who is {name}?", f"what do you know about {name}"],
          "pet": ["what's my dog's name?"], "place": [f"what did I tell you about {name}?"]}
    msg = rng.choice(qs.get(typ, [f"what do you remember about {name.lower()}?", f"what did I say about {name.lower()}?"]))
    call = c.call("recall_memory", {"query": name})
    hit = rng.random() < 0.85
    res = f"- **{name}** [id:{app_id(rng, 'ent')}] ({typ}): {desc}" if hit else f"No matches for \"{name}\"."
    reply = f"{desc.replace('User', 'You').replace(' user', ' you')}." if hit else f"I don't have anything saved about {name} yet. Want to tell me?"
    return [user(msg, rng), assistant_calls(call), tool_msg(call, res), say(reply.replace("..", "."))]


def s_inbox(c: Ctx) -> list[dict]:
    rng = c.rng
    items = rng.sample(INBOX, rng.randint(1, 4))
    unread = rng.random() < 0.5
    args = {"unreadOnly": True} if unread else {}
    msg = rng.choice(["any new messages?", "check my unread notifications"] if unread else
                     ["what's in my inbox?", "show my notifications", "did anyone message me?"])
    call = c.call("list_inbox", args)
    d = c.now - timedelta(days=rng.randint(0, 2))
    lines = "\n".join(f"- [{s}] {t}: {b} ({d.month}/{d.day}/{d.year}) [unread]" for s, t, b in items)
    reply = f"You have {len(items)} {'unread ' if unread else ''}item{'s' if len(items) > 1 else ''}: " + \
        "; ".join(f"{t} — {b}" for _, t, b in items[:3]) + "."
    return [user(msg, rng), assistant_calls(call), tool_msg(call, lines), say(reply)]


def s_list_notes(c: Ctx) -> list[dict]:
    rng = c.rng
    title, body, tags = rng.choice(NOTE_TOPICS)
    key = title.split()[0].lower()
    msg = rng.choice([f"find my note about {key}", f"what did I write about {key}?", f"show my {title.lower()} note"])
    call = c.call("list_notes", {"query": key})
    nid = app_id(rng, "note")
    tg = f" #{' #'.join(tags.split(','))}" if tags else ""
    return [user(msg, rng), assistant_calls(call), tool_msg(call, f"- [id:{nid}] {title} — {body[:60]}{tg}"),
            say(f"Here it is — \"{title}\": {body}")]


def s_update_note(c: Ctx) -> list[dict]:
    rng = c.rng
    title, body, _ = rng.choice(NOTE_TOPICS)
    if rng.random() < 0.5:
        msg, args, reply = f"pin my {title.lower()} note", {"query": title.lower(), "pinned": True}, f"Pinned \"{title}\"."
    else:
        new = rng.choice(["Updated: ", "v2: "]) + body
        msg = f"replace my {title.lower()} note with: {new}"
        args, reply = {"query": title.lower(), "body": new}, f"Updated \"{title}\"."
    call = c.call("update_note", args)
    return [user(msg, rng), assistant_calls(call), tool_msg(call, f"Updated note \"{title}\"."), say(reply)]


def s_tool_error(c: Ctx) -> list[dict]:
    rng = c.rng
    title = rng.choice(TASKS)
    q = title.lower()
    call = c.call("complete_todo", {"query": q})
    return [user(f"mark {q} done", rng), assistant_calls(call),
            tool_msg(call, f"Error: No todo matches \"{q}\"."),
            say(f"I couldn't find a task called \"{title}\". Want me to add it?")]


def s_chat(c: Ctx) -> list[dict]:
    rng = c.rng
    q, a = rng.choice(SMALL_TALK)
    return [user(q, rng), say(a)]


def s_date_question(c: Ctx) -> list[dict]:
    rng = c.rng
    if rng.random() < 0.5:
        return [user(rng.choice(["what day is it today?", "what's the date?", "anong araw ngayon?"]), rng),
                say(f"Today is {WEEKDAYS[c.now.weekday()]}, {MONTHS[c.now.month - 1]} {c.now.day}, {c.now.year}.")]
    wd = rng.randrange(7)
    d = next_weekday(c.now, wd)
    return [user(f"what's the date this coming {WEEKDAYS[wd]}?", rng),
            say(f"This coming {WEEKDAYS[wd]} is {MONTHS[d.month - 1]} {d.day}.")]


def s_followup(c: Ctx) -> list[dict]:
    """Multi-turn: an earlier exchange in history, then a follow-up that refers back."""
    first = s_add_event(c)
    title = first[1]["tool_calls"][0]["function"]["arguments"]["title"]
    rng = c.rng
    phrase, dt = when(rng, c.now)
    msg = rng.choice([f"actually make it {phrase}", f"move it to {phrase}", f"wait, change that to {phrase}"])
    call = c.call("update_event", {"query": title, "startDate": iso(dt)})
    return first + [user(msg, rng), assistant_calls(call), tool_msg(call, f"Updated event \"{title}\"."),
                    say(f"Moved \"{title}\" to {human_day(dt, c.now)} at {human_time(dt)}.")]


SCENARIOS = [  # (weight, fn)
    (16, s_add_event), (16, s_add_todo), (8, s_add_note), (7, s_list_events), (7, s_list_todos),
    (5, s_complete_todo), (6, s_update_event), (4, s_update_todo), (5, s_delete), (2, s_ambiguous),
    (4, s_list_then_act), (4, s_multi), (4, s_remember), (3, s_recall), (3, s_inbox), (3, s_list_notes),
    (2, s_update_note), (2, s_tool_error), (7, s_chat), (2, s_date_question), (4, s_followup),
]


def known_context(rng: random.Random) -> str:
    """Sometimes the app prepends retrieved memory to the prompt."""
    if rng.random() > 0.25:
        return ""
    facts = rng.sample(FACTS, rng.randint(1, 3))
    return "\n".join(f"- {n} ({t}): {d}" for _, n, t, d in facts)


def make_example(rng: random.Random, tools: list[dict]) -> dict:
    now = datetime(2026, 1, 1) + timedelta(days=rng.randint(0, 729), hours=rng.randint(6, 22), minutes=rng.randint(0, 59))
    c = Ctx(rng, now)
    fn = rng.choices([f for _, f in SCENARIOS], weights=[w for w, _ in SCENARIOS])[0]
    msgs = fn(c)
    return {"scenario": fn.__name__.removeprefix("s_"),
            "messages": [{"role": "system", "content": system_prompt(now, known_context(rng))}] + msgs,
            "tools": tools}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", type=int, default=3000)
    ap.add_argument("--eval", type=int, default=300)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--tools", default=str(HERE / "tools.json"))
    ap.add_argument("--out", default=str(HERE / "data"))
    a = ap.parse_args()
    tools = json.loads(Path(a.tools).read_text())
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    seen: set[str] = set()
    for split, n, seed in (("train", a.train, a.seed), ("eval", a.eval, a.seed + 1000)):
        rng = random.Random(seed)
        rows = []
        while len(rows) < n:
            ex = make_example(rng, tools)
            key = json.dumps(ex["messages"][1:], sort_keys=True)
            if key in seen:  # keep eval disjoint from train
                continue
            seen.add(key)
            rows.append(ex)
        with open(out / f"{split}.jsonl", "w") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"{split}: {len(rows)} examples → {out / f'{split}.jsonl'}")


if __name__ == "__main__":
    main()
