import { qrcode } from "@libs/qrcode";

export function toSvg(text: string): string {
  return qrcode(text, { output: "svg", ecl: "LOW" });
}
