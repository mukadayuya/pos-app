// プリンターMACアドレスの正規化
// 各社ファームウェア/機器で "00:11:62:3A:B4:CD" / "00-11-62-3a-b4-cd" /
// "0011623AB4CD" 等が混在するため、大文字16進12桁に統一してからDB照会する。

export function normalizePrinterMac(raw: string | null | undefined): string {
  if (!raw) return "";
  const hex = raw.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  return hex.length === 12 ? hex : "";
}

export function formatPrinterMac(normalized: string): string {
  if (normalized.length !== 12) return normalized;
  return normalized.match(/.{2}/g)!.join(":");
}
