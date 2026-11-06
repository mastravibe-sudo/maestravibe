export type CachedMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  image_url: string | null;
  voice_url: string | null;
  created_at: string;
};

export type CachedMedia = {
  messageId: string;
  blob: Blob;
  mimeType: string;
};

const DATABASE_NAME = "maestra-vibe-inbox";
const DATABASE_VERSION = 1;
let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Local chat storage is not available in this browser."));
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("messages")) {
        const messages = database.createObjectStore("messages", { keyPath: "id" });
        messages.createIndex("conversation_id", "conversation_id", { unique: false });
      }
      if (!database.objectStoreNames.contains("media")) {
        database.createObjectStore("media", { keyPath: "messageId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Could not open local chat storage."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Local chat storage is blocked by another browser tab."));
    };
  });
  return databasePromise;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error("Could not save local chat data."));
  });
}

export async function saveCachedMessages(messages: CachedMessage[]) {
  if (!messages.length) return;
  const database = await openDatabase();
  const transaction = database.transaction("messages", "readwrite");
  const store = transaction.objectStore("messages");
  messages.forEach((message) => store.put(message));
  await transactionDone(transaction);
}

export async function getCachedMessages(conversationId: string): Promise<CachedMessage[]> {
  const database = await openDatabase();
  const transaction = database.transaction("messages", "readonly");
  const request = transaction.objectStore("messages").index("conversation_id").getAll(conversationId);
  const result = await new Promise<CachedMessage[]>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as CachedMessage[]).sort(
      (left, right) => left.created_at.localeCompare(right.created_at)
    ));
    request.onerror = () => reject(request.error ?? new Error("Could not read local chat history."));
  });
  await transactionDone(transaction);
  return result;
}

export async function saveCachedMedia(messageId: string, blob: Blob) {
  const database = await openDatabase();
  const transaction = database.transaction("media", "readwrite");
  transaction.objectStore("media").put({ messageId, blob, mimeType: blob.type } satisfies CachedMedia);
  await transactionDone(transaction);
}

export async function getCachedMedia(messageId: string): Promise<CachedMedia | null> {
  const database = await openDatabase();
  const transaction = database.transaction("media", "readonly");
  const request = transaction.objectStore("media").get(messageId);
  const result = await new Promise<CachedMedia | null>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as CachedMedia | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read local chat media."));
  });
  await transactionDone(transaction);
  return result;
}

export async function clearCachedChatHistory(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(["messages", "media"], "readwrite");
  transaction.objectStore("messages").clear();
  transaction.objectStore("media").clear();
  await transactionDone(transaction);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function write16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function write32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function concatenate(chunks: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
}

export function createZip(entries: Array<{ name: string; data: Uint8Array }>): Blob {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  entries.forEach(({ name, data }) => {
    const filename = encoder.encode(name);
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30 + filename.length);
    const localView = new DataView(localHeader.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800);
    write16(localView, 8, 0);
    write16(localView, 10, dosTime);
    write16(localView, 12, dosDate);
    write32(localView, 14, checksum);
    write32(localView, 18, data.length);
    write32(localView, 22, data.length);
    write16(localView, 26, filename.length);
    localHeader.set(filename, 30);
    localChunks.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + filename.length);
    const centralView = new DataView(centralHeader.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write16(centralView, 10, 0);
    write16(centralView, 12, dosTime);
    write16(centralView, 14, dosDate);
    write32(centralView, 16, checksum);
    write32(centralView, 20, data.length);
    write32(centralView, 24, data.length);
    write16(centralView, 28, filename.length);
    write32(centralView, 42, localOffset);
    centralHeader.set(filename, 46);
    centralChunks.push(centralHeader);
    localOffset += localHeader.length + data.length;
  });

  const centralDirectory = concatenate(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 8, entries.length);
  write16(endView, 10, entries.length);
  write32(endView, 12, centralDirectory.length);
  write32(endView, 16, localOffset);
  const parts: ArrayBuffer[] = [...localChunks, centralDirectory, end].map((chunk) => {
    const buffer = new ArrayBuffer(chunk.byteLength);
    new Uint8Array(buffer).set(chunk);
    return buffer;
  });
  return new Blob(parts, { type: "application/zip" });
}
