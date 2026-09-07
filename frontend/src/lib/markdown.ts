// Toggle satu baris checkbox "- [ ] ..." / "- [x] ..." pada teks markdown mentah (ADR-0043).
export function toggleCheckboxLine(text: string, lineIndex: number): string {
  const lines = text.split("\n");
  const line = lines[lineIndex];
  if (!line) return text;
  const match = line.match(/^- \[([ xX])\] (.*)$/);
  if (!match) return text;
  const nextState = match[1] === " " ? "x" : " ";
  lines[lineIndex] = `- [${nextState}] ${match[2]}`;
  return lines.join("\n");
}
