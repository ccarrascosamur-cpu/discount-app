const API = '/api';

const views = {
  shops: document.getElementById('view-shops'),
  discount: document.getElementById('view-discount'),
  history: document.getElementById('view-history'),
};

function showView(name) {
  Object.values(views).forEach((el) => el.classList.add('hidden'));
  views[name].classList.remove('hidden');
}

document.getElementById('btn-shops').addEventListener('click', () => showView('shops'));
document.getElementById('btn-discount').addEventListener('click', () => { showView('discount'); loadDiscountShops(); });
document.getElementById('btn-history').addEventListener('click', () => { showView('history'); loadHistoryShops(); });

// --- Shops ---
async function loadShops() {
  const res = await fetch(`${API}/shops`);
  const data = await res.json();
  const tbody = document.getElementById('shops-list');
  tbody.innerHTML = '';
  for (const s of data.shops) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.shop_domain}</td>
      <td>${s.created_at}</td>
      <td><button class="btn btn-secondary btn-select-shop" data-shop="${s.shop_domain}">Seleccionar</button></td>
    `;
    tbody.appendChild(tr);
  }
  document.querySelectorAll('.btn-select-shop').forEach((btn) => {
    btn.addEventListener('click', () => {
      showView('discount');
      loadDiscountShops(btn.dataset.shop);
    });
  });
}

document.getElementById('connect-shop').addEventListener('click', () => {
  const shop = document.getElementById('new-shop').value.trim();
  if (!shop) return alert('Ingresa el dominio de la tienda');
  window.location.href = `/auth?shop=${encodeURIComponent(shop)}`;
});

// --- Discount ---
async function loadDiscountShops(preselect) {
  const res = await fetch(`${API}/shops`);
  const data = await res.json();
  const sel = document.getElementById('discount-shop');
  sel.innerHTML = '';
  for (const s of data.shops) {
    const opt = document.createElement('option');
    opt.value = s.shop_domain;
    opt.textContent = s.shop_domain;
    if (preselect && s.shop_domain === preselect) opt.selected = true;
    sel.appendChild(opt);
  }
  loadCollections();
}

document.getElementById('discount-shop').addEventListener('change', loadCollections);

async function loadCollections() {
  const shop = document.getElementById('discount-shop').value;
  const sel = document.getElementById('discount-collections');
  sel.innerHTML = '';
  if (!shop) return;
  const res = await fetch(`${API}/collections?shop=${encodeURIComponent(shop)}`);
  const data = await res.json();
  for (const c of data.collections) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.title;
    sel.appendChild(opt);
  }
}

document.getElementById('all-collections').addEventListener('change', (e) => {
  document.getElementById('discount-collections').disabled = e.target.checked;
});

document.getElementById('apply-discount').addEventListener('click', async () => {
  const shop = document.getElementById('discount-shop').value;
  const percentage = parseFloat(document.getElementById('discount-percent').value);
  const all = document.getElementById('all-collections').checked;
  const exclude = document.getElementById('exclude-discounted').checked;
  const collectionSelect = document.getElementById('discount-collections');
  const collectionIds = all ? ['all'] : Array.from(collectionSelect.selectedOptions).map((o) => o.value);

  if (!shop || !percentage || percentage <= 0 || percentage >= 100) {
    return alert('Ingresa un porcentaje válido entre 1 y 99');
  }
  if (!all && collectionIds.length === 0) {
    return alert('Selecciona al menos una colección o marca "Toda la tienda"');
  }

  const resultEl = document.getElementById('discount-result');
  resultEl.textContent = 'Aplicando descuento, espera...';

  try {
    const res = await fetch(`${API}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop, percentage, collectionIds, excludeAlreadyDiscounted: exclude }),
    });
    const data = await res.json();
    if (!res.ok) {
      resultEl.textContent = `Error: ${data.error || 'Desconocido'}`;
      return;
    }
    resultEl.textContent = `✅ Descuento aplicado.\nOperación #${data.operationId}\nProductos: ${data.totalProducts}\nVariantes: ${data.totalVariants}`;
  } catch (err) {
    resultEl.textContent = `Error de red: ${err.message}`;
  }
});

document.getElementById('preview-discount').addEventListener('click', () => {
  const shop = document.getElementById('discount-shop').value;
  const percentage = document.getElementById('discount-percent').value;
  const all = document.getElementById('all-collections').checked;
  const exclude = document.getElementById('exclude-discounted').checked;
  const sel = document.getElementById('discount-collections');
  const names = all ? ['Toda la tienda'] : Array.from(sel.selectedOptions).map((o) => o.textContent);
  const resultEl = document.getElementById('discount-result');
  resultEl.textContent = `Preview:\nTienda: ${shop}\nColecciones: ${names.join(', ')}\nDescuento: ${percentage}%\nExcluir ya rebajados: ${exclude ? 'Sí' : 'No'}\n\nPresiona "Aplicar descuento" para ejecutar.`;
});

// --- History ---
async function loadHistoryShops(preselect) {
  const res = await fetch(`${API}/shops`);
  const data = await res.json();
  const sel = document.getElementById('history-shop');
  sel.innerHTML = '';
  for (const s of data.shops) {
    const opt = document.createElement('option');
    opt.value = s.shop_domain;
    opt.textContent = s.shop_domain;
    if (preselect && s.shop_domain === preselect) opt.selected = true;
    sel.appendChild(opt);
  }
  loadHistory();
}

document.getElementById('history-shop').addEventListener('change', loadHistory);

async function loadHistory() {
  const shop = document.getElementById('history-shop').value;
  const tbody = document.getElementById('history-list');
  tbody.innerHTML = '';
  if (!shop) return;
  const res = await fetch(`${API}/operations?shop=${encodeURIComponent(shop)}`);
  const data = await res.json();
  for (const op of data.operations) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${op.created_at}</td>
      <td>${op.percentage}%</td>
      <td>${op.total_products}</td>
      <td>${op.total_variants}</td>
      <td><span class="badge badge-${op.status}">${op.status}</span></td>
      <td>${op.status === 'active' ? `<button class="btn btn-danger btn-revert" data-id="${op.id}">Revertir</button>` : ''}</td>
    `;
    tbody.appendChild(tr);
  }
  document.querySelectorAll('.btn-revert').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Revertir este descuento?')) return;
      const res = await fetch(`${API}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Error: ${data.error}`);
        return;
      }
      alert(`Revertido: ${data.revertedProducts} productos, ${data.revertedVariants} variantes`);
      loadHistory();
    });
  });
}

// Init
loadShops();
showView('shops');
