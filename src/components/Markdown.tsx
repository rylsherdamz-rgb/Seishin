import { View, Text } from "react-native";

/**
 * Lightweight markdown renderer for AI chat responses. Renders headings,
 * bold/italic, inline code, fenced code blocks, bullet/numbered lists,
 * blockquotes, and tables — styled for the monochrome design system.
 * No external dependencies.
 */

type InlineToken =
  | { t: "text"; v: string }
  | { t: "bold"; v: string }
  | { t: "italic"; v: string }
  | { t: "code"; v: string };

// Split a line into inline tokens (**bold**, *italic*/_italic_, `code`).
function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ t: "text", v: text.slice(last, m.index) });
    const s = m[0];
    if (s.startsWith("**") || s.startsWith("__")) tokens.push({ t: "bold", v: s.slice(2, -2) });
    else if (s.startsWith("`")) tokens.push({ t: "code", v: s.slice(1, -1) });
    else tokens.push({ t: "italic", v: s.slice(1, -1) });
    last = m.index + s.length;
  }
  if (last < text.length) tokens.push({ t: "text", v: text.slice(last) });
  return tokens;
}

function Inline({ text, className = "" }: { text: string; className?: string }) {
  const tokens = parseInline(text);
  return (
    <Text className={`text-sm leading-5 text-black ${className}`}>
      {tokens.map((tk, i) => {
        if (tk.t === "bold") return <Text key={i} className="font-semibold text-black">{tk.v}</Text>;
        if (tk.t === "italic") return <Text key={i} className="italic">{tk.v}</Text>;
        if (tk.t === "code") return <Text key={i} className="font-mono text-[13px] text-black bg-ink-100 rounded px-1">{tk.v}</Text>;
        return <Text key={i}>{tk.v}</Text>;
      })}
    </Text>
  );
}

interface Block {
  key: string;
  render: () => React.ReactNode;
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const codeText = code.join("\n");
      blocks.push({
        key: `code-${k++}`,
        render: () => (
          <View className="bg-ink-900 rounded-lg p-3 my-1.5">
            <Text className="font-mono text-[12.5px] leading-5 text-white">{codeText}</Text>
          </View>
        ),
      });
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({
        key: `table-${k++}`,
        render: () => (
          <View className="border border-ink-200 rounded-lg overflow-hidden my-1.5">
            <View className="flex-row bg-ink-100">
              {header.map((c, ci) => (
                <View key={ci} className="flex-1 px-2.5 py-2 border-r border-ink-200">
                  <Inline text={c} className="font-semibold text-xs" />
                </View>
              ))}
            </View>
            {rows.map((r, ri) => (
              <View key={ri} className={`flex-row ${ri % 2 ? "bg-ink-50" : "bg-white"}`}>
                {header.map((_, ci) => (
                  <View key={ci} className="flex-1 px-2.5 py-2 border-r border-t border-ink-100">
                    <Inline text={r[ci] ?? ""} className="text-xs" />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ),
      });
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const txt = heading[2];
      const size = level <= 1 ? "text-lg" : level === 2 ? "text-base" : "text-sm";
      blocks.push({
        key: `h-${k++}`,
        render: () => (
          <Inline text={txt} className={`${size} font-semibold text-black mt-2 mb-0.5`} />
        ),
      });
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        key: `q-${k++}`,
        render: () => (
          <View className="border-l-2 border-ink-300 pl-3 my-1">
            <Inline text={quote.join(" ")} className="text-ink-600 italic" />
          </View>
        ),
      });
      continue;
    }

    // Lists (bullet or numbered) — group consecutive items
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const items: { ordered: boolean; marker: string; text: string }[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const mm = lines[i].match(/^\s*([-*+]|(\d+)\.)\s+(.*)$/);
        if (!mm) break;
        const ordered = !!mm[2];
        items.push({ ordered, marker: ordered ? `${mm[2]}.` : "•", text: mm[3] });
        i++;
      }
      blocks.push({
        key: `list-${k++}`,
        render: () => (
          <View className="my-1 gap-1">
            {items.map((it, ii) => (
              <View key={ii} className="flex-row gap-2">
                <Text className="text-sm leading-5 text-ink-500 w-4 text-right">{it.marker}</Text>
                <View className="flex-1">
                  <Inline text={it.text} />
                </View>
              </View>
            ))}
          </View>
        ),
      });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — accumulate consecutive plain lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i++;
    }
    const paraText = para.join(" ");
    blocks.push({
      key: `p-${k++}`,
      render: () => <Inline text={paraText} className="my-0.5" />,
    });
  }

  return <View className="gap-0.5">{blocks.map((b) => <View key={b.key}>{b.render()}</View>)}</View>;
}
