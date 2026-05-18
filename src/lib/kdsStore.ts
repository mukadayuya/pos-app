const KDS_KEY = "flows_kds_v1";
const MAX_ORDERS = 50;

export interface KdsOrderItem {
  name: string;
  emoji?: string;
  options: string[];
  qty: number;
  servingTime: "before" | "with" | "after";
}

export interface KdsOrder {
  id: string;
  items: KdsOrderItem[];
  tableLabel?: string;
  lang: string;
  createdAt: number;
  status: "new" | "preparing" | "done";
}

function readRaw(): KdsOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as KdsOrder[];
  } catch {
    return [];
  }
}

function writeRaw(orders: KdsOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KDS_KEY, JSON.stringify(orders));
  } catch {
    // storage quota or private mode — silently ignore
  }
}

export function getKdsOrders(): KdsOrder[] {
  return readRaw();
}

export function addKdsOrder(order: KdsOrder): void {
  const orders = readRaw();
  orders.push(order);
  const trimmed = orders.slice(-MAX_ORDERS);
  writeRaw(trimmed);
}

export function updateKdsOrderStatus(
  id: string,
  status: KdsOrder["status"]
): void {
  const orders = readRaw();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return;
  orders[idx] = { ...orders[idx], status };
  writeRaw(orders);
}

export function clearDoneOrders(): void {
  const orders = readRaw().filter((o) => o.status !== "done");
  writeRaw(orders);
}

export function seedDemoOrders(): void {
  if (getKdsOrders().length > 0) return;

  const now = Date.now();

  const demo: KdsOrder[] = [
    {
      id: "demo-" + Math.random().toString(36).slice(2, 10),
      tableLabel: "テーブル3",
      lang: "ja",
      createdAt: now - 1 * 60 * 1000,
      status: "new",
      items: [
        {
          name: "麻婆豆腐",
          emoji: "🌶️",
          options: ["辛さ: 3辛", "量: 大盛"],
          qty: 2,
          servingTime: "with",
        },
        {
          name: "白ごはん",
          emoji: "🍚",
          options: [],
          qty: 2,
          servingTime: "with",
        },
      ],
    },
    {
      id: "demo-" + Math.random().toString(36).slice(2, 10),
      tableLabel: "テーブル7",
      lang: "ja",
      createdAt: now - 7 * 60 * 1000,
      status: "preparing",
      items: [
        {
          name: "餃子",
          emoji: "🥟",
          options: ["焼き方: パリパリ"],
          qty: 1,
          servingTime: "before",
        },
        {
          name: "ラーメン",
          emoji: "🍜",
          options: ["麺の固さ: 硬め", "スープ: 醤油"],
          qty: 1,
          servingTime: "with",
        },
      ],
    },
    {
      id: "demo-" + Math.random().toString(36).slice(2, 10),
      tableLabel: "モバイル",
      lang: "ja",
      createdAt: now - 12 * 60 * 1000,
      status: "done",
      items: [
        {
          name: "チャーハン",
          emoji: "🍳",
          options: ["量: 普通"],
          qty: 1,
          servingTime: "with",
        },
      ],
    },
  ];

  demo.forEach((o) => addKdsOrder(o));
}
