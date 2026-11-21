"""Synthetic training data for Seishin Lite (English, Tagalog, Taglish).

Each intent has phrasing templates with {when}/{time}/{thing} slots. Templates
are split per intent into train / test *by template*, so the test score shows
how well the model handles phrasings it never saw, not memorised ones.
"""
import random

WHEN = [
    "today", "tonight", "this morning", "this afternoon", "this evening", "later", "now",
    "tomorrow", "tmrw", "tom", "the day after tomorrow", "on friday", "on monday", "this saturday", "next tuesday",
    "this week", "next week", "this weekend", "on nov 25", "on the 25th", "on december 3", "on 12/5",
    "ngayon", "ngayong araw", "mamaya", "mamayang gabi", "bukas", "sa makalawa", "sa biyernes", "sa lunes",
    "ngayong linggo", "sa susunod na linggo", "this sabado", "sa weekend", "sa 25",
]
TIME = ["3", "3pm", "3:30", "10am", "noon", "9 am", "2:15 pm", "5", "alas tres", "alas diyes", "lunch", "7pm"]
THING = ["dentist", "exam", "physics lab", "meeting with sam", "standup", "org meeting", "thesis defense",
         "flight", "math quiz", "doctor appointment", "interview", "practice", "birthday party", "class"]
TASK = ["call mom", "buy milk", "submit the essay", "pay rent", "email prof", "finish the report", "review notes"]

T = {
    "agenda": [
        "what's lined up {when}", "what is lined up for {when}", "what do i have {when}", "what's on {when}",
        "whats my schedule {when}", "show my schedule for {when}", "my agenda {when}", "agenda {when}",
        "what's happening {when}", "anything {when}", "do i have anything {when}", "am i busy {when}",
        "how busy am i {when}", "what are my plans {when}", "plans for {when}", "what's on my calendar {when}",
        "calendar {when}", "events {when}", "list my events {when}", "what meetings do i have {when}",
        "do i have meetings {when}", "do i have class {when}", "what classes do i have {when}",
        "give me a rundown of {when}", "brief me on {when}", "remind me what's on {when}", "what's up {when}",
        "what's the plan {when}", "how does {when} look", "how's my day looking", "what's my day like",
        "schedule", "my schedule", "today's schedule", "lineup", "what's lined up",
        "ano ganap ko {when}", "anong ganap {when}", "ano schedule ko {when}", "ano ang schedule ko {when}",
        "may meeting ba ako {when}", "may lakad ba ako {when}", "may pasok ba ako {when}", "may klase ba ako {when}",
        "ano gagawin ko {when}", "anong meron {when}", "busy ba ako {when}", "ano mga lakad ko {when}",
        "pakita schedule ko {when}", "ano plano ko {when}", "anong events ko {when}", "ano nasa calendar ko {when}",
        "sched ko {when}", "sched {when}", "whats sched {when}", "ano sched {when}",
    ],
    "next_event": [
        "what's next", "what's my next event", "next meeting", "when is my next meeting", "what's coming up",
        "what's up next", "what do i have next", "next class", "when's my next class", "anything coming up",
        "what's after this", "what's the next thing on my calendar", "upcoming", "next on my schedule",
        "ano susunod", "ano ang susunod kong lakad", "anong next", "kailan next meeting ko", "ano kasunod",
        "susunod na klase ko", "ano next sa sched ko", "what's coming", "my next appointment", "nearest event",
        "what's my next thing", "where do i need to be next", "where am i going next", "next event please",
        "how long until my next meeting", "when does my next class start", "what time is my next event",
        "saan ako next", "anong oras next ko", "ano yung susunod", "ano susunod na event ko", "may susunod pa ba",
        "what's the next one", "next up", "whats next for me", "anything soon", "what's in a bit",
    ],
    "free_time": [
        "am i free at {time}", "am i free {when}", "am i available at {time}", "am i free at {time} {when}",
        "when am i free {when}", "when am i free", "free time {when}", "do i have free time {when}",
        "find me a free slot {when}", "any gaps {when}", "when can i fit something {when}", "open slots {when}",
        "is {time} free", "is {time} {when} free", "can i do something at {time}", "do i have time at {time}",
        "free ba ako {when}", "free ba ako ng {time}", "bakante ba ako ng {time}", "kailan ako free {when}",
        "kailan ako bakante", "may oras ba ako {when}", "may free time ba ako {when}", "pwede ba ako ng {time}",
        "available ba ako {when}", "when's a good time {when}", "what time am i free", "when do i have a break",
    ],
    "tasks_due": [
        "what's due {when}", "what is due {when}", "what do i need to finish {when}", "deadlines {when}",
        "any deadlines {when}", "my deadlines", "what tasks do i have {when}", "my tasks {when}", "tasks {when}",
        "todo {when}", "my todo list", "what's on my to do list", "what should i work on", "what should i do first",
        "homework {when}", "do i have homework {when}", "what assignments are due {when}", "pending tasks",
        "what's left to do", "what do i still have to do", "show my tasks", "list my todos",
        "ano deadline ko {when}", "ano mga deadline ko", "ano kailangan kong tapusin {when}", "ano mga task ko",
        "may assignment ba ako {when}", "ano dapat kong gawin {when}", "may homework ba {when}", "ano pa kulang ko",
        "mga gagawin ko", "anong due {when}", "ano ipapasa ko {when}", "todo ko {when}",
    ],
    "overdue": [
        "what's overdue", "anything overdue", "what did i miss", "what tasks are late", "late tasks",
        "overdue tasks", "what have i not done", "missed deadlines", "what's past due", "what am i behind on",
        "did i miss anything", "what's late", "ano na-miss ko", "ano mga overdue ko", "ano lumagpas na deadline",
        "late na ba ako sa", "may late ba ako", "ano hindi ko natapos", "ano mga nakalimutan ko",
        "show overdue", "list overdue tasks", "what's still unfinished from before", "which tasks did i miss",
        "what did i forget to do", "anything i forgot", "past deadlines", "what slipped", "overdue",
        "may hindi ba ako natapos", "ano lagpas na", "ano yung late ko", "anong na-overdue", "behind ba ako",
    ],
    "find_event": [
        "when is my {thing}", "when's the {thing}", "when is {thing}", "what time is my {thing}",
        "what day is the {thing}", "find my {thing}", "is my {thing} {when}", "is the {thing} {when}",
        "when do i have {thing}", "kailan ang {thing}", "kailan {thing} ko", "anong oras {thing}",
        "anong araw ang {thing}", "kelan {thing}", "what date is my {thing}", "search for {thing}",
        "when was my last {thing}", "do i have {thing} {when}",
    ],
    "greeting": [
        "hi", "hello", "hey", "good morning", "good evening", "yo", "sup", "hey seishin", "hi seishin",
        "kumusta", "musta", "magandang umaga", "magandang gabi", "hoy", "uy", "good afternoon", "how are you",
        "how r u", "kamusta ka", "hello there", "morning", "hiya", "heyy", "hii", "good day", "evening",
        "whats up seishin", "hello po", "hi po", "magandang hapon", "kamusta na", "oy", "helo", "hai",
    ],
    "thanks": [
        "thanks", "thank you", "thx", "ty", "salamat", "salamat po", "thanks a lot", "nice thanks", "ok thanks",
        "great thank you", "perfect thanks", "ayos salamat", "sige salamat", "cool", "got it", "okay", "ok",
        "thank u", "tnx", "thanks so much", "appreciate it", "nice", "awesome", "salamuch", "maraming salamat",
        "noted", "noted thanks", "alright", "sige", "ayos", "goods", "nice one", "galing", "great",
    ],
    "help": [
        "what can you do", "help", "how do i use this", "what can i ask you", "what are you", "who are you",
        "what do you know", "commands", "show me what you can do", "anong kaya mo", "ano kaya mong gawin",
        "paano ka gamitin", "sino ka", "how does this work", "what questions can i ask",
        "what can you help with", "what are you able to do", "how can you help me", "what do you do",
        "can you help me", "i need help", "what are your features", "examples of questions", "help me",
        "ano pwede kong itanong", "ano ginagawa mo", "tulungan mo ako", "paano ito gamitin", "anong kaya mong sagutin",
        "what is seishin", "tutorial", "guide", "how to use seishin",
    ],
    # Everything Seishin Lite should hand to the language model: actions, writing, general knowledge.
    "other": [
        "add a meeting {when} at {time}", "schedule a call {when}", "create an event for {thing} {when}",
        "add {task} to my tasks", "remind me to {task} {when}", "remind me to {task} at {time}",
        "set a reminder to {task}", "add task {task}", "new todo {task}", "delete my {thing}",
        "cancel the {thing} {when}", "move my {thing} to {when}", "reschedule {thing}", "mark {task} as done",
        "i finished {task}", "write a note about {thing}", "take a note", "save this note",
        "what is photosynthesis", "explain recursion", "write a poem about rain", "translate this to english",
        "who is the president of the philippines", "tell me a joke", "summarize this", "help me study for my {thing}",
        "give me tips for my {thing}", "what should i eat", "how do i cook adobo", "what's the weather",
        "solve 2x + 3 = 7", "write an email to my prof", "make a study plan", "what's a good gift",
        "paalalahanan mo ako na {task} {when}", "idagdag mo {task}", "gawa ka ng event {when}",
        "ilipat mo yung {thing} sa {when}", "burahin mo yung {thing}", "ano ang photosynthesis",
        "ipaliwanag mo ang recursion", "gawan mo ako ng tula", "sumulat ka ng email", "turuan mo ako mag code",
        "what do you think about ai", "i feel stressed", "i'm tired", "tell me about the tarsier",
        "play some music", "open settings", "what did i write in my notes about {thing}", "read my last note",
        "how many days until christmas", "convert 5 km to miles", "set an alarm at {time}",
        "book a {thing} {when}", "put {thing} on my calendar {when}", "plan my {thing}", "block {time} {when} for study",
        "add an event", "create a task", "make a reminder", "add {thing} {when} at {time}", "schedule {thing} {when}",
        "change my {thing} to {time}", "rename the {thing}", "remove {task}", "clear my tasks", "delete all events",
        "remind me {when} to {task}", "dont let me forget to {task}", "pa-remind ako {when} na {task}",
        "pakilagay sa calendar {thing} {when}", "i-add mo {thing} {when}", "gumawa ka ng task na {task}",
        "what is the capital of japan", "how do magnets work", "write my essay", "fix my code", "what's 15% of 200",
        "recommend a movie", "what should i study first for my {thing}", "how do i get to sm", "define entropy",
        "who won the game", "news today", "how to make a resume", "what does seishin mean", "sing a song",
        "can you read this photo", "scan this", "summarize my notes", "what's in my note about {thing}",
    ],
}


def _fill(tpl: str, rng: random.Random) -> str:
    return (tpl.replace("{when}", rng.choice(WHEN)).replace("{time}", rng.choice(TIME))
            .replace("{thing}", rng.choice(THING)).replace("{task}", rng.choice(TASK)))


def _typo(s: str, rng: random.Random) -> str:
    """Phone-keyboard noise: drop, double or swap a letter, or drop the apostrophe."""
    if len(s) < 5:
        return s
    i = rng.randrange(1, len(s) - 1)
    op = rng.random()
    if op < 0.3:
        return s[:i] + s[i + 1:]
    if op < 0.55:
        return s[:i] + s[i] + s[i:]
    if op < 0.8:
        return s[:i - 1] + s[i] + s[i - 1] + s[i + 1:]
    return s.replace("'", "")


PREFIX = ["hey seishin ", "seishin ", "hey ", "quick q ", "uhm ", "pls ", "can you tell me ", "tell me ",
          "i want to know ", "do you know ", "pakisabi ", "pakisabi nga ", "teka ", "uy ", "ok so ", "btw "]


def _style(s: str, rng: random.Random, label: str) -> str:
    # Openers carry no intent; questions-only openers ("tell me") stay off actions and chit-chat.
    if rng.random() < 0.3 and label not in ("greeting", "thanks"):
        s = rng.choice(PREFIX[:4] if label == "other" else PREFIX) + s
    r = rng.random()
    if r < 0.15:
        s = s.capitalize()
    elif r < 0.2:
        s = s.upper()
    if rng.random() < 0.35:
        s += rng.choice(["?", "??", " pls", " po", "?", " please", " ba"])
    if rng.random() < 0.25:
        s = _typo(s, rng)
    return s


def build(per_template: int = 40, test_share: float = 0.2, seed: int = 7, composed: int = 500):
    rng = random.Random(seed)
    labels = list(T)
    train, test = [], []
    for li, label in enumerate(labels):
        tpls = T[label][:]
        rng.shuffle(tpls)
        n_test = max(2, int(len(tpls) * test_share))
        for k, tpl in enumerate(tpls):
            bucket = test if k < n_test else train
            n = per_template if "{" in tpl else max(6, per_template // 4)
            for _ in range(n):
                bucket.append((_style(_fill(tpl, rng), rng, label), li))
    if composed:
        train.extend(compose(composed))
    rng.shuffle(train)
    return labels, train, test


# ---- Round 2: questions composed from parts (training only) -------------------------------------
OBJ_EN = ["meetings", "classes", "events", "plans", "appointments", "anything", "stuff", "things", "work", "school", "practice"]
OBJ_TL = ["meeting", "klase", "lakad", "pasok", "event", "ganap", "lakaran", "gala", "exam", "trabaho", "practice"]
TASK_EN = ["tasks", "homework", "assignments", "deadlines", "todos", "projects", "requirements", "submissions", "reports"]
TASK_TL = ["assignment", "gawain", "task", "requirements", "ipapasa", "deadline", "homework", "project", "takdang aralin"]
END = ["", "", "", "?", " pls", " po", " ba", " please", " thanks", " haha", " rn", " ngayon na"]

COMPOSE = {
    "agenda": [
        lambda r: f"do i have any {r.choice(OBJ_EN)} {r.choice(WHEN)}",
        lambda r: f"what {r.choice(OBJ_EN)} do i have {r.choice(WHEN)}",
        lambda r: f"any {r.choice(OBJ_EN)} {r.choice(WHEN)}",
        lambda r: f"{r.choice(['show', 'list', 'check', 'open', 'see'])} my {r.choice(['schedule', 'calendar', 'agenda', 'day', 'plans'])} {r.choice(WHEN)}",
        lambda r: f"what does {r.choice(['today', 'tomorrow', 'friday', 'my monday', 'next week', 'the weekend', 'my day'])} look like",
        lambda r: f"may {r.choice(OBJ_TL)} ba ako {r.choice(WHEN)}",
        lambda r: f"meron ba akong {r.choice(OBJ_TL)} {r.choice(WHEN)}",
        lambda r: f"ano {r.choice(['mga ', ''])}{r.choice(['lakad', 'ganap', 'schedule', 'sched', 'plano', 'events', 'klase'])} ko {r.choice(WHEN)}",
        lambda r: f"{r.choice(['ganap', 'sched', 'schedule', 'lakad', 'agenda', 'plans'])} {r.choice(WHEN)}",
        lambda r: f"is {r.choice(['today', 'tomorrow', 'my friday', 'next week', 'this weekend', 'monday'])} {r.choice(['busy', 'packed', 'full', 'free', 'clear'])}",
        lambda r: f"what's {r.choice(['going on', 'happening', 'planned', 'scheduled', 'on'])} {r.choice(WHEN)}",
    ],
    "free_time": [
        lambda r: f"am i {r.choice(['free', 'available', 'open', 'busy'])} at {r.choice(TIME)} {r.choice(WHEN + [''])}",
        lambda r: f"is {r.choice(TIME)} {r.choice(['free', 'open', 'available', 'taken', 'ok'])} {r.choice(WHEN + [''])}",
        lambda r: f"{r.choice(['free', 'bakante', 'available', 'pwede'])} ba ako {r.choice(['ng ', 'mamayang ', 'sa ', 'by '])}{r.choice(TIME)}",
        lambda r: f"when {r.choice(['am i free', 'do i have time', 'can i meet', 'is a good time', 'do i have a break', 'can i fit a call'])} {r.choice(WHEN + [''])}",
        lambda r: f"{r.choice(['any', 'find', 'show', 'list'])} {r.choice(['free time', 'free slots', 'gaps', 'openings', 'breaks', 'open time'])} {r.choice(WHEN)}",
        lambda r: f"kailan ako {r.choice(['free', 'bakante', 'pwede', 'available', 'walang ginagawa'])} {r.choice(WHEN + [''])}",
        lambda r: f"may {r.choice(['oras', 'free time', 'bakanteng oras', 'break'])} ba ako {r.choice(WHEN + ['ng ' + t for t in TIME])}",
        lambda r: f"can i {r.choice(['squeeze in', 'fit', 'book', 'do'])} something at {r.choice(TIME)}",
    ],
    "tasks_due": [
        lambda r: f"what {r.choice(TASK_EN)} {r.choice(['are due', 'do i have', 'are left', 'are pending', 'should i do'])} {r.choice(WHEN + [''])}",
        lambda r: f"any {r.choice(TASK_EN)} {r.choice(['due', 'left', 'pending'])} {r.choice(WHEN + [''])}",
        lambda r: f"what do i {r.choice(['need to submit', 'have to finish', 'need to do', 'have to turn in', 'owe'])} {r.choice(WHEN + [''])}",
        lambda r: f"may {r.choice(TASK_TL)} ba ako {r.choice(WHEN + [''])}",
        lambda r: f"ano {r.choice(['mga ', ''])}{r.choice(TASK_TL)} ko {r.choice(WHEN + [''])}",
        lambda r: f"ano {r.choice(['dapat kong', 'kailangan kong', 'pa ang'])} {r.choice(['gawin', 'tapusin', 'ipasa', 'gagawin'])} {r.choice(WHEN + [''])}",
        lambda r: f"{r.choice(['my', 'show', 'list', 'check'])} {r.choice(TASK_EN)} {r.choice(WHEN + [''])}",
        lambda r: f"what's due {r.choice(WHEN + ['', 'soon', 'next'])}",
    ],
    "next_event": [
        lambda r: f"what's my next {r.choice(['meeting', 'class', 'event', 'appointment', 'thing', 'activity'])}",
        lambda r: f"when {r.choice(['is', 'does'])} my next {r.choice(['class', 'meeting', 'event'])}{r.choice(['', ' start'])}",
        lambda r: f"ano {r.choice(['susunod', 'next', 'kasunod'])} {r.choice(['kong lakad', 'na klase ko', 'sa sched ko', 'ko', 'na event'])}",
        lambda r: f"{r.choice(['next', 'upcoming', 'coming up'])} {r.choice(['', 'for me', 'event', 'meeting', 'on my calendar'])}",
    ],
    "overdue": [
        lambda r: f"{r.choice(['what', 'which', 'any'])} {r.choice(TASK_EN)} {r.choice(['are overdue', 'did i miss', 'are late', 'did i forget', 'are past due'])}",
        lambda r: f"ano {r.choice(['mga ', ''])}{r.choice(['na-miss', 'nakalimutan', 'hindi natapos', 'late', 'overdue', 'lumagpas'])} ko",
        lambda r: f"{r.choice(['show', 'list', 'check'])} {r.choice(['overdue', 'late', 'missed'])} {r.choice(['tasks', 'stuff', 'deadlines', ''])}",
    ],
    "find_event": [
        lambda r: f"{r.choice(['when', 'what time', 'what day', 'what date'])} is {r.choice(['my', 'the', 'our'])} {r.choice(THING)}",
        lambda r: f"{r.choice(['kailan', 'kelan', 'anong oras', 'anong araw'])} {r.choice(['ang ', 'yung ', ''])}{r.choice(THING)}{r.choice([' ko', ' namin', ''])}",
        lambda r: f"when's {r.choice(['my', 'the'])} {r.choice(THING)}",
    ],
    "other": [
        lambda r: f"{r.choice(['add', 'create', 'schedule', 'book', 'put'])} {r.choice(['a', 'my', 'the'])} {r.choice(THING)} {r.choice(WHEN)}",
        lambda r: f"remind me {r.choice(['to', 'na', 'about'])} {r.choice(TASK + THING)}",
        lambda r: f"{r.choice(['move', 'cancel', 'delete', 'reschedule', 'rename'])} {r.choice(['my', 'the'])} {r.choice(THING)}",
        lambda r: f"{r.choice(['when', 'what time', 'what year', 'what day'])} {r.choice(['did ww2 end', 'is it in tokyo', 'was rizal born', 'is christmas', 'is the next eclipse', 'did the philippines get independence', 'is it now'])}",
        lambda r: f"{r.choice(['what is', 'whats', 'ano ang', 'explain', 'define', 'who is'])} {r.choice(['a black hole', 'inflation', 'the capital of france', 'photosynthesis', 'dna', 'jose rizal', 'machine learning', 'gravity'])}",
        lambda r: f"{r.choice(['write', 'make', 'gawa ka ng', 'draft'])} {r.choice(['a poem', 'an email', 'a caption', 'a story', 'an essay', 'a speech', 'a message to my mom'])}",
        lambda r: f"{r.choice(['how do i', 'how to', 'paano'])} {r.choice(['cook rice', 'study better', 'fix my wifi', 'learn python', 'save money', 'sleep earlier'])}",
        lambda r: f"i {r.choice(['feel', 'am', 'm'])} {r.choice(['sad', 'stressed', 'tired', 'bored', 'anxious about my exam'])}",
    ],
}


def compose(n_per_label: int = 500, seed: int = 11):
    rng = random.Random(seed)
    labels = list(T)
    rows = []
    for label, makers in COMPOSE.items():
        for _ in range(n_per_label):
            s = rng.choice(makers)(rng).strip() + rng.choice(END)
            rows.append((_style(" ".join(s.split()), rng, label), labels.index(label)))
    return rows
