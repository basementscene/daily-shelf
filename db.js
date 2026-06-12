const DB_NAME = 'foodTracker';
const DB_VER = 2;

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const name of ['foodItems', 'pantryItems', 'mealLogs', 'recipes']) {
        if (!db.objectStoreNames.contains(name))
          db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function dbOp(storeName, mode, cb) {
  return openDB().then(db => new Promise((res, rej) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    cb(store, res, rej);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); rej(tx.error); };
  }));
}

function getAll(store) {
  return new Promise((res, rej) => { const r = store.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

function getByID(store, id) {
  return new Promise((res, rej) => { const r = store.get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

// Food Items
const DB = {
  getFoodItems: () => dbOp('foodItems', 'readonly', (s, res) => getAll(s).then(res)),
  getFoodItem: (id) => dbOp('foodItems', 'readonly', (s, res) => getByID(s, id).then(res)),
  addFoodItem: (item) => dbOp('foodItems', 'readwrite', (s, res) => { const r = s.add(item); r.onsuccess = () => res(r.result); }),
  updateFoodItem: (id, data) => dbOp('foodItems', 'readwrite', (s, res) => getByID(s, id).then(existing => { if (existing) { Object.assign(existing, data); s.put(existing); } res(); })),
  deleteFoodItem: (id) => dbOp('foodItems', 'readwrite', (s, res) => { s.delete(id); res(); }),

  getPantryItems: () => dbOp('pantryItems', 'readonly', (s, res) => getAll(s).then(res)),
  addPantryItem: (item) => dbOp('pantryItems', 'readwrite', (s, res) => { const r = s.add(item); r.onsuccess = () => res(r.result); }),
  updatePantryItem: (id, data) => dbOp('pantryItems', 'readwrite', (s, res) => getByID(s, id).then(existing => { if (existing) { Object.assign(existing, data); s.put(existing); } res(); })),
  deletePantryItem: (id) => dbOp('pantryItems', 'readwrite', (s, res) => { s.delete(id); res(); }),

  getMealLogs: () => dbOp('mealLogs', 'readonly', (s, res) => getAll(s).then(res)),
  addMealLog: (log) => dbOp('mealLogs', 'readwrite', (s, res) => { const r = s.add(log); r.onsuccess = () => res(r.result); }),
  updateMealLog: (id, data) => dbOp('mealLogs', 'readwrite', (s, res) => getByID(s, id).then(existing => { if (existing) { Object.assign(existing, data); s.put(existing); } res(); })),
  deleteMealLog: (id) => dbOp('mealLogs', 'readwrite', (s, res) => { s.delete(id); res(); }),

  getRecipes: () => dbOp('recipes', 'readonly', (s, res) => getAll(s).then(res)),
  getRecipe: (id) => dbOp('recipes', 'readonly', (s, res) => getByID(s, id).then(res)),
  addRecipe: (item) => dbOp('recipes', 'readwrite', (s, res) => { const r = s.add(item); r.onsuccess = () => res(r.result); }),
  updateRecipe: (id, data) => dbOp('recipes', 'readwrite', (s, res) => getByID(s, id).then(existing => { if (existing) { Object.assign(existing, data); s.put(existing); } res(); })),
  deleteRecipe: (id) => dbOp('recipes', 'readwrite', (s, res) => { s.delete(id); res(); }),
};
