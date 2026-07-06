export const MASCOT_NAME = "Sprig";

const poses = {
  idle: ["  \\|/  ", " (o o) ", "  /_\\  "],
  celebrate: [" \\ | / ", " (^o^) ", "  /|\\  "],
  warn: ["  \\!/  ", " (o!)  ", "  /_\\  "],
  think: ["  ? ?  ", " (o o) ", "  /_\\  "],
} as const;

export function mascot(pose: keyof typeof poses): string[] {
  return [...poses[pose]];
}

const burstFrames = [". * .", "* + *", ". x .", "* . *"] as const;

export function xpBurst(frame: number): string {
  return burstFrames[Math.abs(frame) % burstFrames.length];
}

export function unlockBanner(tools: string[]): string[] {
  const names = tools.length > 0 ? tools.join(" + ") : "tool";
  const body = ` NEW VERB: ${names} `;
  const edge = `░▒▓${"═".repeat(body.length)}▓▒░`;
  return [edge, `░▒▓${body}▓▒░`, edge];
}
