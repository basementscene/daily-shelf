// State
let foodItems = [];
let pantryItems = [];
let mealLogs = [];
let scanner = null;
let currentMealEntries = [];
let editMealId = null;
let editFoodId = null;

function r(v) { return Math.round(v * 10) / 10; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c] || c); }

// Seed data
const SEED = [
  { name: 'Egg (raw)', brand: 'generic', servingQty: 50, servingUnit: 'g', kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fiber: 0, barcode: '' },
  { name: 'Egg (boiled)', brand: 'generic', servingQty: 50, servingUnit: 'g', kcal: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0, barcode: '' },
];

function getFood(id) { return foodItems.find(f => f.id === id); }
function getPantry(id) { return pantryItems.find(p => p.id === id); }

async function seed() {
  const items = await DB.getFoodItems();
  if (items.length === 0) {
    for (const item of SEED) {
      const id = await DB.addFoodItem(item);
      await DB.addPantryItem({ foodId: id, quantity: 4, dateAdded: new Date().toISOString().slice(0, 10) });
    }
  }
}

async function loadData() {
  foodItems = await DB.getFoodItems();
  pantryItems = await DB.getPantryItems();
  mealLogs = await DB.getMealLogs();
  mealLogs.sort((a, b) => b.date.localeCompare(a.date) || a.mealType.localeCompare(b.mealType));
}

async function reload() {
  await loadData();
  renderPantry();
  renderMeals();
}

// ===== TABS =====
document.querySelectorAll('.tab-bar button').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab !== 'add') stopScan();
    document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    const view = document.getElementById('view-' + btn.dataset.tab);
    if (view) view.classList.add('active');
  });
});

// ===== PULL TO REFRESH =====
(function initPullToRefresh() {
  const main = document.getElementById('main');
  const wrap = document.getElementById('mainWrap');
  const indicator = document.getElementById('refreshIndicator');
  let startY = 0, pulling = false, pullDist = 0, refreshing = false;
  main.addEventListener('touchstart', e => {
    if (main.scrollTop === 0 && !refreshing) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });
  main.addEventListener('touchmove', e => {
    if (!pulling || refreshing) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0 && main.scrollTop === 0) {
      pullDist = Math.min(dy * 0.4, 100);
      indicator.style.transform = `translateY(${pullDist}px)`;
      indicator.style.opacity = Math.min(pullDist / 50, 1);
    }
  }, { passive: true });
  main.addEventListener('touchend', async () => {
    if (!pulling || refreshing) return;
    pulling = false;
    if (pullDist > 50) {
      refreshing = true;
      indicator.textContent = 'Refreshing...';
      indicator.style.transform = 'translateY(50px)';
      indicator.style.opacity = '1';
      await reload();
      refreshing = false;
    }
    indicator.textContent = 'Pull to refresh';
    indicator.style.transform = '';
    indicator.style.opacity = '';
    pullDist = 0;
  }, { passive: true });
})();

// ===== PANTRY =====
function renderPantry() {
  const q = (document.getElementById('pantrySearch').value || '').toLowerCase();
  const list = document.getElementById('pantryList');
  const filtered = pantryItems.filter(p => {
    const f = getFood(p.foodId);
    return f && (!q || f.name.toLowerCase().includes(q) || f.brand.toLowerCase().includes(q));
  });
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>Your pantry is empty. Add items to get started.</p></div>';
    return;
  }
  let html = '';
  for (const p of filtered) {
    const f = getFood(p.foodId);
    if (!f) continue;
    html += `<div class="card">
      <div class="card-header">
        <div>
          <div class="card-title" onclick="editFoodItem(${f.id})">${esc(f.name)}</div>
          <div class="card-sub">${esc(f.brand)}</div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-icon" onclick="adjustPantry(${p.id}, -0.5)" ${p.quantity <= 0 ? 'disabled' : ''}>&minus;</button>
          <span style="font-weight:600;min-width:28px;text-align:center;font-size:15px">${p.quantity}</span>
          <button class="btn btn-sm btn-icon" onclick="adjustPantry(${p.id}, 0.5)">+</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteAndReloadPantry(${p.id})" title="Remove from pantry">&times;</button>
        </div>
      </div>
      <div class="card-footer">
        <span>${f.kcal} kcal</span>
        <span>P: ${f.protein}g</span>
        <span>C: ${f.carbs}g</span>
        <span>F: ${f.fat}g</span>
        ${f.fiber ? `<span>Fiber: ${f.fiber}g</span>` : ''}
        <span style="font-size:11px;color:#9ca3af;margin-left:auto">${f.servingQty}${f.servingUnit} / serving</span>
      </div>
    </div>`;
  }
  list.innerHTML = html;
}

async function adjustPantry(id, delta) {
  const p = getPantry(id);
  if (!p) return;
  const q = Math.max(0, r(p.quantity + delta));
  if (q <= 0) { await DB.deletePantryItem(id); }
  else { await DB.updatePantryItem(id, { quantity: q }); }
  await reload();
}

async function deletePantryItem(id) {
  await DB.deletePantryItem(id);
}
async function deleteAndReloadPantry(id) {
  await DB.deletePantryItem(id);
  await reload();
}

// ===== MEALS =====
function renderMeals() {
  const list = document.getElementById('mealsList');
  if (mealLogs.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="icon">🍽</div><p>No meals logged yet.</p></div>';
    return;
  }
  let html = '';
  let currentDate = '';
  for (let i = 0; i < mealLogs.length; i++) {
    const log = mealLogs[i];
    if (log.date !== currentDate) {
      if (currentDate) html += '</div>';
      currentDate = log.date;
      html += `<div class="date-group"><div class="date-label">${currentDate}</div>`;
    }
    let itemsHtml = '';
    let sumK = 0, sumP = 0, sumC = 0, sumF = 0, sumFib = 0;
    for (const e of log.entries) {
      const q = e.quantity || 1;
      itemsHtml += `<div style="font-size:13px;color:#6b7280;padding:1px 0">${q} &times; ${esc(e.foodName)}${e.brand ? ' (' + esc(e.brand) + ')' : ''}</div>`;
      sumK += e.kcal * q;
      sumP += e.protein * q;
      sumC += e.carbs * q;
      sumF += e.fat * q;
      sumFib += (e.fiber || 0) * q;
    }
    html += `<div class="card" onclick="editMeal(${log.id})" style="cursor:pointer">
      <div class="card-header">
        <div class="card-title" style="text-transform:capitalize;cursor:pointer">${log.mealType}</div>
        <div style="font-size:14px;font-weight:600">${r(sumK)} kcal</div>
      </div>
      ${itemsHtml}
      <div class="card-footer">
        <span>P: ${r(sumP)}g</span>
        <span>C: ${r(sumC)}g</span>
        <span>F: ${r(sumF)}g</span>
        <span>Fiber: ${r(sumFib)}g</span>
      </div>
    </div>`;
  }
  if (currentDate) html += '</div>';
  list.innerHTML = html;
}

// ===== MANUAL ADD FOOD =====
function showManualForm(resetEdit) {
  if (resetEdit !== false) editFoodId = null;
  document.getElementById('manualBarcode').style.display = 'none';
  document.getElementById('manualForm').style.display = 'block';
  document.getElementById('scanner').style.display = 'none';
  document.getElementById('scanControls').style.display = 'none';
}

async function saveFoodItem() {
  const name = document.getElementById('fName').value.trim();
  if (!name) { alert('Food name is required.'); return; }
  const item = {
    name,
    brand: document.getElementById('fBrand').value.trim() || 'generic',
    servingQty: parseFloat(document.getElementById('fServingQty').value) || 100,
    servingUnit: document.getElementById('fServingUnit').value.trim() || 'g',
    kcal: parseFloat(document.getElementById('fKcal').value) || 0,
    protein: parseFloat(document.getElementById('fProtein').value) || 0,
    carbs: parseFloat(document.getElementById('fCarbs').value) || 0,
    fat: parseFloat(document.getElementById('fFat').value) || 0,
    fiber: parseFloat(document.getElementById('fFiber').value) || 0,
    barcode: document.getElementById('fBarcode').value.trim() || '',
  };
  if (editFoodId) {
    await DB.updateFoodItem(editFoodId, item);
  } else {
    const id = await DB.addFoodItem(item);
    await DB.addPantryItem({ foodId: id, quantity: 1, dateAdded: new Date().toISOString().slice(0, 10) });
  }
  clearAddForm();
  await reload();
  document.querySelectorAll('.tab-bar button')[0].click();
}

function clearAddForm() {
  ['fName', 'fBrand', 'fKcal', 'fProtein', 'fCarbs', 'fFat', 'fFiber', 'fBarcode'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('fServingQty').value = '100';
  document.getElementById('fServingUnit').value = 'g';
  document.getElementById('manualBarcode').style.display = 'none';
  document.getElementById('manualBarcodeInput').value = '';
  document.getElementById('manualForm').style.display = 'none';
  document.getElementById('formTitle').textContent = 'Add Food';
  editFoodId = null;
}

// ===== EDIT FOOD ITEM =====
async function editFoodItem(id) {
  const f = foodItems.find(x => x.id === id);
  if (!f) return;
  editFoodId = id;
  document.getElementById('formTitle').textContent = 'Edit Food';
  document.getElementById('fName').value = f.name;
  document.getElementById('fBrand').value = f.brand;
  document.getElementById('fServingQty').value = f.servingQty;
  document.getElementById('fServingUnit').value = f.servingUnit;
  document.getElementById('fKcal').value = f.kcal;
  document.getElementById('fProtein').value = f.protein;
  document.getElementById('fCarbs').value = f.carbs;
  document.getElementById('fFat').value = f.fat;
  document.getElementById('fFiber').value = f.fiber;
  document.getElementById('fBarcode').value = f.barcode || '';
  showManualForm(false);
  document.querySelectorAll('.tab-bar button')[2].click();
}

// ===== BARCODE SCAN =====
function showManualBarcode() {
  document.getElementById('manualBarcode').style.display = 'block';
  document.getElementById('manualForm').style.display = 'none';
  document.getElementById('scanner').style.display = 'none';
  document.getElementById('scanControls').style.display = 'none';
  editFoodId = null;
  document.getElementById('formTitle').textContent = 'Add Food';
}

async function lookupManualBarcode() {
  const code = document.getElementById('manualBarcodeInput').value.trim();
  if (!code) { alert('Enter a barcode number.'); return; }
  document.getElementById('manualBarcode').style.display = 'none';
  await lookupBarcode(code);
  document.getElementById('manualBarcodeInput').value = '';
}

async function startScan() {
  document.getElementById('manualBarcode').style.display = 'none';
  document.getElementById('manualForm').style.display = 'none';
  if (typeof Html5Qrcode === 'undefined') {
    alert('Barcode scanner library not loaded. Try refreshing, or type the barcode manually.');
    showManualBarcode();
    return;
  }
  document.getElementById('scanner').style.display = 'block';
  document.getElementById('scanControls').style.display = 'block';
  document.getElementById('scanner').innerHTML = '<div id="reader"></div>';
  editFoodId = null;
  document.getElementById('formTitle').textContent = 'Add Food';
  try {
    scanner = new Html5Qrcode('reader');
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      onScanSuccess,
      () => {}
    );
  } catch (e) {
    alert('Camera access failed: ' + (e.message || e || 'unknown error') + '\n\nTip: Chrome requires HTTPS for camera access. Try typing the barcode instead, or deploy to Netlify for free HTTPS.');
    stopScan();
    showManualBarcode();
  }
}

async function onScanSuccess(code) {
  if (scanner) { await scanner.stop(); scanner = null; }
  document.getElementById('scanner').style.display = 'none';
  document.getElementById('scanControls').style.display = 'none';
  await lookupBarcode(code);
}

async function lookupBarcode(code) {
  document.getElementById('scanner').innerHTML = '<div class="empty-state"><div class="icon">🔍</div><p>Looking up barcode...</p></div>';
  document.getElementById('scanner').style.display = 'block';
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
    const data = await res.json();
    document.getElementById('scanner').style.display = 'none';
    if (data.status !== 1) {
      alert('Product not found. Enter the details manually.');
      showManualForm();
      document.getElementById('fBarcode').value = code;
      return;
    }
    const p = data.product;
    const n = p.nutriments || {};
    const serving = parseFloat(p.serving_quantity) || 100;
    const unit = p.serving_quantity ? (p.serving_size || 'g') : 'g';
    const v = (k) => n[k + '_serving'] ?? (n[k + '_100g'] ? n[k + '_100g'] * serving / 100 : 0);
    document.getElementById('fName').value = p.product_name || '';
    document.getElementById('fBrand').value = p.brands || '';
    document.getElementById('fServingQty').value = serving;
    document.getElementById('fServingUnit').value = unit;
    document.getElementById('fKcal').value = r(v('energy-kcal') || v('energy') * 0.239 || 0);
    document.getElementById('fProtein').value = r(v('proteins') || 0);
    document.getElementById('fCarbs').value = r(v('carbohydrates') || 0);
    document.getElementById('fFat').value = r(v('fat') || 0);
    document.getElementById('fFiber').value = r(v('fiber') || 0);
    document.getElementById('fBarcode').value = code;
    showManualForm();
  } catch (e) {
    document.getElementById('scanner').style.display = 'none';
    alert('Lookup failed: ' + e.message + '. Enter the details manually.');
    showManualForm();
    document.getElementById('fBarcode').value = code;
  }
}

function stopScan() {
  if (scanner) { try { scanner.stop(); } catch (e) {} scanner = null; }
  document.getElementById('scanner').style.display = 'none';
  document.getElementById('scanControls').style.display = 'none';
  document.getElementById('manualBarcode').style.display = 'none';
}

// ===== LOG MEAL =====
function openLogMeal() {
  editMealId = null;
  currentMealEntries = [];
  document.getElementById('mealModalTitle').textContent = 'Log a Meal';
  document.getElementById('deleteMealBtn').style.display = 'none';
  document.getElementById('mealDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('mealModal').classList.add('open');
  renderMealForm();
  updateMealTotals();
}

function closeMealModal() {
  document.getElementById('mealModal').classList.remove('open');
}

function renderMealForm() {
  const container = document.getElementById('mealItems');
  let html = '';
  for (let i = 0; i < currentMealEntries.length; i++) {
    const e = currentMealEntries[i];
    html += `<div class="meal-entry">
      <div class="row">
        <select onchange="updateMealEntry(${i}, 'foodId', this.value)">
          <option value="">Select item...</option>
          ${foodItems.map(f => `<option value="${f.id}" ${e.foodId === f.id ? 'selected' : ''}>${esc(f.name)} (${esc(f.brand)})</option>`).join('')}
        </select>
        <input class="qty-input" type="number" step="any" min="0" value="${e.quantity || 1}" onchange="updateMealEntry(${i}, 'quantity', this.value)">
        <button class="btn btn-sm btn-danger btn-icon" onclick="removeMealEntry(${i})">&times;</button>
      </div>
    </div>`;
  }
  container.innerHTML = html || '<div style="color:#9ca3af;font-size:13px;padding:8px">Add items to your meal.</div>';
}

function addMealEntry() {
  currentMealEntries.push({ foodId: '', quantity: 1 });
  renderMealForm();
}

function removeMealEntry(idx) {
  currentMealEntries.splice(idx, 1);
  renderMealForm();
  updateMealTotals();
}

function updateMealEntry(idx, field, val) {
  if (field === 'foodId') currentMealEntries[idx].foodId = Number(val);
  else if (field === 'quantity') currentMealEntries[idx].quantity = parseFloat(val) || 0;
  updateMealTotals();
}

function updateMealTotals() {
  let k = 0, p = 0, c = 0, f = 0, fib = 0;
  for (const e of currentMealEntries) {
    const food = foodItems.find(x => x.id === e.foodId);
    if (!food || !e.quantity) continue;
    const q = e.quantity;
    k += food.kcal * q;
    p += food.protein * q;
    c += food.carbs * q;
    f += food.fat * q;
    fib += (food.fiber || 0) * q;
  }
  document.getElementById('tKcal').textContent = r(k);
  document.getElementById('tProtein').textContent = r(p) + 'g';
  document.getElementById('tCarbs').textContent = r(c) + 'g';
  document.getElementById('tFat').textContent = r(f) + 'g';
  document.getElementById('tFiber').textContent = r(fib) + 'g';
}

async function saveMeal() {
  const date = document.getElementById('mealDate').value;
  const mealType = document.getElementById('mealType').value;
  const entries = currentMealEntries.filter(e => e.foodId && e.quantity > 0);
  if (entries.length === 0) { alert('Add at least one item.'); return; }
  const log = { date, mealType, entries: [] };
  for (const e of entries) {
    const food = foodItems.find(x => x.id === e.foodId);
    if (!food) continue;
    log.entries.push({
      foodId: food.id, foodName: food.name, brand: food.brand,
      quantity: e.quantity, kcal: food.kcal, protein: food.protein,
      carbs: food.carbs, fat: food.fat, fiber: food.fiber || 0,
    });
    if (editMealId === null) {
      const pantry = pantryItems.find(p => p.foodId === food.id);
      if (pantry) {
        const newQ = r(pantry.quantity - e.quantity);
        if (newQ <= 0) await DB.deletePantryItem(pantry.id);
        else await DB.updatePantryItem(pantry.id, { quantity: newQ });
      }
    }
  }
  if (editMealId !== null) {
    await DB.updateMealLog(editMealId, log);
  } else {
    await DB.addMealLog(log);
  }
  closeMealModal();
  await reload();
  document.querySelectorAll('.tab-bar button')[1].click();
}

// ===== EDIT MEAL =====
async function editMeal(id) {
  const log = mealLogs.find(l => l.id === id);
  if (!log) return;
  editMealId = id;
  document.getElementById('mealModalTitle').textContent = 'Edit Meal';
  document.getElementById('deleteMealBtn').style.display = 'inline-flex';
  document.getElementById('mealDate').value = log.date;
  document.getElementById('mealType').value = log.mealType;
  currentMealEntries = log.entries.map(e => ({ foodId: e.foodId, quantity: e.quantity }));
  document.getElementById('mealModal').classList.add('open');
  renderMealForm();
  updateMealTotals();
}

async function deleteMeal(id) {
  if (!confirm('Delete this meal?')) return;
  await DB.deleteMealLog(id);
  closeMealModal();
  await reload();
}

// ===== EXPORT =====
async function exportData() {
  const data = { foodItems, pantryItems, mealLogs };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foodtracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== INIT =====
(async function init() {
  await seed();
  await reload();
  document.getElementById('mealDate').value = new Date().toISOString().slice(0, 10);
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch (e) {}
  }
})();
