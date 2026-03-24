import qrcode from 'qrcode-generator';

export function toSvg(text: string): string {
  const qr = qrcode(0, 'L');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
}
