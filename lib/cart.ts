import { PrintSize, ProductType } from '@/config/products';

export interface CartItem {
    id: string;
    routeName: string;
    routeId: string;
    productType: ProductType;
    size: PrintSize;
    quantity: number;
    addedAt: number;
}

const DB_NAME = 'cartDB';
const DB_VERSION = 1;
const ITEMS_STORE = 'cartItems';
const IMAGES_STORE = 'cartImages';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(ITEMS_STORE)) {
                db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(IMAGES_STORE)) {
                db.createObjectStore(IMAGES_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getCartItems(): Promise<CartItem[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ITEMS_STORE, 'readonly');
        const request = tx.objectStore(ITEMS_STORE).getAll();
        request.onsuccess = () => {
            db.close();
            const items = (request.result as CartItem[])
                .map(item => ({ ...item, quantity: item.quantity || 1, productType: item.productType || 'poster' as ProductType }))
                .sort((a, b) => a.addedAt - b.addedAt);
            resolve(items);
        };
        request.onerror = () => { db.close(); reject(request.error); };
    });
}

export async function addCartItem(item: CartItem, imageDataUrl: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([ITEMS_STORE, IMAGES_STORE], 'readwrite');
        tx.objectStore(ITEMS_STORE).put(item);
        tx.objectStore(IMAGES_STORE).put(imageDataUrl, item.id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

export async function removeCartItem(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([ITEMS_STORE, IMAGES_STORE], 'readwrite');
        tx.objectStore(ITEMS_STORE).delete(id);
        tx.objectStore(IMAGES_STORE).delete(id);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

export async function updateCartItem(item: CartItem): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ITEMS_STORE, 'readwrite');
        tx.objectStore(ITEMS_STORE).put(item);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

export async function getCartImage(id: string): Promise<string | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IMAGES_STORE, 'readonly');
        const request = tx.objectStore(IMAGES_STORE).get(id);
        request.onsuccess = () => { db.close(); resolve(request.result ?? null); };
        request.onerror = () => { db.close(); reject(request.error); };
    });
}

export async function getAllCartImages(): Promise<Record<string, string>> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IMAGES_STORE, 'readonly');
        const store = tx.objectStore(IMAGES_STORE);
        const result: Record<string, string> = {};

        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
            const cursor = cursorReq.result;
            if (cursor) {
                result[cursor.key as string] = cursor.value;
                cursor.continue();
            } else {
                db.close();
                resolve(result);
            }
        };
        cursorReq.onerror = () => { db.close(); reject(cursorReq.error); };
    });
}

export async function clearCart(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([ITEMS_STORE, IMAGES_STORE], 'readwrite');
        tx.objectStore(ITEMS_STORE).clear();
        tx.objectStore(IMAGES_STORE).clear();
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}
