// StockPilot Application Controller: Authentication, Onboarding & Inventory Management
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'stockpilot_auth_session';

  // System & Header elements
  const frontendStatusEl = document.getElementById('frontend-status');
  const apiStatusEl = document.getElementById('api-status');
  const authStatusBadge = document.getElementById('auth-status-badge');
  const headerUserStatus = document.getElementById('header-user-status');
  const headerUserEmail = document.getElementById('header-user-email');
  const btnHeaderLogout = document.getElementById('btn-header-logout');
  const globalAlertEl = document.getElementById('global-alert');

  // View sections
  const authSection = document.getElementById('auth-section');
  const onboardingSection = document.getElementById('onboarding-section');
  const workspaceSection = document.getElementById('workspace-section');

  // Auth elements
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginPanel = document.getElementById('login-panel');
  const registerPanel = document.getElementById('register-panel');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const registerSubmitBtn = document.getElementById('register-submit-btn');

  // Onboarding elements
  const onboardingForm = document.getElementById('onboarding-form');
  const onboardingSubmitBtn = document.getElementById('onboarding-submit-btn');
  const bizIndustrySelect = document.getElementById('biz-industry');
  const bizIndustryCustomGroup = document.getElementById('biz-industry-custom-group');
  const bizIndustryCustomInput = document.getElementById('biz-industry-custom');

  // Workspace Context elements
  const workspaceName = document.getElementById('workspace-name');
  const workspaceRoleBadge = document.getElementById('workspace-role-badge');
  const workspaceIndustry = document.getElementById('workspace-industry');
  const workspaceLocation = document.getElementById('workspace-location');
  const workspaceCurrency = document.getElementById('workspace-currency');
  const workspaceId = document.getElementById('workspace-id');
  const businessSwitcherWrapper = document.getElementById('business-switcher-wrapper');
  const businessSwitcherSelect = document.getElementById('business-switcher-select');

  // Inventory Summary Metric elements
  const statTotalProducts = document.getElementById('stat-total-products');
  const statTotalUnits = document.getElementById('stat-total-units');
  const statLowStock = document.getElementById('stat-low-stock');
  const statTotalValuation = document.getElementById('stat-total-valuation');

  // Inventory Toolbar elements
  const btnOpenAddProduct = document.getElementById('btn-open-add-product');
  const btnEmptyAddProduct = document.getElementById('btn-empty-add-product');
  const inventorySearch = document.getElementById('inventory-search');
  const filterCategory = document.getElementById('filter-category');
  const filterStockStatus = document.getElementById('filter-stock-status');
  const sortProducts = document.getElementById('sort-products');
  const productsTbody = document.getElementById('products-tbody');
  const inventoryEmptyState = document.getElementById('inventory-empty-state');

  // Product Modal elements
  const productModal = document.getElementById('product-modal');
  const modalProductTitle = document.getElementById('modal-product-title');
  const btnCloseProductModal = document.getElementById('btn-close-product-modal');
  const btnCancelProduct = document.getElementById('btn-cancel-product');
  const productForm = document.getElementById('product-form');
  const btnSaveProduct = document.getElementById('btn-save-product');
  const productModalAlert = document.getElementById('product-modal-alert');
  const prodIdInput = document.getElementById('prod-id');
  const prodNameInput = document.getElementById('prod-name');
  const prodSkuInput = document.getElementById('prod-sku');
  const prodCategoryInput = document.getElementById('prod-category');
  const prodPurchasePriceInput = document.getElementById('prod-purchase-price');
  const prodSellingPriceInput = document.getElementById('prod-selling-price');
  const prodStockInput = document.getElementById('prod-stock');
  const prodMinStockInput = document.getElementById('prod-min-stock');
  const prodSupplierSelect = document.getElementById('prod-supplier');
  const prodUnitInput = document.getElementById('prod-unit');

  // Delete Modal elements
  const deleteModal = document.getElementById('delete-modal');
  const deleteProductName = document.getElementById('delete-product-name');
  const btnCloseDeleteModal = document.getElementById('btn-close-delete-modal');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');

  let activeSession = null;
  let userBusinesses = [];
  let activeBusiness = null;
  let cachedSuppliers = [];
  let pendingDeleteProductId = null;
  let searchDebounceTimer = null;

  // 1. Initialize Runtime Status
  if (frontendStatusEl) {
    frontendStatusEl.textContent = 'Active';
    frontendStatusEl.className = 'status-badge success';
  }

  // 2. Check API Health
  checkApiHealth();

  // 3. Initialize Session & Application State
  initAppSession();

  // =========================================================================
  // VIEW ROUTING & ALERTS
  // =========================================================================
  function showView(view) {
    clearAlert();
    authSection.classList.add('hidden');
    onboardingSection.classList.add('hidden');
    workspaceSection.classList.add('hidden');

    if (view === 'auth') {
      authSection.classList.remove('hidden');
      headerUserStatus.classList.add('hidden');
      authStatusBadge.textContent = 'Unauthenticated';
      authStatusBadge.className = 'status-badge pending';
    } else if (view === 'onboarding') {
      onboardingSection.classList.remove('hidden');
      headerUserStatus.classList.remove('hidden');
      authStatusBadge.textContent = 'Setup Required';
      authStatusBadge.className = 'status-badge pending';
    } else if (view === 'workspace') {
      workspaceSection.classList.remove('hidden');
      headerUserStatus.classList.remove('hidden');
      authStatusBadge.textContent = 'Workspace Active';
      authStatusBadge.className = 'status-badge success';
    }
  }

  function showAlert(message, type = 'error') {
    globalAlertEl.textContent = message;
    globalAlertEl.className = `alert alert-${type}`;
    globalAlertEl.classList.remove('hidden');
    globalAlertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearAlert() {
    globalAlertEl.textContent = '';
    globalAlertEl.className = 'alert hidden';
  }

  function showModalAlert(message, type = 'error') {
    productModalAlert.textContent = message;
    productModalAlert.className = `alert alert-${type}`;
    productModalAlert.classList.remove('hidden');
  }

  function clearModalAlert() {
    productModalAlert.textContent = '';
    productModalAlert.className = 'alert hidden';
  }

  // =========================================================================
  // HEALTH CHECK
  // =========================================================================
  function checkApiHealth() {
    fetch('/api/health')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        apiStatusEl.textContent = `Online (${data.status})`;
        apiStatusEl.className = 'status-badge success';
      })
      .catch(() => {
        apiStatusEl.textContent = 'Offline';
        apiStatusEl.className = 'status-badge error';
      });
  }

  // =========================================================================
  // SESSION STORAGE & INITIALIZATION
  // =========================================================================
  function getStoredSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      activeSession = session;
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  }

  function clearStoredSession() {
    localStorage.removeItem(STORAGE_KEY);
    activeSession = null;
    activeBusiness = null;
    userBusinesses = [];
  }

  async function initAppSession() {
    const session = getStoredSession();
    if (!session || !session.access_token) {
      showView('auth');
      return;
    }

    activeSession = session;
    authStatusBadge.textContent = 'Verifying...';
    authStatusBadge.className = 'status-badge pending';

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (!res.ok) throw new Error('Session invalid or expired');

      const data = await res.json();
      headerUserEmail.textContent = data.user.email || '';

      await loadUserBusinesses(session.access_token);
    } catch (err) {
      console.warn('Session verification failed, resetting to sign in:', err.message);
      clearStoredSession();
      showView('auth');
    }
  }

  // =========================================================================
  // BUSINESS LOADER & CONTEXT SWITCHER
  // =========================================================================
  async function loadUserBusinesses(token) {
    try {
      const res = await fetch('/api/businesses/mine', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to query user businesses');

      const data = await res.json();
      userBusinesses = data.businesses || [];

      if (data.hasBusiness && userBusinesses.length > 0) {
        // If an active business was already selected, keep it if still valid, otherwise default to primary
        if (!activeBusiness || !userBusinesses.some(b => b.id === activeBusiness.id)) {
          activeBusiness = userBusinesses[0];
        }

        renderBusinessContext(activeBusiness);
        renderBusinessSwitcher(userBusinesses);
        showView('workspace');

        // Load inventory & suppliers for active business
        await loadSuppliers(activeBusiness.id);
        await loadInventory(activeBusiness.id);
      } else {
        showView('onboarding');
      }
    } catch (err) {
      console.error('Error loading business:', err);
      showView('onboarding');
    }
  }

  function renderBusinessContext(business) {
    workspaceName.textContent = business.name || 'Unnamed Business';
    workspaceRoleBadge.textContent = (business.role || 'Owner').toUpperCase();
    workspaceIndustry.textContent = business.industry || 'Not Specified';
    workspaceLocation.textContent = business.location || 'Not Specified';
    workspaceCurrency.textContent = `${business.currency || 'INR'} ${getCurrencySymbol(business.currency)}`;
    workspaceId.textContent = business.id || '-';
  }

  function renderBusinessSwitcher(businesses) {
    if (businesses.length > 1) {
      businessSwitcherWrapper.classList.remove('hidden');
      businessSwitcherSelect.innerHTML = businesses
        .map(b => `<option value="${b.id}" ${b.id === activeBusiness.id ? 'selected' : ''}>${escapeHtml(b.name)}</option>`)
        .join('');
    } else {
      businessSwitcherWrapper.classList.add('hidden');
    }
  }

  businessSwitcherSelect.addEventListener('change', async (e) => {
    const selectedId = e.target.value;
    const target = userBusinesses.find(b => b.id === selectedId);
    if (target) {
      activeBusiness = target;
      renderBusinessContext(activeBusiness);
      await loadSuppliers(activeBusiness.id);
      await loadInventory(activeBusiness.id);
      showAlert(`Switched active workspace to "${target.name}".`, 'success');
    }
  });

  function getCurrencySymbol(code) {
    switch (code) {
      case 'INR': return '(₹)';
      case 'USD': return '($)';
      case 'EUR': return '(€)';
      case 'GBP': return '(£)';
      case 'AED': return '(د.إ)';
      case 'SGD': return '(S$)';
      default: return '';
    }
  }

  function formatCurrency(amount, currencyCode = 'INR') {
    const num = Number(amount || 0);
    const sym = getCurrencySymbol(currencyCode).replace(/[()]/g, '');
    return `${sym} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // SUPPLIER LOADER
  // =========================================================================
  async function loadSuppliers(businessId) {
    if (!activeSession) return;
    try {
      const res = await fetch(`/api/suppliers?businessId=${businessId}`, {
        headers: { Authorization: `Bearer ${activeSession.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        cachedSuppliers = data.suppliers || [];
        populateSupplierSelect(cachedSuppliers);
      }
    } catch (err) {
      console.warn('Failed to load suppliers:', err.message);
    }
  }

  function populateSupplierSelect(suppliers) {
    prodSupplierSelect.innerHTML = '<option value="">No Supplier Attached</option>' +
      suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  }

  // =========================================================================
  // INVENTORY LOADER & TABLE RENDERING
  // =========================================================================
  async function loadInventory(businessId) {
    if (!activeSession || !businessId) return;

    productsTbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Loading inventory...</td></tr>';
    inventoryEmptyState.classList.add('hidden');

    const search = inventorySearch.value.trim();
    const category = filterCategory.value;
    const stockStatus = filterStockStatus.value;
    const sortVal = sortProducts.value;
    const [sortBy, sortOrder] = parseSortOption(sortVal);

    const queryParams = new URLSearchParams({
      businessId,
      ...(search ? { search } : {}),
      ...(category !== 'all' ? { category } : {}),
      ...(stockStatus !== 'all' ? { stockStatus } : {}),
      sortBy,
      sortOrder
    });

    try {
      const res = await fetch(`/api/products?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${activeSession.access_token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const products = data.products || [];

      updateCategoryFilterOptions(products);
      updateInventoryStats(products);
      renderProductsTable(products);
    } catch (err) {
      console.error('Failed to load products:', err);
      productsTbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Error loading inventory: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function parseSortOption(val) {
    switch (val) {
      case 'name-asc': return ['name', 'asc'];
      case 'name-desc': return ['name', 'desc'];
      case 'stock-desc': return ['current_stock', 'desc'];
      case 'stock-asc': return ['current_stock', 'asc'];
      case 'value-desc': return ['inventory_value', 'desc'];
      default: return ['created_at', 'desc'];
    }
  }

  function updateCategoryFilterOptions(products) {
    const currentVal = filterCategory.value;
    const categories = new Set();
    products.forEach(p => {
      if (p.category && p.category !== 'General') categories.add(p.category);
    });

    let html = '<option value="all">All Categories</option><option value="General">General</option>';
    Array.from(categories).sort().forEach(cat => {
      html += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
    });

    filterCategory.innerHTML = html;
    filterCategory.value = currentVal;
  }

  function updateInventoryStats(products) {
    const totalProducts = products.length;
    let totalUnits = 0;
    let lowStockCount = 0;
    let totalValuation = 0;
    const currency = activeBusiness ? activeBusiness.currency : 'INR';

    products.forEach(p => {
      totalUnits += p.current_stock;
      if (p.stock_status === 'low_stock' || p.stock_status === 'out_of_stock') {
        lowStockCount++;
      }
      totalValuation += p.inventory_value;
    });

    statTotalProducts.textContent = totalProducts.toLocaleString();
    statTotalUnits.textContent = totalUnits.toLocaleString();
    statLowStock.textContent = lowStockCount.toLocaleString();
    statTotalValuation.textContent = formatCurrency(totalValuation, currency);
  }

  function renderProductsTable(products) {
    if (products.length === 0) {
      productsTbody.innerHTML = '';
      inventoryEmptyState.classList.remove('hidden');
      return;
    }

    inventoryEmptyState.classList.add('hidden');
    const currency = activeBusiness ? activeBusiness.currency : 'INR';

    productsTbody.innerHTML = products.map(p => {
      let badgeClass = 'badge-instock';
      let badgeText = 'In Stock';

      if (p.stock_status === 'out_of_stock') {
        badgeClass = 'badge-outofstock';
        badgeText = 'Out of Stock';
      } else if (p.stock_status === 'low_stock') {
        badgeClass = 'badge-lowstock';
        badgeText = 'Low Stock';
      }

      return `
        <tr data-id="${p.id}">
          <td>
            <div class="prod-name-cell">${escapeHtml(p.name)}</div>
            <div class="prod-cat-cell">${escapeHtml(p.category)} ${p.supplier ? `• ${escapeHtml(p.supplier.name)}` : ''}</div>
          </td>
          <td>
            ${p.sku ? `<span class="prod-sku-cell">${escapeHtml(p.sku)}</span>` : '<span class="text-muted">—</span>'}
          </td>
          <td>${formatCurrency(p.purchase_price, currency)}</td>
          <td>${formatCurrency(p.selling_price, currency)}</td>
          <td><strong>${p.current_stock}</strong> <span class="text-muted text-sm">/ min ${p.minimum_stock}</span></td>
          <td><span class="${badgeClass}">${badgeText}</span></td>
          <td>${formatCurrency(p.inventory_value, currency)}</td>
          <td class="text-right">
            <button class="btn-action-edit" data-id="${p.id}" aria-label="Edit ${escapeHtml(p.name)}">Edit</button>
            <button class="btn-action-delete" data-id="${p.id}" data-name="${escapeHtml(p.name)}" aria-label="Delete ${escapeHtml(p.name)}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach event listeners to Edit and Delete buttons
    productsTbody.querySelectorAll('.btn-action-edit').forEach(btn => {
      btn.addEventListener('click', () => handleEditClick(btn.dataset.id));
    });

    productsTbody.querySelectorAll('.btn-action-delete').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteClick(btn.dataset.id, btn.dataset.name));
    });
  }

  // =========================================================================
  // INVENTORY TOOLBAR EVENTS
  // =========================================================================
  inventorySearch.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      if (activeBusiness) loadInventory(activeBusiness.id);
    }, 250);
  });

  filterCategory.addEventListener('change', () => {
    if (activeBusiness) loadInventory(activeBusiness.id);
  });

  filterStockStatus.addEventListener('change', () => {
    if (activeBusiness) loadInventory(activeBusiness.id);
  });

  sortProducts.addEventListener('change', () => {
    if (activeBusiness) loadInventory(activeBusiness.id);
  });

  // =========================================================================
  // ADD / EDIT PRODUCT MODAL HANDLERS
  // =========================================================================
  function openAddProductModal() {
    clearModalAlert();
    productForm.reset();
    prodIdInput.value = '';
    modalProductTitle.textContent = 'Add New Product';
    prodStockInput.value = '0';
    prodMinStockInput.value = '5';
    prodUnitInput.value = 'units';
    productModal.classList.remove('hidden');
    prodNameInput.focus();
  }

  btnOpenAddProduct.addEventListener('click', openAddProductModal);
  btnEmptyAddProduct.addEventListener('click', openAddProductModal);

  async function handleEditClick(productId) {
    if (!activeSession) return;
    clearModalAlert();

    try {
      const res = await fetch(`/api/products/${productId}`, {
        headers: { Authorization: `Bearer ${activeSession.access_token}` }
      });

      if (!res.ok) throw new Error('Failed to retrieve product details.');

      const data = await res.json();
      const p = data.product;

      prodIdInput.value = p.id;
      prodNameInput.value = p.name;
      prodSkuInput.value = p.sku || '';
      prodCategoryInput.value = p.category || 'General';
      prodPurchasePriceInput.value = p.purchase_price;
      prodSellingPriceInput.value = p.selling_price;
      prodStockInput.value = p.current_stock;
      prodMinStockInput.value = p.minimum_stock;
      prodSupplierSelect.value = p.supplier_id || '';
      prodUnitInput.value = p.unit || 'units';

      modalProductTitle.textContent = `Edit Product: ${p.name}`;
      productModal.classList.remove('hidden');
      prodNameInput.focus();
    } catch (err) {
      showAlert(`Error loading product: ${err.message}`);
    }
  }

  function closeProductModal() {
    productModal.classList.add('hidden');
    clearModalAlert();
    productForm.reset();
  }

  btnCloseProductModal.addEventListener('click', closeProductModal);
  btnCancelProduct.addEventListener('click', closeProductModal);

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearModalAlert();

    if (!activeSession || !activeBusiness) {
      showModalAlert('No active business workspace selected.');
      return;
    }

    const id = prodIdInput.value.trim();
    const name = prodNameInput.value.trim();
    const sku = prodSkuInput.value.trim();
    const category = prodCategoryInput.value.trim() || 'General';
    const purchase_price = parseFloat(prodPurchasePriceInput.value);
    const selling_price = parseFloat(prodSellingPriceInput.value);
    const current_stock = parseInt(prodStockInput.value, 10);
    const minimum_stock = parseInt(prodMinStockInput.value, 10);
    const supplier_id = prodSupplierSelect.value || null;
    const unit = prodUnitInput.value.trim() || 'units';

    // Frontend validation
    if (!name || name.length < 2) {
      showModalAlert('Product name is required (minimum 2 characters).');
      return;
    }
    if (isNaN(purchase_price) || purchase_price < 0) {
      showModalAlert('Purchase price must be a non-negative number.');
      return;
    }
    if (isNaN(selling_price) || selling_price < 0) {
      showModalAlert('Selling price must be a non-negative number.');
      return;
    }
    if (isNaN(current_stock) || current_stock < 0) {
      showModalAlert('Current stock quantity cannot be negative.');
      return;
    }
    if (isNaN(minimum_stock) || minimum_stock < 0) {
      showModalAlert('Minimum stock alert threshold cannot be negative.');
      return;
    }

    btnSaveProduct.disabled = true;
    btnSaveProduct.textContent = 'Saving...';

    const payload = {
      business_id: activeBusiness.id,
      name,
      sku: sku || null,
      category,
      purchase_price,
      selling_price,
      current_stock,
      minimum_stock,
      supplier_id,
      unit
    };

    try {
      const url = id ? `/api/products/${id}` : '/api/products';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeSession.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        showModalAlert(data.error || 'Failed to save product.');
        return;
      }

      closeProductModal();
      showAlert(id ? 'Product updated successfully.' : 'Product created successfully.', 'success');
      await loadInventory(activeBusiness.id);
    } catch (err) {
      showModalAlert('A network error occurred while saving the product.');
      console.error(err);
    } finally {
      btnSaveProduct.disabled = false;
      btnSaveProduct.textContent = 'Save Product';
    }
  });

  // =========================================================================
  // DELETE PRODUCT HANDLER
  // =========================================================================
  function handleDeleteClick(productId, productName) {
    pendingDeleteProductId = productId;
    deleteProductName.textContent = productName || 'this item';
    deleteModal.classList.remove('hidden');
  }

  function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    pendingDeleteProductId = null;
  }

  btnCloseDeleteModal.addEventListener('click', closeDeleteModal);
  btnCancelDelete.addEventListener('click', closeDeleteModal);

  btnConfirmDelete.addEventListener('click', async () => {
    if (!activeSession || !pendingDeleteProductId) return;

    btnConfirmDelete.disabled = true;
    btnConfirmDelete.textContent = 'Deleting...';

    try {
      const res = await fetch(`/api/products/${pendingDeleteProductId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${activeSession.access_token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert(data.error || 'Failed to delete product.');
      } else {
        showAlert(data.message || 'Product deleted.', 'success');
        if (activeBusiness) await loadInventory(activeBusiness.id);
      }
    } catch (err) {
      showAlert('A network error occurred while deleting the product.');
      console.error(err);
    } finally {
      btnConfirmDelete.disabled = false;
      btnConfirmDelete.textContent = 'Delete Product';
      closeDeleteModal();
    }
  });

  // =========================================================================
  // AUTH TABS & FORM SUBMISSIONS
  // =========================================================================
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabRegister.classList.remove('active');
    tabRegister.setAttribute('aria-selected', 'false');
    loginPanel.classList.remove('hidden');
    registerPanel.classList.add('hidden');
    clearAlert();
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabRegister.setAttribute('aria-selected', 'true');
    tabLogin.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'false');
    registerPanel.classList.remove('hidden');
    loginPanel.classList.add('hidden');
    clearAlert();
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showAlert('Please enter both your email address and password.');
      return;
    }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Signing in...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          showAlert(data.error || 'Email not verified. Please check your inbox.', 'warning');
        } else {
          showAlert(data.error || 'Failed to sign in. Please verify your credentials.', 'error');
        }
        return;
      }

      saveSession(data.session);
      headerUserEmail.textContent = data.user.email || '';
      loginForm.reset();

      await loadUserBusinesses(data.session.access_token);
    } catch (err) {
      showAlert('A network error occurred. Please try again.');
      console.error(err);
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = 'Sign In';
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;

    if (!email) {
      showAlert('Please enter an email address.');
      return;
    }
    if (!password || password.length < 6) {
      showAlert('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Passwords do not match.');
      return;
    }

    registerSubmitBtn.disabled = true;
    registerSubmitBtn.textContent = 'Creating account...';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert(data.error || 'Registration failed.', 'error');
        return;
      }

      if (data.status === 'unverified') {
        registerForm.reset();
        tabLogin.click();
        document.getElementById('login-email').value = email;
        showAlert('Account registered! Please check your email to verify your account before logging in.', 'warning');
      } else if (data.status === 'authenticated' && data.session) {
        saveSession(data.session);
        headerUserEmail.textContent = data.user.email || '';
        registerForm.reset();
        showView('onboarding');
      }
    } catch (err) {
      showAlert('A network error occurred during registration.');
      console.error(err);
    } finally {
      registerSubmitBtn.disabled = false;
      registerSubmitBtn.textContent = 'Create Account';
    }
  });

  // =========================================================================
  // ONBOARDING SUBMISSION
  // =========================================================================
  bizIndustrySelect.addEventListener('change', () => {
    if (bizIndustrySelect.value === 'Other') {
      bizIndustryCustomGroup.classList.remove('hidden');
      bizIndustryCustomInput.required = true;
      bizIndustryCustomInput.focus();
    } else {
      bizIndustryCustomGroup.classList.add('hidden');
      bizIndustryCustomInput.required = false;
      bizIndustryCustomInput.value = '';
    }
  });

  onboardingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const session = getStoredSession();
    if (!session || !session.access_token) {
      showAlert('Session expired. Please sign in again.');
      showView('auth');
      return;
    }

    const name = document.getElementById('biz-name').value.trim();
    let industry = bizIndustrySelect.value;
    if (industry === 'Other') {
      industry = bizIndustryCustomInput.value.trim();
    }
    const location = document.getElementById('biz-location').value.trim();
    const currency = document.getElementById('biz-currency').value;

    if (!name || name.length < 2) {
      showAlert('Please enter a valid business name (minimum 2 characters).');
      return;
    }

    if (!industry || industry.length < 2) {
      showAlert('Please select or specify your business industry.');
      return;
    }

    onboardingSubmitBtn.disabled = true;
    onboardingSubmitBtn.textContent = 'Creating Workspace...';

    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ name, industry, location, currency })
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert(data.error || 'Failed to create business workspace.', 'error');
        return;
      }

      activeBusiness = data.business;
      onboardingForm.reset();
      bizIndustryCustomGroup.classList.add('hidden');

      await loadUserBusinesses(session.access_token);
      showAlert('Business workspace created successfully!', 'success');
    } catch (err) {
      showAlert('A network error occurred while setting up your workspace.');
      console.error(err);
    } finally {
      onboardingSubmitBtn.disabled = false;
      onboardingSubmitBtn.textContent = 'Create Business Workspace';
    }
  });

  // =========================================================================
  // LOGOUT
  // =========================================================================
  async function handleLogout() {
    const session = getStoredSession();
    clearAlert();

    try {
      if (session && session.access_token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
      }
    } catch (err) {
      console.warn('Logout network error:', err);
    } finally {
      clearStoredSession();
      headerUserEmail.textContent = '';
      showView('auth');
      showAlert('You have been logged out.', 'success');
    }
  }

  btnHeaderLogout.addEventListener('click', handleLogout);
});
