let foodItems = [];
let pantryItems = [];
let mealLogs = [];
let recipes = [];
let scanner = null;
let currentMealEntries = [];
let editMealId = null;
let editFoodId = null;
let editRecipeId = null;
let currentRecipeIngredients = [];

function r(v) { return Math.round(v * 10) / 10; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c] || c); }

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
  recipes = await DB.getRecipes();
}

async function reload() {
  await loadData();
  renderPantry();
  renderMeals();
  renderRecipes();
  renderDashboard();
}

document.querySelectorAll('.bottom-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + tab).classList.add('active');
    document.querySelectorAll('.fab').forEach(f => f.classList.remove('show'));
    if (tab === 'pantry') document.getElementById('fabPantry').classList.add('show');
    if (tab === 'recipes') document.getElementById('fabRecipes').classList.add('show');
    if (tab === 'meals') document.getElementById('fabMeals').classList.add('show');
    if (tab === 'dashboard') renderDashboard();
  });
});

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

function renderDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const todayMeals = mealLogs.filter(m => m.date === today);
  let kcal = 0, protein = 0, carbs = 0, fat = 0, fiber = 0;
  for (const m of todayMeals) {
    for (const e of m.entries) {
      const q = e.quantity || 1;
      kcal += e.kcal * q;
      protein += e.protein * q;
      carbs += e.carbs * q;
      fat += e.fat * q;
      fiber += (e.fiber || 0) * q;
    }
  }

  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayMeals = mealLogs.filter(m => m.date === dateStr);
    let cals = 0;
    for (const m of dayMeals) {
      for (const e of m.entries) cals += e.kcal * (e.quantity || 1);
    }
    days.push({ date: dateStr, calories: cals, dayLabel: d.toLocaleDateString('en', { weekday: 'short' }) });
  }

  const maxCals = Math.max(...days.map(d => d.calories), 1);
  const todayDay = now.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });

  let chartHtml = '';
  for (const d of days) {
    const pct = Math.max((d.calories / maxCals) * 100, 4);
    chartHtml += `<div class="chart-bar">
      <div class="bar ${d.date === today ? 'today' : ''}" style="height:${pct}%"></div>
      <span class="val">${d.calories ? r(d.calories) : '-'}</span>
      <span class="label">${d.dayLabel}</span>
    </div>`;
  }

  document.getElementById('view-dashboard').innerHTML = `
    <div class="dashboard-date">${todayDay}</div>
    <div class="macro-grid">
      <div class="macro-card"><div class="value">${r(kcal)}</div><div class="label">Calories</div></div>
      <div class="macro-card"><div class="value">${r(protein)}g</div><div class="label">Protein</div></div>
      <div class="macro-card"><div class="value">${r(carbs)}g</div><div class="label">Carbs</div></div>
      <div class="macro-card"><div class="value">${r(fat)}g</div><div class="label">Fat</div></div>
      <div class="macro-card"><div class="value">${r(fiber)}g</div><div class="label">Fiber</div></div>
    </div>
    <div class="chart-title">Last 7 Days</div>
    <div class="chart">${chartHtml}</div>
    ${todayMeals.length === 0 ? '<div class="empty-state" style="margin-top:20px"><p>No meals logged today.</p></div>' : ''}
  `;
}

function renderPantry() {
  const q = (document.getElementById('pantrySearch').value || '').toLowerCase();
  const list = document.getElementById('pantryList');
  const filtered = pantryItems.filter(p => {
    const f = getFood(p.foodId);
    return f && (!q || f.name.toLowerCase().includes(q) || f.brand.toLowerCase().includes(q));
  });
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Your pantry is empty. Tap + to add items.</p></div>';
    return;
  }
  let html = '';
  for (const p of filtered) {
    const f = getFood(p.foodId);
    if (!f) continue;
    html += `<div class="card">
      <div class="card-header">
        <div>
          <div class="card-title" onclick="openFoodModal(${f.id})">${esc(f.name)}</div>
          <div class="card-sub">${esc(f.brand)}</div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-icon" onclick="adjustPantry(${p.id}, -0.5)" ${p.quantity <= 0 ? 'disabled' : ''}>&minus;</button>
          <span style="font-weight:500;min-width:28px;text-align:center;font-size:14px">${p.quantity}</span>
          <button class="btn btn-sm btn-icon" onclick="adjustPantry(${p.id}, 0.5)">+</button>
          <button class="btn btn-sm btn-icon btn-danger-icon" onclick="deleteAndReloadPantry(${p.id})" title="Remove">&times;</button>
        </div>
      </div>
      <div class="card-footer">
        <span>${f.kcal} kcal</span>
        <span>P: ${f.protein}g</span>
        <span>C: ${f.carbs}g</span>
        <span>F: ${f.fat}g</span>
        ${f.fiber ? `<span>Fib: ${f.fiber}g</span>` : ''}
        <span style="font-size:10px;color:#8e8982;margin-left:auto">${f.servingQty}${f.servingUnit}</span>
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

async function deleteAndReloadPantry(id) {
  await DB.deletePantryItem(id);
  await reload();
}

function openFoodModal(id) {
  editFoodId = id || null;
  document.getElementById('foodModalTitle').textContent = id ? 'Edit Food' : 'Add Food';
  document.getElementById('deleteFoodBtn').style.display = id ? 'inline-flex' : 'none';
  stopFoodScan();
  if (id) {
    const f = foodItems.find(x => x.id === id);
    if (!f) return;
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
  } else {
    ['fName','fBrand','fKcal','fProtein','fCarbs','fFat','fFiber','fBarcode'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('fServingQty').value = '100';
    document.getElementById('fServingUnit').value = 'g';
  }
  document.getElementById('foodModal').classList.add('open');
}

function closeFoodModal() {
  stopFoodScan();
  document.getElementById('foodModal').classList.remove('open');
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
  closeFoodModal();
  await reload();
}

async function deleteFoodItem(id) {
  if (!confirm('Delete this food item from the database?')) return;
  const pantryRefs = pantryItems.filter(p => p.foodId === id);
  for (const p of pantryRefs) await DB.deletePantryItem(p.id);
  await DB.deleteFoodItem(id);
  closeFoodModal();
  await reload();
}

function showFoodBarcodeForm() {
  if (typeof Html5Qrcode === 'undefined') {
    alert('Barcode scanner library not loaded. Try typing the barcode manually.');
    document.getElementById('fBarcode').focus();
    return;
  }
  document.getElementById('foodScanner').innerHTML = '<div id="foodReader"></div>';
  document.getElementById('foodScanner').style.display = 'block';
  document.getElementById('foodScanControls').style.display = 'block';
  try {
    scanner = new Html5Qrcode('foodReader');
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 150 } },
      onFoodScanSuccess,
      () => {}
    );
  } catch (e) {
    alert('Camera access failed: ' + (e.message || e));
    document.getElementById('foodScanner').style.display = 'none';
    document.getElementById('foodScanControls').style.display = 'none';
  }
}

function stopFoodScan() {
  if (scanner) { try { scanner.stop(); } catch (e) {} scanner = null; }
  document.getElementById('foodScanner').style.display = 'none';
  document.getElementById('foodScanControls').style.display = 'none';
}

async function onFoodScanSuccess(code) {
  stopFoodScan();
  await lookupFoodBarcode(code);
}

async function lookupFoodBarcode(code) {
  document.getElementById('foodScanner').style.display = 'block';
  document.getElementById('foodScanner').innerHTML = '<div class="empty-state" style="padding:20px"><p>Looking up barcode...</p></div>';
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
    const data = await res.json();
    document.getElementById('foodScanner').style.display = 'none';
    if (data.status !== 1) {
      alert('Product not found.');
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
  } catch (e) {
    document.getElementById('foodScanner').style.display = 'none';
    alert('Lookup failed: ' + e.message);
    document.getElementById('fBarcode').value = code;
  }
}

function renderRecipes() {
  const list = document.getElementById('recipesList');
  if (recipes.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No recipes yet. Tap + to create one.</p></div>';
    return;
  }
  let html = '';
  for (const rec of recipes) {
    let items = [];
    let kcal = 0, protein = 0, carbs = 0, fat = 0;
    for (const ing of rec.ingredients) {
      const f = foodItems.find(x => x.id === ing.foodId);
      if (f) {
        items.push(f.name);
        kcal += (f.kcal || 0) * ing.quantity;
        protein += (f.protein || 0) * ing.quantity;
        carbs += (f.carbs || 0) * ing.quantity;
        fat += (f.fat || 0) * ing.quantity;
      }
    }
    html += `<div class="card">
      <div class="card-header">
        <div>
          <div class="card-title" onclick="openRecipeModal(${rec.id})">${esc(rec.name)}</div>
          <div class="card-sub">${items.join(', ')}</div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm" onclick="event.stopPropagation();logRecipeAsMeal(${rec.id})">Log</button>
          <button class="btn btn-sm btn-icon btn-danger-icon" onclick="event.stopPropagation();deleteRecipe(${rec.id})">&times;</button>
        </div>
      </div>
      <div class="card-footer">
        <span>${r(kcal)} kcal</span>
        <span>P: ${r(protein)}g</span>
        <span>C: ${r(carbs)}g</span>
        <span>F: ${r(fat)}g</span>
      </div>
    </div>`;
  }
  list.innerHTML = html;
}

function openRecipeModal(id) {
  editRecipeId = id || null;
  document.getElementById('recipeModalTitle').textContent = id ? 'Edit Recipe' : 'New Recipe';
  document.getElementById('deleteRecipeBtn').style.display = id ? 'inline-flex' : 'none';
  document.getElementById('recipeName').value = id ? (recipes.find(r => r.id === id)?.name || '') : '';
  currentRecipeIngredients = id ? JSON.parse(JSON.stringify(recipes.find(r => r.id === id)?.ingredients || [])) : [];
  renderRecipeIngredients();
  updateRecipeTotals();
  document.getElementById('recipeModal').classList.add('open');
}

function closeRecipeModal() {
  document.getElementById('recipeModal').classList.remove('open');
  currentRecipeIngredients = [];
}

function renderRecipeIngredients() {
  const container = document.getElementById('recipeIngredients');
  let html = '';
  for (let i = 0; i < currentRecipeIngredients.length; i++) {
    const ing = currentRecipeIngredients[i];
    html += `<div class="meal-entry">
      <div class="row">
        <select onchange="updateRecipeIngredient(${i}, 'foodId', Number(this.value))">
          <option value="">Select item...</option>
          ${foodItems.map(f => `<option value="${f.id}" ${ing.foodId === f.id ? 'selected' : ''}>${esc(f.name)} (${esc(f.brand)})</option>`).join('')}
        </select>
        <input class="qty-input" type="number" step="any" min="0" value="${ing.quantity || 1}" onchange="updateRecipeIngredient(${i}, 'quantity', parseFloat(this.value) || 0)">
        <button class="btn btn-sm btn-icon btn-danger-icon" onclick="removeRecipeIngredient(${i})">&times;</button>
      </div>
    </div>`;
  }
  container.innerHTML = html || '<div style="color:#8e8982;font-size:13px;padding:8px">Add ingredients to your recipe.</div>';
}

function addRecipeIngredient() {
  currentRecipeIngredients.push({ foodId: '', quantity: 1 });
  renderRecipeIngredients();
}

function removeRecipeIngredient(idx) {
  currentRecipeIngredients.splice(idx, 1);
  renderRecipeIngredients();
  updateRecipeTotals();
}

function updateRecipeIngredient(idx, field, val) {
  if (field === 'foodId') currentRecipeIngredients[idx].foodId = val;
  else if (field === 'quantity') currentRecipeIngredients[idx].quantity = val;
  updateRecipeTotals();
}

function updateRecipeTotals() {
  let kcal = 0, protein = 0, carbs = 0, fat = 0, fiber = 0;
  for (const ing of currentRecipeIngredients) {
    const f = foodItems.find(x => x.id === ing.foodId);
    if (!f || !ing.quantity) continue;
    const q = ing.quantity;
    kcal += (f.kcal || 0) * q;
    protein += (f.protein || 0) * q;
    carbs += (f.carbs || 0) * q;
    fat += (f.fat || 0) * q;
    fiber += (f.fiber || 0) * q;
  }
  document.getElementById('rKcal').textContent = r(kcal);
  document.getElementById('rProtein').textContent = r(protein) + 'g';
  document.getElementById('rCarbs').textContent = r(carbs) + 'g';
  document.getElementById('rFat').textContent = r(fat) + 'g';
  document.getElementById('rFiber').textContent = r(fiber) + 'g';
}

async function saveRecipe() {
  const name = document.getElementById('recipeName').value.trim();
  if (!name) { alert('Recipe name is required.'); return; }
  const ingredients = currentRecipeIngredients.filter(ing => ing.foodId && ing.quantity > 0);
  if (ingredients.length === 0) { alert('Add at least one ingredient.'); return; }
  const data = { name, ingredients, createdAt: new Date().toISOString() };
  if (editRecipeId) {
    await DB.updateRecipe(editRecipeId, data);
  } else {
    await DB.addRecipe(data);
  }
  closeRecipeModal();
  await reload();
}

async function deleteRecipe(id) {
  if (!id) id = editRecipeId;
  if (!confirm('Delete this recipe?')) return;
  await DB.deleteRecipe(id);
  closeRecipeModal();
  await reload();
}

function logRecipeAsMeal(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;
  openLogMeal();
  currentMealEntries = JSON.parse(JSON.stringify(recipe.ingredients));
  renderMealForm();
  updateMealTotals();
  document.getElementById('mealRecipeSelect').value = id;
}

function renderMeals() {
  const list = document.getElementById('mealsList');
  if (mealLogs.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No meals logged yet. Tap + to log one.</p></div>';
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
      itemsHtml += `<div style="font-size:12px;color:#8e8982;padding:1px 0">${q} &times; ${esc(e.foodName)}${e.brand ? ' (' + esc(e.brand) + ')' : ''}</div>`;
      sumK += e.kcal * q;
      sumP += e.protein * q;
      sumC += e.carbs * q;
      sumF += e.fat * q;
      sumFib += (e.fiber || 0) * q;
    }
    html += `<div class="card" onclick="editMeal(${log.id})" style="cursor:pointer">
      <div class="card-header">
        <div class="card-title" style="text-transform:capitalize;cursor:pointer">${log.mealType}</div>
        <div style="font-size:14px;font-weight:500">${r(sumK)} kcal</div>
      </div>
      ${itemsHtml}
      <div class="card-footer">
        <span>P: ${r(sumP)}g</span>
        <span>C: ${r(sumC)}g</span>
        <span>F: ${r(sumF)}g</span>
        <span>Fib: ${r(sumFib)}g</span>
      </div>
    </div>`;
  }
  if (currentDate) html += '</div>';
  list.innerHTML = html;
}

function openLogMeal() {
  editMealId = null;
  currentMealEntries = [];
  document.getElementById('mealModalTitle').textContent = 'Log a Meal';
  document.getElementById('deleteMealBtn').style.display = 'none';
  document.getElementById('mealDate').value = new Date().toISOString().slice(0, 10);
  const recipeSelect = document.getElementById('mealRecipeSelect');
  recipeSelect.innerHTML = '<option value="">None</option>' +
    recipes.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  recipeSelect.value = '';
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
        <select onchange="updateMealEntry(${i}, 'foodId', Number(this.value))">
          <option value="">Select item...</option>
          ${foodItems.map(f => `<option value="${f.id}" ${e.foodId === f.id ? 'selected' : ''}>${esc(f.name)} (${esc(f.brand)})</option>`).join('')}
        </select>
        <input class="qty-input" type="number" step="any" min="0" value="${e.quantity || 1}" onchange="updateMealEntry(${i}, 'quantity', parseFloat(this.value) || 0)">
        <button class="btn btn-sm btn-icon btn-danger-icon" onclick="removeMealEntry(${i})">&times;</button>
      </div>
    </div>`;
  }
  container.innerHTML = html || '<div style="color:#8e8982;font-size:13px;padding:8px">Add items to your meal.</div>';
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
  if (field === 'foodId') currentMealEntries[idx].foodId = val;
  else if (field === 'quantity') currentMealEntries[idx].quantity = val;
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
  document.querySelector('.bottom-nav button[data-tab="meals"]')?.click();
}

function editMeal(id) {
  const log = mealLogs.find(l => l.id === id);
  if (!log) return;
  editMealId = id;
  document.getElementById('mealModalTitle').textContent = 'Edit Meal';
  document.getElementById('deleteMealBtn').style.display = 'inline-flex';
  document.getElementById('mealDate').value = log.date;
  document.getElementById('mealType').value = log.mealType;
  currentMealEntries = log.entries.map(e => ({ foodId: e.foodId, quantity: e.quantity }));
  const recipeSelect = document.getElementById('mealRecipeSelect');
  recipeSelect.innerHTML = '<option value="">None</option>' +
    recipes.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  recipeSelect.value = '';
  document.getElementById('mealModal').classList.add('open');
  renderMealForm();
  updateMealTotals();
}

async function deleteMeal(id) {
  if (!confirm('Delete this meal?')) return;
  await DB.deleteMealLog(id);
  closeMealModal();
  await reload();
  document.querySelector('.bottom-nav button[data-tab="meals"]')?.click();
}

function loadRecipeIntoMeal(recipeId) {
  if (!recipeId) return;
  const recipe = recipes.find(r => r.id === Number(recipeId));
  if (!recipe) return;
  currentMealEntries = JSON.parse(JSON.stringify(recipe.ingredients));
  renderMealForm();
  updateMealTotals();
}

function toggleMenu() {
  document.getElementById('menuDropdown').classList.toggle('open');
}

async function exportData() {
  document.getElementById('menuDropdown').classList.remove('open');
  const data = { foodItems, pantryItems, mealLogs, recipes };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daily-shelf-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.header')) {
    document.getElementById('menuDropdown')?.classList.remove('open');
  }
});

(async function init() {
  await seed();
  await reload();
  renderDashboard();
  document.getElementById('mealDate').value = new Date().toISOString().slice(0, 10);
  document.querySelector('.bottom-nav button[data-tab="dashboard"]')?.click();
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); } catch (e) {}
  }
})();
