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
  const publicHomeSection = document.getElementById('public-home-section');
  const authSection = document.getElementById('auth-section');
  const onboardingSection = document.getElementById('onboarding-section');
  const workspaceSection = document.getElementById('workspace-section');

  // Public Homepage & Navigation Elements
  const navGuestActions = document.getElementById('nav-guest-actions');
  const btnNavSignin = document.getElementById('btn-nav-signin');
  const btnNavGetstarted = document.getElementById('btn-nav-getstarted');
  const btnNavWorkspace = document.getElementById('btn-nav-workspace');
  const navBrandHome = document.getElementById('nav-brand-home');
  const btnAuthBackHome = document.getElementById('btn-auth-back-home');
  const btnHeroGetstarted = document.getElementById('btn-hero-getstarted');
  const btnCtaGetstarted = document.getElementById('btn-cta-getstarted');
  const btnCtaSignin = document.getElementById('btn-cta-signin');
  const btnCompGetstarted = document.getElementById('btn-comp-getstarted');
  const btnMobileNav = document.getElementById('btn-mobile-nav');
  const primaryNavLinks = document.getElementById('primary-nav-links');
  const demoTabInventory = document.getElementById('demo-tab-inventory');
  const demoTabSales = document.getElementById('demo-tab-sales');
  const demoTabPurchases = document.getElementById('demo-tab-purchases');
  const btnDemoCreatePo = document.getElementById('btn-demo-create-po');

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

  // Workspace Module Navigation elements
  const navTabDashboard = document.getElementById('nav-tab-dashboard');
  const navTabInventory = document.getElementById('nav-tab-inventory');
  const navTabSales = document.getElementById('nav-tab-sales');
  const navTabPurchases = document.getElementById('nav-tab-purchases');
  const moduleDashboard = document.getElementById('module-dashboard');
  const moduleInventory = document.getElementById('module-inventory');
  const moduleSales = document.getElementById('module-sales');
  const modulePurchases = document.getElementById('module-purchases');

  // Dashboard Analytics Elements
  const dashboardDateContext = document.getElementById('dashboard-date-context');
  const dashboardPeriodSelect = document.getElementById('dashboard-period-select');
  const btnRefreshDashboard = document.getElementById('btn-refresh-dashboard');
  const dashboardLastUpdated = document.getElementById('dashboard-last-updated');
  const dashboardErrorAlert = document.getElementById('dashboard-error-alert');
  const dashboardErrorText = document.getElementById('dashboard-error-text');
  const btnRetryDashboard = document.getElementById('btn-retry-dashboard');
  const dashboardLoadingState = document.getElementById('dashboard-loading-state');
  const dashboardContent = document.getElementById('dashboard-content');
  const dashKpiValuation = document.getElementById('dash-kpi-valuation');
  const dashKpiUnits = document.getElementById('dash-kpi-units');
  const dashKpiLowStock = document.getElementById('dash-kpi-low-stock');
  const dashKpiOutOfStock = document.getElementById('dash-kpi-out-of-stock');
  const dashKpiMonthlySales = document.getElementById('dash-kpi-monthly-sales');
  const dashKpiMonthlyOrders = document.getElementById('dash-kpi-monthly-orders');
  const dashKpiActiveSkus = document.getElementById('dash-kpi-active-skus');
  const dashKpiTotalSkus = document.getElementById('dash-kpi-total-skus');
  const dashboardTrendChartWrap = document.getElementById('dashboard-trend-chart-wrap');
  const dashboardChartEmpty = document.getElementById('dashboard-chart-empty');
  const btnDashViewInventory = document.getElementById('btn-dash-view-inventory');
  const dashboardLowStockWrap = document.getElementById('dashboard-low-stock-wrap');
  const dashboardLowStockTbody = document.getElementById('dashboard-low-stock-tbody');
  const dashboardLowStockEmpty = document.getElementById('dashboard-low-stock-empty');
  const btnDashViewSales = document.getElementById('btn-dash-view-sales');
  const btnDashViewPurchases = document.getElementById('btn-dash-view-purchases');
  const dashboardRecentActivityList = document.getElementById('dashboard-recent-activity-list');
  const dashboardActivityEmpty = document.getElementById('dashboard-activity-empty');

  // Inventory Intelligence Elements (Stage 6.2.3)
  const intelWindowSelect = document.getElementById('intel-window-select');
  const intelTargetSelect = document.getElementById('intel-target-select');
  const btnRefreshIntel = document.getElementById('btn-refresh-intel');
  const intelLastUpdated = document.getElementById('intel-last-updated');
  const intelErrorAlert = document.getElementById('intel-error-alert');
  const intelErrorText = document.getElementById('intel-error-text');
  const btnRetryIntel = document.getElementById('btn-retry-intel');
  const intelLoadingState = document.getElementById('intel-loading-state');
  const intelSummaryDepleted = document.getElementById('intel-summary-depleted');
  const intelSummaryHighRisk = document.getElementById('intel-summary-high-risk');
  const intelSummaryModerateRisk = document.getElementById('intel-summary-moderate-risk');
  const intelSummaryInsufficientData = document.getElementById('intel-summary-insufficient-data');
  const intelSummaryReorderCost = document.getElementById('intel-summary-reorder-cost');
  const intelFilterAll = document.getElementById('intel-filter-all');
  const intelFilterCritical = document.getElementById('intel-filter-critical');
  const intelFilterModerate = document.getElementById('intel-filter-moderate');
  const intelFilterHealthy = document.getElementById('intel-filter-healthy');
  const intelFilterInsufficient = document.getElementById('intel-filter-insufficient');
  const intelCountAll = document.getElementById('intel-count-all');
  const intelCountCritical = document.getElementById('intel-count-critical');
  const intelCountModerate = document.getElementById('intel-count-moderate');
  const intelCountHealthy = document.getElementById('intel-count-healthy');
  const intelCountInsufficient = document.getElementById('intel-count-insufficient');
  const intelSearchInput = document.getElementById('intel-search-input');
  const intelTableContainer = document.getElementById('intel-table-container');
  const intelTable = document.getElementById('intel-table');
  const intelTbody = document.getElementById('intel-tbody');
  const intelEmptyCatalog = document.getElementById('intel-empty-catalog');
  const intelEmptyRestock = document.getElementById('intel-empty-restock');
  const intelEmptyFilter = document.getElementById('intel-empty-filter');

  // AI Inventory Analyst Elements
  const btnGenerateAiInsights = document.getElementById('btn-generate-ai-insights');
  const aiInsightsLastUpdated = document.getElementById('ai-insights-last-updated');
  const aiInsightsErrorAlert = document.getElementById('ai-insights-error-alert');
  const aiInsightsErrorText = document.getElementById('ai-insights-error-text');
  const btnRetryAiInsights = document.getElementById('btn-retry-ai-insights');
  const aiInsightsLoadingState = document.getElementById('ai-insights-loading-state');
  const aiInsightsIdleState = document.getElementById('ai-insights-idle-state');
  const aiInsightsContent = document.getElementById('ai-insights-content');
  const aiInsightsModelBadge = document.getElementById('ai-insights-model-badge');
  const aiInsightsSummary = document.getElementById('ai-insights-summary');
  const aiInsightsFindingsCount = document.getElementById('ai-insights-findings-count');
  const aiInsightsFindingsList = document.getElementById('ai-insights-findings-list');
  const aiInsightsLimitations = document.getElementById('ai-insights-limitations');

  // Demand Insights & Slow-Moving Stock Elements (Stage 7.3)
  const dashboardDemandInsightsSection = document.getElementById('dashboard-demand-insights-section');
  const demandWindowSelect = document.getElementById('demand-window-select');
  const btnRefreshDemand = document.getElementById('btn-refresh-demand');
  const demandLastUpdated = document.getElementById('demand-last-updated');
  const demandRecentRange = document.getElementById('demand-recent-range');
  const demandPriorRange = document.getElementById('demand-prior-range');
  const demandErrorAlert = document.getElementById('demand-error-alert');
  const demandErrorText = document.getElementById('demand-error-text');
  const btnRetryDemand = document.getElementById('btn-retry-demand');
  const demandLoadingState = document.getElementById('demand-loading-state');
  const demandSummaryAccelerating = document.getElementById('demand-summary-accelerating');
  const demandSummaryDecelerating = document.getElementById('demand-summary-decelerating');
  const demandSummarySlowMoving = document.getElementById('demand-summary-slow-moving');
  const demandSummaryOverstocked = document.getElementById('demand-summary-overstocked');
  const demandSummaryExcessCapital = document.getElementById('demand-summary-excess-capital');
  const demandSummaryCalibrating = document.getElementById('demand-summary-calibrating');
  const demandFilterAll = document.getElementById('demand-filter-all');
  const demandFilterAccel = document.getElementById('demand-filter-accel');
  const demandFilterDecel = document.getElementById('demand-filter-decel');
  const demandFilterSlow = document.getElementById('demand-filter-slow');
  const demandFilterOverstock = document.getElementById('demand-filter-overstock');
  const demandFilterCalib = document.getElementById('demand-filter-calib');
  const demandCountAll = document.getElementById('demand-count-all');
  const demandCountAccel = document.getElementById('demand-count-accel');
  const demandCountDecel = document.getElementById('demand-count-decel');
  const demandCountSlow = document.getElementById('demand-count-slow');
  const demandCountOverstock = document.getElementById('demand-count-overstock');
  const demandCountCalib = document.getElementById('demand-count-calib');
  const demandSearchInput = document.getElementById('demand-search-input');
  const demandTableContainer = document.getElementById('demand-table-container');
  const demandTable = document.getElementById('demand-table');
  const demandTbody = document.getElementById('demand-tbody');
  const demandEmptyCatalog = document.getElementById('demand-empty-catalog');
  const demandEmptyFilter = document.getElementById('demand-empty-filter');
  const demandDisclaimerBox = document.getElementById('demand-disclaimer-box');
  const demandDisclaimerPeriods = document.getElementById('demand-disclaimer-periods');
  const demandDisclaimerOverstock = document.getElementById('demand-disclaimer-overstock');

  // Sales Elements
  const statTotalSales = document.getElementById('stat-total-sales');
  const statTotalUnitsSold = document.getElementById('stat-total-units-sold');
  const statTotalSalesRevenue = document.getElementById('stat-total-sales-revenue');
  const btnOpenRecordSale = document.getElementById('btn-open-record-sale');
  const btnEmptyRecordSale = document.getElementById('btn-empty-record-sale');
  const salesSearch = document.getElementById('sales-search');
  const salesTbody = document.getElementById('sales-tbody');
  const salesEmptyState = document.getElementById('sales-empty-state');

  // Sale Modal Elements
  const saleModal = document.getElementById('sale-modal');
  const btnCloseSaleModal = document.getElementById('btn-close-sale-modal');
  const btnCancelSale = document.getElementById('btn-cancel-sale');
  const saleForm = document.getElementById('sale-form');
  const saleModalAlert = document.getElementById('sale-modal-alert');
  const saleCustomerName = document.getElementById('sale-customer-name');
  const saleDate = document.getElementById('sale-date');
  const saleNotes = document.getElementById('sale-notes');
  const saleItemsTbody = document.getElementById('sale-items-tbody');
  const btnAddSaleRow = document.getElementById('btn-add-sale-row');
  const saleGrandTotal = document.getElementById('sale-grand-total');
  const btnSubmitSale = document.getElementById('btn-submit-sale');

  // Purchases Elements
  const statTotalPurchases = document.getElementById('stat-total-purchases');
  const statPendingPurchases = document.getElementById('stat-pending-purchases');
  const statTotalPurchasesSpend = document.getElementById('stat-total-purchases-spend');
  const btnOpenCreatePurchase = document.getElementById('btn-open-create-purchase');
  const btnEmptyCreatePurchase = document.getElementById('btn-empty-create-purchase');
  const filterPurchaseStatus = document.getElementById('filter-purchase-status');
  const purchasesTbody = document.getElementById('purchases-tbody');
  const purchasesEmptyState = document.getElementById('purchases-empty-state');

  // Purchase Modal Elements
  const purchaseModal = document.getElementById('purchase-modal');
  const btnClosePurchaseModal = document.getElementById('btn-close-purchase-modal');
  const btnCancelPurchase = document.getElementById('btn-cancel-purchase');
  const purchaseForm = document.getElementById('purchase-form');
  const purchaseModalAlert = document.getElementById('purchase-modal-alert');
  const purchaseSupplierSelect = document.getElementById('purchase-supplier-select');
  const purchaseStatusSelect = document.getElementById('purchase-status-select');
  const purchaseDate = document.getElementById('purchase-date');
  const purchaseNotes = document.getElementById('purchase-notes');
  const purchaseItemsTbody = document.getElementById('purchase-items-tbody');
  const btnAddPurchaseRow = document.getElementById('btn-add-purchase-row');
  const purchaseGrandTotal = document.getElementById('purchase-grand-total');
  const btnSubmitPurchase = document.getElementById('btn-submit-purchase');

  // Transaction Details Modal Elements
  const detailsModal = document.getElementById('details-modal');
  const modalDetailsTitle = document.getElementById('modal-details-title');
  const btnCloseDetailsModal = document.getElementById('btn-close-details-modal');
  const btnDismissDetails = document.getElementById('btn-dismiss-details');
  const detailsRefNumber = document.getElementById('details-ref-number');
  const detailsDate = document.getElementById('details-date');
  const detailsEntityLabel = document.getElementById('details-entity-label');
  const detailsEntityValue = document.getElementById('details-entity-value');
  const detailsStatus = document.getElementById('details-status');
  const detailsNotesWrapper = document.getElementById('details-notes-wrapper');
  const detailsNotes = document.getElementById('details-notes');
  const detailsItemsTbody = document.getElementById('details-items-tbody');
  const detailsGrandTotal = document.getElementById('details-grand-total');

  // Product Movements Audit Modal elements
  const movementsModal = document.getElementById('movements-modal');
  const modalMovementsTitle = document.getElementById('modal-movements-title');
  const btnCloseMovementsModal = document.getElementById('btn-close-movements-modal');
  const btnDismissMovements = document.getElementById('btn-dismiss-movements');
  const movementProdName = document.getElementById('movement-prod-name');
  const movementProdSku = document.getElementById('movement-prod-sku');
  const movementProdStock = document.getElementById('movement-prod-stock');
  const movementsTbody = document.getElementById('movements-tbody');

  let activeSession = null;
  let userBusinesses = [];
  let activeBusiness = null;
  let cachedSuppliers = [];
  let cachedProducts = [];
  let cachedSales = [];
  let cachedPurchases = [];
  let cachedAnalytics = null;
  let cachedIntelligence = null;
  let currentIntelligenceFilter = 'all';
  let currentIntelligenceSearch = '';
  let intelligenceRequestId = 0;
  let cachedAiInsights = null;
  let aiInsightsRequestId = 0;
  let cachedDemandInsights = null;
  let currentDemandFilter = 'all';
  let currentDemandSearch = '';
  let demandRequestId = 0;
  let currentModule = 'dashboard';
  let pendingDeleteProductId = null;
  let searchDebounceTimer = null;
  let salesSearchDebounceTimer = null;

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
  function showView(view, tab = 'login') {
    clearAlert();
    if (publicHomeSection) publicHomeSection.classList.add('hidden');
    authSection.classList.add('hidden');
    onboardingSection.classList.add('hidden');
    workspaceSection.classList.add('hidden');

    if (view === 'home') {
      if (publicHomeSection) publicHomeSection.classList.remove('hidden');
      updateNavAuthState();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (view === 'auth') {
      authSection.classList.remove('hidden');
      updateNavAuthState();
      if (tab === 'register') {
        activateAuthTab('register');
      } else {
        activateAuthTab('login');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (view === 'onboarding') {
      onboardingSection.classList.remove('hidden');
      headerUserStatus.classList.remove('hidden');
      if (navGuestActions) navGuestActions.classList.add('hidden');
      authStatusBadge.textContent = 'Setup Required';
      authStatusBadge.className = 'status-badge pending';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (view === 'workspace') {
      workspaceSection.classList.remove('hidden');
      headerUserStatus.classList.remove('hidden');
      if (navGuestActions) navGuestActions.classList.add('hidden');
      authStatusBadge.textContent = 'Workspace Active';
      authStatusBadge.className = 'status-badge success';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function updateNavAuthState() {
    if (activeSession) {
      if (headerUserStatus) headerUserStatus.classList.remove('hidden');
      if (navGuestActions) navGuestActions.classList.add('hidden');
    } else {
      if (headerUserStatus) headerUserStatus.classList.add('hidden');
      if (navGuestActions) navGuestActions.classList.remove('hidden');
    }
  }

  function activateAuthTab(tab) {
    if (tab === 'register') {
      tabRegister.classList.add('active');
      tabRegister.setAttribute('aria-selected', 'true');
      tabLogin.classList.remove('active');
      tabLogin.setAttribute('aria-selected', 'false');
      registerPanel.classList.remove('hidden');
      loginPanel.classList.add('hidden');
      clearAlert();
      const nameInput = document.getElementById('register-name');
      if (nameInput) nameInput.focus();
    } else {
      tabLogin.classList.add('active');
      tabLogin.setAttribute('aria-selected', 'true');
      tabRegister.classList.remove('active');
      tabRegister.setAttribute('aria-selected', 'false');
      loginPanel.classList.remove('hidden');
      registerPanel.classList.add('hidden');
      clearAlert();
      const emailInput = document.getElementById('login-email');
      if (emailInput) emailInput.focus();
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
    cachedIntelligence = null;
    currentIntelligenceFilter = 'all';
    currentIntelligenceSearch = '';
    cachedAiInsights = null;
    resetAiInsightsUI();
    cachedDemandInsights = null;
    currentDemandFilter = 'all';
    currentDemandSearch = '';
  }

  async function initAppSession() {
    const session = getStoredSession();
    const currentHash = window.location.hash;

    if (!session || !session.access_token) {
      updateNavAuthState();
      if (currentHash === '#/login' || currentHash === '#login') {
        showView('auth', 'login');
      } else if (currentHash === '#/register' || currentHash === '#register') {
        showView('auth', 'register');
      } else {
        showView('home');
      }
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
      updateNavAuthState();

      await loadUserBusinesses(session.access_token);

      if (currentHash === '#/workspace' || currentHash === '#workspace') {
        showView('workspace');
      } else if (currentHash === '#/login' || currentHash === '#login' || currentHash === '#/register' || currentHash === '#register') {
        showView('workspace');
      } else if (currentHash === '#/' || currentHash === '' || currentHash === '#home') {
        showView('home');
      }
    } catch (err) {
      console.warn('Session verification failed, resetting to public home:', err.message);
      clearStoredSession();
      updateNavAuthState();
      showView('home');
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

        // Load dashboard, inventory & suppliers for active business in background
        await loadSuppliers(activeBusiness.id);
        await Promise.all([
          loadDashboard(activeBusiness.id),
          loadInventory(activeBusiness.id)
        ]);
        switchModule('dashboard');

        const currentHash = window.location.hash;
        if (currentHash === '#/workspace' || currentHash === '#workspace' || currentHash === '#/login') {
          showView('workspace');
        }
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
      // Reset intelligence filters and search for the new business context
      currentIntelligenceFilter = 'all';
      currentIntelligenceSearch = '';
      if (intelSearchInput) intelSearchInput.value = '';
      const intelTabs = [intelFilterAll, intelFilterCritical, intelFilterModerate, intelFilterHealthy, intelFilterInsufficient];
      intelTabs.forEach(tab => {
        if (tab) {
          tab.classList.remove('active');
          tab.setAttribute('aria-selected', 'false');
        }
      });
      if (intelFilterAll) {
        intelFilterAll.classList.add('active');
        intelFilterAll.setAttribute('aria-selected', 'true');
      }

      // Reset AI Inventory Analyst state
      cachedAiInsights = null;
      resetAiInsightsUI();

      // Reset Demand Insights state
      currentDemandFilter = 'all';
      currentDemandSearch = '';
      if (demandSearchInput) demandSearchInput.value = '';
      const demandTabs = [demandFilterAll, demandFilterAccel, demandFilterDecel, demandFilterSlow, demandFilterOverstock, demandFilterCalib];
      demandTabs.forEach(tab => {
        if (tab) {
          tab.classList.remove('active');
          tab.setAttribute('aria-selected', 'false');
        }
      });
      if (demandFilterAll) {
        demandFilterAll.classList.add('active');
        demandFilterAll.setAttribute('aria-selected', 'true');
      }
      cachedDemandInsights = null;

      renderBusinessContext(activeBusiness);
      await loadSuppliers(activeBusiness.id);
      await loadInventory(activeBusiness.id);
      if (currentModule === 'dashboard') await loadDashboard(activeBusiness.id);
      if (currentModule === 'sales') await loadSales(activeBusiness.id);
      if (currentModule === 'purchases') await loadPurchases(activeBusiness.id);
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
      cachedProducts = products;

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
      let statusClass = 'instock';
      let statusText = 'In Stock';

      if (p.stock_status === 'out_of_stock') {
        statusClass = 'outofstock';
        statusText = 'Out of Stock';
      } else if (p.stock_status === 'low_stock') {
        statusClass = 'lowstock';
        statusText = 'Low Stock';
      }

      // Proportional stock meter calculations
      const benchmark = Math.max(Number(p.minimum_stock || 0) * 2, 10, Number(p.current_stock || 0));
      const gaugePercent = Math.min(100, Math.max(0, Math.round((Number(p.current_stock || 0) / benchmark) * 100)));
      let fillClass = '';
      if (p.stock_status === 'out_of_stock') fillClass = 'danger';
      else if (p.stock_status === 'low_stock') fillClass = 'warning';

      return `
        <tr data-id="${p.id}">
          <td>
            <div class="prod-name-cell">${escapeHtml(p.name)}</div>
            <div class="prod-cat-cell">${escapeHtml(p.category || 'General')} ${p.supplier ? `• ${escapeHtml(p.supplier.name)}` : ''}</div>
          </td>
          <td>
            ${p.sku ? `<span class="prod-sku-cell">${escapeHtml(p.sku)}</span>` : '<span class="mono" style="color: var(--color-secondary);">—</span>'}
          </td>
          <td class="mono tabular-nums" style="text-align: right;">${formatCurrency(p.purchase_price, currency)}</td>
          <td class="mono tabular-nums" style="text-align: right;">${formatCurrency(p.selling_price, currency)}</td>
          <td>
            <div class="stock-gauge-wrapper">
              <div class="stock-meter-track" title="${p.current_stock} in stock">
                <div class="stock-meter-fill ${fillClass}" style="width: ${gaugePercent}%;"></div>
              </div>
              <div>
                <span class="mono tabular-nums font-semibold">${p.current_stock}</span>
                <span class="mono text-muted" style="font-size: 0.75rem;">/ min ${p.minimum_stock}</span>
              </div>
            </div>
          </td>
          <td><span class="status-pill ${statusClass}">${statusText}</span></td>
          <td class="mono tabular-nums font-semibold" style="text-align: right;">${formatCurrency(p.inventory_value, currency)}</td>
          <td style="text-align: right;">
            <div class="table-actions">
              <button class="btn-action-history" data-id="${p.id}" aria-label="Audit stock movements for ${escapeHtml(p.name)}">Audit</button>
              <button class="btn-action-edit" data-id="${p.id}" aria-label="Edit ${escapeHtml(p.name)}">Edit</button>
              <button class="btn-action-delete" data-id="${p.id}" data-name="${escapeHtml(p.name)}" aria-label="Delete ${escapeHtml(p.name)}">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach event listeners to Audit, Edit, and Delete buttons
    productsTbody.querySelectorAll('.btn-action-history').forEach(btn => {
      btn.addEventListener('click', () => handleMovementsClick(btn.dataset.id));
    });

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
      await Promise.all([
        loadInventory(activeBusiness.id),
        loadDashboard(activeBusiness.id)
      ]);
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
        if (activeBusiness) {
          await Promise.all([
            loadInventory(activeBusiness.id),
            loadDashboard(activeBusiness.id)
          ]);
        }
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
  // PRODUCT MOVEMENTS AUDIT MODAL HANDLERS
  // =========================================================================
  async function handleMovementsClick(productId) {
    if (!activeSession) return;

    const product = cachedProducts.find(p => p.id === productId);
    if (product) {
      movementProdName.textContent = product.name;
      movementProdSku.textContent = product.sku || 'N/A';
      movementProdStock.textContent = `${product.current_stock} units`;
      modalMovementsTitle.textContent = `Audit Ledger: ${product.name}`;
    } else {
      movementProdName.textContent = 'Loading...';
      movementProdSku.textContent = '-';
      movementProdStock.textContent = '-';
      modalMovementsTitle.textContent = 'Audit Ledger';
    }

    movementsTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--color-secondary);">Retrieving audit movements...</td></tr>';
    movementsModal.classList.remove('hidden');

    try {
      const res = await fetch(`/api/products/${productId}/movements`, {
        headers: { Authorization: `Bearer ${activeSession.access_token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to retrieve inventory movement logs.');
      }

      const data = await res.json();
      const movements = data.movements || [];

      if (data.product) {
        movementProdName.textContent = data.product.name;
        movementProdStock.textContent = `${data.product.current_stock} units`;
      }

      if (movements.length === 0) {
        movementsTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--color-secondary); font-style: italic;">No logged stock movements recorded for this product yet.</td></tr>';
        return;
      }

      movementsTbody.innerHTML = movements.map(m => {
        const dateStr = m.created_at ? new Date(m.created_at).toLocaleString() : '-';
        const isPositive = Number(m.quantity_change) > 0;
        const deltaFormatted = isPositive ? `+${m.quantity_change}` : `${m.quantity_change}`;
        const deltaColor = isPositive ? 'var(--color-success)' : 'var(--color-danger)';

        let pillClass = 'status-pill-secondary';
        if (m.movement_type === 'sale') pillClass = 'outofstock';
        else if (m.movement_type === 'purchase' || m.movement_type === 'receive') pillClass = 'instock';
        else if (m.movement_type === 'initial') pillClass = 'ordered';

        return `
          <tr>
            <td style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--color-secondary);">${escapeHtml(dateStr)}</td>
            <td><span class="status-pill ${pillClass}">${escapeHtml(m.movement_type || '-')}</span></td>
            <td class="mono tabular-nums font-semibold" style="color: ${deltaColor};">${deltaFormatted}</td>
            <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--color-secondary);">${escapeHtml(m.reference_type || 'manual')}</td>
            <td style="font-size: 0.84rem;">${escapeHtml(m.reason || 'Inventory transaction recorded')}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error fetching movements:', err);
      movementsTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--color-danger);">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function closeMovementsModal() {
    movementsModal.classList.add('hidden');
  }

  btnCloseMovementsModal.addEventListener('click', closeMovementsModal);
  btnDismissMovements.addEventListener('click', closeMovementsModal);

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
  // STAGE 6.1: DASHBOARD ANALYTICS & VISUALIZATION
  // =========================================================================
  async function loadDashboard(businessId, days = null) {
    if (!activeSession || !businessId) return;

    // Load inventory intelligence and demand insights in parallel with dashboard analytics
    loadIntelligence(businessId);
    loadDemandInsights(businessId);

    const selectedDays = days || (dashboardPeriodSelect ? dashboardPeriodSelect.value : '30');
    if (dashboardLoadingState) dashboardLoadingState.classList.remove('hidden');
    if (dashboardErrorAlert) dashboardErrorAlert.classList.add('hidden');

    try {
      const res = await fetch(`/api/analytics/dashboard?businessId=${businessId}&days=${selectedDays}`, {
        headers: { Authorization: `Bearer ${activeSession.access_token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      cachedAnalytics = data;
      const currency = data.business?.currency || (activeBusiness ? activeBusiness.currency : 'INR');

      // Update Context Bar
      const now = new Date();
      const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (dashboardDateContext) {
        dashboardDateContext.textContent = `Real-time intelligence for ${monthYear} • All monetary metrics in ${currency} ${getCurrencySymbol(currency)}`;
      }
      if (dashboardLastUpdated) {
        dashboardLastUpdated.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }

      // Update 4 KPI Cards
      if (dashKpiValuation) dashKpiValuation.textContent = formatCurrency(data.summary.inventory_cost_value, currency);
      if (dashKpiUnits) dashKpiUnits.textContent = Number(data.summary.total_units_on_hand || 0).toLocaleString();
      if (dashKpiLowStock) dashKpiLowStock.textContent = `${data.summary.low_stock_count || 0} Items`;
      if (dashKpiOutOfStock) dashKpiOutOfStock.textContent = Number(data.summary.out_of_stock_count || 0).toLocaleString();
      if (dashKpiMonthlySales) dashKpiMonthlySales.textContent = formatCurrency(data.summary.monthly_sales_revenue, currency);
      if (dashKpiMonthlyOrders) dashKpiMonthlyOrders.textContent = Number(data.summary.monthly_sales_count || 0).toLocaleString();
      if (dashKpiActiveSkus) dashKpiActiveSkus.textContent = Number(data.summary.active_products || 0).toLocaleString();
      if (dashKpiTotalSkus) dashKpiTotalSkus.textContent = Number(data.summary.total_products || 0).toLocaleString();

      // Render Trend Chart
      renderTrendChart(data.trend, currency);

      // Render Critical Low Stock Table
      renderCriticalStockTable(data.critical_stock, currency);

      // Render Recent Activity Feed
      renderRecentActivity(data.recent_activity, currency);

      if (dashboardContent) dashboardContent.classList.remove('hidden');
    } catch (err) {
      console.error('Failed to load dashboard analytics:', err);
      if (dashboardErrorText) dashboardErrorText.textContent = err.message || 'Failed to aggregate dashboard analytics.';
      if (dashboardErrorAlert) dashboardErrorAlert.classList.remove('hidden');
    } finally {
      if (dashboardLoadingState) dashboardLoadingState.classList.add('hidden');
    }
  }

  function renderTrendChart(trend, currencyCode = 'INR') {
    if (!dashboardTrendChartWrap) return;

    if (!trend || !trend.series || trend.series.length === 0) {
      dashboardTrendChartWrap.innerHTML = '';
      if (dashboardChartEmpty) dashboardChartEmpty.classList.remove('hidden');
      return;
    }

    const series = trend.series;
    const hasData = series.some(d => d.sales_amount > 0 || d.purchases_amount > 0);
    if (!hasData) {
      dashboardTrendChartWrap.innerHTML = '';
      if (dashboardChartEmpty) dashboardChartEmpty.classList.remove('hidden');
      return;
    }

    if (dashboardChartEmpty) dashboardChartEmpty.classList.add('hidden');

    const width = 800;
    const height = 240;
    const padTop = 20;
    const padBottom = 35;
    const padLeft = 65;
    const padRight = 20;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    const maxValRaw = Math.max(...series.map(d => Math.max(d.sales_amount, d.purchases_amount)));
    const mag = Math.pow(10, Math.floor(Math.log10(maxValRaw || 1)));
    const maxVal = Math.max(100, Math.ceil((maxValRaw || 100) / mag) * mag);
    const sym = getCurrencySymbol(currencyCode).replace(/[()]/g, '');

    // 4 Y-axis gridlines
    const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];
    let gridLinesSvg = '';
    yTicks.forEach(tickVal => {
      const y = padTop + plotHeight - (tickVal / maxVal) * plotHeight;
      const formattedTick = tickVal >= 1000 ? `${sym}${Math.round(tickVal / 1000)}k` : `${sym}${Math.round(tickVal)}`;
      gridLinesSvg += `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="chart-grid-line" />
        <text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${formattedTick}</text>
      `;
    });

    // Calculate points
    const salesPoints = [];
    const purchasesPoints = [];
    const stepX = series.length > 1 ? plotWidth / (series.length - 1) : plotWidth;

    series.forEach((d, idx) => {
      const x = padLeft + idx * stepX;
      const ySales = padTop + plotHeight - (d.sales_amount / maxVal) * plotHeight;
      const yPurchases = padTop + plotHeight - (d.purchases_amount / maxVal) * plotHeight;
      salesPoints.push({ x, y: ySales, data: d });
      purchasesPoints.push({ x, y: yPurchases, data: d });
    });

    const salesLineD = salesPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
    const salesAreaD = `${salesLineD} L ${salesPoints[salesPoints.length - 1].x.toFixed(1)} ${padTop + plotHeight} L ${padLeft} ${padTop + plotHeight} Z`;
    const purchasesLineD = purchasesPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');

    const labelInterval = series.length > 14 ? Math.ceil(series.length / 7) : 1;
    let xLabelsSvg = '';
    series.forEach((d, idx) => {
      if (idx % labelInterval === 0 || idx === series.length - 1) {
        const x = padLeft + idx * stepX;
        xLabelsSvg += `<text x="${x}" y="${height - 12}" text-anchor="middle" class="chart-axis-label">${escapeHtml(d.label)}</text>`;
      }
    });

    let circlesSvg = '';
    salesPoints.forEach((pt) => {
      circlesSvg += `
        <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3" fill="#2563EB" stroke="#FFFFFF" stroke-width="1.5" class="chart-data-point"
          data-date="${escapeHtml(pt.data.date)}"
          data-sales="${pt.data.sales_amount}"
          data-orders="${pt.data.sales_count}"
          data-purchases="${pt.data.purchases_amount}" />
      `;
    });

    dashboardTrendChartWrap.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="trend-svg-chart" role="img" aria-label="Sales and Procurement Trend Chart">
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2563EB" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#2563EB" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridLinesSvg}
        <path d="${salesAreaD}" fill="url(#salesGradient)" />
        <path d="${purchasesLineD}" fill="none" stroke="#6366F1" stroke-width="2" stroke-dasharray="4 3" />
        <path d="${salesLineD}" fill="none" stroke="#2563EB" stroke-width="2.5" />
        ${xLabelsSvg}
        ${circlesSvg}
      </svg>
      <div class="chart-tooltip hidden"></div>
    `;

    const tooltip = dashboardTrendChartWrap.querySelector('.chart-tooltip');
    const points = dashboardTrendChartWrap.querySelectorAll('.chart-data-point');

    points.forEach(pt => {
      pt.addEventListener('mouseenter', () => {
        const date = pt.dataset.date;
        const sales = formatCurrency(pt.dataset.sales, currencyCode);
        const orders = pt.dataset.orders;
        const purchases = formatCurrency(pt.dataset.purchases, currencyCode);

        tooltip.innerHTML = `
          <div style="font-weight: 700; margin-bottom: 2px;">${escapeHtml(date)}</div>
          <div style="color: #93C5FD;">Sales: ${sales} (${orders} orders)</div>
          <div style="color: #C7D2FE;">Purchases: ${purchases}</div>
        `;

        const rect = dashboardTrendChartWrap.getBoundingClientRect();
        const ptRect = pt.getBoundingClientRect();
        tooltip.style.left = `${ptRect.left - rect.left + ptRect.width / 2}px`;
        tooltip.style.top = `${ptRect.top - rect.top}px`;
        tooltip.classList.remove('hidden');
      });

      pt.addEventListener('mouseleave', () => {
        tooltip.classList.add('hidden');
      });
    });
  }

  function renderCriticalStockTable(items, currencyCode = 'INR') {
    if (!dashboardLowStockTbody) return;

    if (!items || items.length === 0) {
      if (dashboardLowStockWrap) dashboardLowStockWrap.classList.add('hidden');
      if (dashboardLowStockEmpty) dashboardLowStockEmpty.classList.remove('hidden');
      return;
    }

    if (dashboardLowStockEmpty) dashboardLowStockEmpty.classList.add('hidden');
    if (dashboardLowStockWrap) dashboardLowStockWrap.classList.remove('hidden');

    dashboardLowStockTbody.innerHTML = items.map(item => {
      const isOut = item.current_stock === 0;
      const statusPill = isOut
        ? '<span class="status-pill cancelled" style="font-size: 0.7rem;">Depleted</span>'
        : '<span class="status-pill low-stock" style="font-size: 0.7rem;">Low Stock</span>';

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--color-text-main);">${escapeHtml(item.name)}</div>
            <div style="font-size: 0.72rem; color: var(--color-text-secondary);"><span class="prod-sku-cell">${escapeHtml(item.sku || '-')}</span> • ${escapeHtml(item.category)}</div>
          </td>
          <td class="mono tabular-nums" style="text-align: right; font-weight: 700; color: ${isOut ? 'var(--color-danger)' : 'var(--color-warning)'};">
            ${item.current_stock}
          </td>
          <td class="mono tabular-nums text-muted" style="text-align: right;">
            ${item.reorder_level}
          </td>
          <td class="mono tabular-nums" style="text-align: right; color: var(--color-danger); font-weight: 600;">
            -${item.stock_deficit} ${escapeHtml(item.unit)}
          </td>
          <td style="text-align: center;">
            ${statusPill}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderRecentActivity(activity, currencyCode = 'INR') {
    if (!dashboardRecentActivityList) return;

    if (!activity || activity.length === 0) {
      dashboardRecentActivityList.innerHTML = '';
      if (dashboardActivityEmpty) dashboardActivityEmpty.classList.remove('hidden');
      return;
    }

    if (dashboardActivityEmpty) dashboardActivityEmpty.classList.add('hidden');

    dashboardRecentActivityList.innerHTML = activity.map(item => {
      const isSale = item.type === 'sale';
      const badgeClass = isSale ? 'activity-badge sale' : 'activity-badge purchase';
      const badgeText = isSale ? 'SALE' : 'PURCHASE';
      const dateFormatted = item.date ? new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

      return `
        <div class="activity-feed-item">
          <div class="activity-feed-left">
            <span class="${badgeClass}">${badgeText}</span>
            <div>
              <div class="activity-ref">${escapeHtml(item.reference_number)}</div>
              <div class="activity-sub">${escapeHtml(item.party_name)}</div>
            </div>
          </div>
          <div class="activity-feed-right">
            <div class="activity-amount mono tabular-nums">${formatCurrency(item.amount, currencyCode)}</div>
            <div class="activity-date">${escapeHtml(dateFormatted)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Dashboard Controls Event Listeners
  if (btnRefreshDashboard) {
    btnRefreshDashboard.addEventListener('click', async () => {
      if (activeBusiness) {
        await Promise.all([
          loadDashboard(activeBusiness.id),
          loadIntelligence(activeBusiness.id),
          loadDemandInsights(activeBusiness.id)
        ]);
        showAlert('Dashboard analytics, inventory intelligence, and demand insights refreshed.', 'success');
      }
    });
  }

  if (dashboardPeriodSelect) {
    dashboardPeriodSelect.addEventListener('change', () => {
      if (activeBusiness) {
        loadDashboard(activeBusiness.id, dashboardPeriodSelect.value);
      }
    });
  }

  if (btnRetryDashboard) {
    btnRetryDashboard.addEventListener('click', () => {
      if (activeBusiness) {
        loadDashboard(activeBusiness.id);
      }
    });
  }

  if (btnDashViewInventory) {
    btnDashViewInventory.addEventListener('click', () => {
      switchModule('inventory');
    });
  }

  if (btnDashViewSales) {
    btnDashViewSales.addEventListener('click', () => {
      switchModule('sales');
    });
  }

  if (btnDashViewPurchases) {
    btnDashViewPurchases.addEventListener('click', () => {
      switchModule('purchases');
    });
  }

  // =========================================================================
  // STAGE 6.2.3: INVENTORY INTELLIGENCE & RESTOCK PLANNING ENGINE
  // =========================================================================
  async function loadIntelligence(businessId, windowDays = null, targetDays = null) {
    if (!activeSession || !businessId) return;

    const wDays = windowDays || (intelWindowSelect ? intelWindowSelect.value : '30');
    const tDays = targetDays || (intelTargetSelect ? intelTargetSelect.value : '30');

    if (intelLoadingState) intelLoadingState.classList.remove('hidden');
    if (intelErrorAlert) intelErrorAlert.classList.add('hidden');
    if (intelEmptyCatalog) intelEmptyCatalog.classList.add('hidden');
    if (intelEmptyRestock) intelEmptyRestock.classList.add('hidden');
    if (intelEmptyFilter) intelEmptyFilter.classList.add('hidden');

    const reqId = ++intelligenceRequestId;

    try {
      const res = await fetch(`/api/analytics/intelligence?businessId=${encodeURIComponent(businessId)}&windowDays=${encodeURIComponent(wDays)}&targetDays=${encodeURIComponent(tDays)}`, {
        headers: { Authorization: `Bearer ${activeSession.access_token}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Guard against stale response or race conditions when switching businesses
      if (reqId !== intelligenceRequestId || !activeBusiness || activeBusiness.id !== businessId) {
        return;
      }

      cachedIntelligence = data;
      const currency = data.currency || (activeBusiness ? activeBusiness.currency : 'INR');

      // Update Synchronized Timestamp
      const now = new Date();
      if (intelLastUpdated) {
        intelLastUpdated.textContent = `Sync ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }

      // Update Summary Cards
      if (intelSummaryDepleted) {
        intelSummaryDepleted.textContent = Number(data.summary?.critical_depleted_count || 0).toLocaleString();
      }
      if (intelSummaryHighRisk) {
        intelSummaryHighRisk.textContent = Number(data.summary?.high_risk_count || 0).toLocaleString();
      }
      if (intelSummaryModerateRisk) {
        intelSummaryModerateRisk.textContent = Number(data.summary?.moderate_risk_count || 0).toLocaleString();
      }
      if (intelSummaryInsufficientData) {
        intelSummaryInsufficientData.textContent = Number(data.summary?.insufficient_data_count || 0).toLocaleString();
      }
      if (intelSummaryReorderCost) {
        intelSummaryReorderCost.textContent = formatCurrency(data.summary?.total_estimated_reorder_cost || 0, currency);
      }

      renderIntelligenceTable();
    } catch (err) {
      if (reqId !== intelligenceRequestId) return;
      console.error('Failed to load inventory intelligence:', err);
      if (intelErrorText) {
        intelErrorText.textContent = err.message || 'Failed to evaluate inventory intelligence.';
      }
      if (intelErrorAlert) intelErrorAlert.classList.remove('hidden');
    } finally {
      if (reqId === intelligenceRequestId && intelLoadingState) {
        intelLoadingState.classList.add('hidden');
      }
    }
  }

  function renderIntelligenceTable() {
    if (!intelTbody) return;

    if (!cachedIntelligence || !cachedIntelligence.recommendations) {
      intelTbody.innerHTML = '';
      return;
    }

    const recs = cachedIntelligence.recommendations;
    const currency = cachedIntelligence.currency || (activeBusiness ? activeBusiness.currency : 'INR');

    // Update Tab Count Badges from full recommendations set
    const totalAll = recs.length;
    const countCritical = recs.filter(r => r.intelligence && (r.intelligence.risk_category === 'CRITICAL_DEPLETED' || r.intelligence.risk_category === 'HIGH_RISK')).length;
    const countModerate = recs.filter(r => r.intelligence && r.intelligence.risk_category === 'MODERATE_RISK').length;
    const countHealthy = recs.filter(r => r.intelligence && r.intelligence.risk_category === 'HEALTHY').length;
    const countInsufficient = recs.filter(r => r.intelligence && r.intelligence.risk_category === 'INSUFFICIENT_DATA').length;

    if (intelCountAll) intelCountAll.textContent = totalAll;
    if (intelCountCritical) intelCountCritical.textContent = countCritical;
    if (intelCountModerate) intelCountModerate.textContent = countModerate;
    if (intelCountHealthy) intelCountHealthy.textContent = countHealthy;
    if (intelCountInsufficient) intelCountInsufficient.textContent = countInsufficient;

    // Filter Recommendations
    const filtered = recs.filter(r => {
      const risk = r.intelligence ? r.intelligence.risk_category : '';

      if (currentIntelligenceFilter === 'critical') {
        if (risk !== 'CRITICAL_DEPLETED' && risk !== 'HIGH_RISK') return false;
      } else if (currentIntelligenceFilter === 'moderate') {
        if (risk !== 'MODERATE_RISK') return false;
      } else if (currentIntelligenceFilter === 'healthy') {
        if (risk !== 'HEALTHY') return false;
      } else if (currentIntelligenceFilter === 'insufficient') {
        if (risk !== 'INSUFFICIENT_DATA') return false;
      }

      if (currentIntelligenceSearch) {
        const q = currentIntelligenceSearch;
        const nameMatch = (r.name || '').toLowerCase().includes(q);
        const skuMatch = (r.sku || '').toLowerCase().includes(q);
        const catMatch = (r.category || '').toLowerCase().includes(q);
        if (!nameMatch && !skuMatch && !catMatch) return false;
      }

      return true;
    });

    // Handle Empty States
    if (intelEmptyCatalog) intelEmptyCatalog.classList.add('hidden');
    if (intelEmptyRestock) intelEmptyRestock.classList.add('hidden');
    if (intelEmptyFilter) intelEmptyFilter.classList.add('hidden');
    if (intelTable) intelTable.classList.remove('hidden');
    if (intelTableContainer) intelTableContainer.classList.remove('hidden');

    if (totalAll === 0) {
      intelTbody.innerHTML = '';
      if (intelEmptyCatalog) intelEmptyCatalog.classList.remove('hidden');
      if (intelTable) intelTable.classList.add('hidden');
      if (intelTableContainer) intelTableContainer.classList.add('hidden');
      return;
    }

    if (filtered.length === 0) {
      intelTbody.innerHTML = '';
      if (intelTable) intelTable.classList.add('hidden');
      if (intelTableContainer) intelTableContainer.classList.add('hidden');
      if (currentIntelligenceFilter === 'all' && !currentIntelligenceSearch) {
        if (intelEmptyRestock) intelEmptyRestock.classList.remove('hidden');
      } else {
        if (intelEmptyFilter) intelEmptyFilter.classList.remove('hidden');
      }
      return;
    }

    // Render Table Rows
    intelTbody.innerHTML = filtered.map(rec => {
      const stock = Number(rec.current_stock || 0);
      const minStock = Number(rec.minimum_stock || 0);
      const incoming = Number(rec.incoming_stock || 0);
      const metrics = rec.metrics || {};
      const intel = rec.intelligence || {};
      const risk = intel.risk_category || 'HEALTHY';

      // Stock Runway Representation (Null safety: explain why uncalibrated)
      let runwayHtml = '';
      if (metrics.days_of_stock_remaining === 0) {
        runwayHtml = `<span class="runway-val depleted">0.0 days</span>`;
      } else if (metrics.days_of_stock_remaining === null || metrics.days_of_stock_remaining === undefined) {
        if (!metrics.has_sufficient_history) {
          runwayHtml = `<span class="runway-val uncalibrated" title="Catalog age < 14d or < 2 orders">— (Uncalibrated)</span>`;
        } else {
          runwayHtml = `<span class="runway-val zero-velocity" title="Zero sales velocity">— (No sales)</span>`;
        }
      } else {
        const days = Number(metrics.days_of_stock_remaining);
        if (days <= 7) {
          runwayHtml = `<span class="runway-val high">${days.toFixed(1)} days</span>`;
        } else if (days <= 14) {
          runwayHtml = `<span class="runway-val moderate">${days.toFixed(1)} days</span>`;
        } else {
          runwayHtml = `<span class="runway-val healthy">${days.toFixed(1)} days</span>`;
        }
      }

      // Risk Classification Badge
      let riskBadgeClass = 'healthy';
      let riskBadgeLabel = 'HEALTHY';
      if (risk === 'CRITICAL_DEPLETED') {
        riskBadgeClass = 'critical';
        riskBadgeLabel = 'CRITICAL DEPLETED';
      } else if (risk === 'HIGH_RISK') {
        riskBadgeClass = 'high';
        riskBadgeLabel = 'HIGH RISK';
      } else if (risk === 'MODERATE_RISK') {
        riskBadgeClass = 'moderate';
        riskBadgeLabel = 'MODERATE RISK';
      } else if (risk === 'INSUFFICIENT_DATA') {
        riskBadgeClass = 'calibrating';
        riskBadgeLabel = 'CALIBRATING';
      }

      // Demand Trend
      let trendHtml = '<span class="trend-badge trend-low">— Low Volume</span>';
      if (metrics.demand_trend === 'ACCELERATING') {
        trendHtml = '<span class="trend-badge trend-up">↑ Accelerating</span>';
      } else if (metrics.demand_trend === 'DECELERATING') {
        trendHtml = '<span class="trend-badge trend-down">↓ Decelerating</span>';
      } else if (metrics.demand_trend === 'STEADY') {
        trendHtml = '<span class="trend-badge trend-steady">→ Steady</span>';
      }

      // Suggested Reorder & Valuation
      let reorderHtml = '';
      if (intel.suggested_reorder_qty > 0) {
        reorderHtml = `
          <div class="reorder-suggested-val">+${intel.suggested_reorder_qty} units</div>
          <div class="reorder-cost-val">${formatCurrency(intel.estimated_reorder_cost, currency)}</div>
        `;
      } else {
        reorderHtml = `<span class="text-muted" style="font-size: 0.78rem;">0 units (Adequate)</span>`;
      }

      // Restock Action Button
      let actionHtml = '';
      if (intel.suggested_reorder_qty > 0) {
        actionHtml = `
          <button type="button" class="btn btn-primary btn-sm btn-intel-restock"
            data-product-id="${escapeHtml(rec.product_id)}"
            data-suggested-qty="${intel.suggested_reorder_qty}"
            data-unit-cost="${rec.unit_cost || 0}"
            title="Create procurement purchase order prefilled for this item">
            Restock
          </button>
        `;
      } else {
        actionHtml = `<span class="text-muted" style="font-size: 0.75rem;">Adequate</span>`;
      }

      // Inbound PO Pill
      const inboundHtml = incoming > 0
        ? `<span class="inbound-po-pill">+${incoming} in transit</span>`
        : `<span class="text-muted">—</span>`;

      // On-Hand Style
      const isDepleted = stock <= 0;
      const isLow = stock <= minStock;
      const stockColorClass = isDepleted ? 'text-danger font-semibold' : (isLow ? 'warning font-semibold' : '');

      return `
        <tr data-product-id="${escapeHtml(rec.product_id)}">
          <td>
            <div style="font-weight: 700; color: var(--color-text-main);">${escapeHtml(rec.name)}</div>
            <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.15rem;">
              <span class="preview-sku-badge">${escapeHtml(rec.sku || 'NO-SKU')}</span>
              <span style="font-size: 0.74rem; color: var(--color-text-secondary);">${escapeHtml(rec.category || 'General')}</span>
            </div>
          </td>
          <td class="mono tabular-nums" style="text-align: right;">
            <span class="${stockColorClass}">${stock}</span>
            <span class="text-muted" style="font-size: 0.74rem;">/ min ${minStock}</span>
          </td>
          <td class="mono tabular-nums" style="text-align: right;">
            ${inboundHtml}
          </td>
          <td class="mono tabular-nums" style="text-align: right;">
            <div>${metrics.units_sold_window || 0} units</div>
            <div style="font-size: 0.72rem; color: var(--color-text-secondary);">${Number(metrics.average_daily_sales || 0).toFixed(1)}/day</div>
          </td>
          <td style="text-align: right;">
            ${runwayHtml}
          </td>
          <td style="text-align: center;">
            ${trendHtml}
          </td>
          <td>
            <div class="intel-advisory-box">
              <span class="risk-badge ${riskBadgeClass}">${riskBadgeLabel}</span>
              <div class="intel-advisory-expl">${escapeHtml(intel.explanation || '')}</div>
            </div>
          </td>
          <td style="text-align: right;">
            ${reorderHtml}
          </td>
          <td style="text-align: right;">
            ${actionHtml}
          </td>
        </tr>
      `;
    }).join('');

    // Wire Restock Action Buttons
    intelTbody.querySelectorAll('.btn-intel-restock').forEach(btn => {
      btn.addEventListener('click', async () => {
        const productId = btn.dataset.productId;
        const suggestedQty = Number(btn.dataset.suggestedQty || 1);
        const unitCost = Number(btn.dataset.unitCost || 0);

        // Preload products & suppliers if not yet in cache
        if (!cachedProducts || cachedProducts.length === 0) {
          if (activeBusiness) await loadInventory(activeBusiness.id);
        }
        if (!cachedSuppliers || cachedSuppliers.length === 0) {
          if (activeBusiness) await loadSuppliers(activeBusiness.id);
        }

        openPurchaseModal({
          productId,
          quantity: suggestedQty,
          unitCost
        });
      });
    });
  }

  // Filter Tab Handlers
  function setIntelligenceFilter(filterName, activeTabEl) {
    currentIntelligenceFilter = filterName;
    const tabs = [intelFilterAll, intelFilterCritical, intelFilterModerate, intelFilterHealthy, intelFilterInsufficient];
    tabs.forEach(tab => {
      if (tab) {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
      }
    });
    if (activeTabEl) {
      activeTabEl.classList.add('active');
      activeTabEl.setAttribute('aria-selected', 'true');
    }
    renderIntelligenceTable();
  }

  if (intelFilterAll) intelFilterAll.addEventListener('click', () => setIntelligenceFilter('all', intelFilterAll));
  if (intelFilterCritical) intelFilterCritical.addEventListener('click', () => setIntelligenceFilter('critical', intelFilterCritical));
  if (intelFilterModerate) intelFilterModerate.addEventListener('click', () => setIntelligenceFilter('moderate', intelFilterModerate));
  if (intelFilterHealthy) intelFilterHealthy.addEventListener('click', () => setIntelligenceFilter('healthy', intelFilterHealthy));
  if (intelFilterInsufficient) intelFilterInsufficient.addEventListener('click', () => setIntelligenceFilter('insufficient', intelFilterInsufficient));

  if (intelSearchInput) {
    intelSearchInput.addEventListener('input', (e) => {
      currentIntelligenceSearch = (e.target.value || '').trim().toLowerCase();
      renderIntelligenceTable();
    });
  }

  // Intelligence Controls
  if (intelWindowSelect) {
    intelWindowSelect.addEventListener('change', () => {
      if (activeBusiness) {
        loadIntelligence(activeBusiness.id, intelWindowSelect.value, intelTargetSelect ? intelTargetSelect.value : '30');
      }
    });
  }

  if (intelTargetSelect) {
    intelTargetSelect.addEventListener('change', () => {
      if (activeBusiness) {
        loadIntelligence(activeBusiness.id, intelWindowSelect ? intelWindowSelect.value : '30', intelTargetSelect.value);
      }
    });
  }

  if (btnRefreshIntel) {
    btnRefreshIntel.addEventListener('click', async () => {
      if (activeBusiness) {
        await loadIntelligence(activeBusiness.id, intelWindowSelect ? intelWindowSelect.value : '30', intelTargetSelect ? intelTargetSelect.value : '30');
        showAlert('Inventory intelligence refreshed.', 'success');
      }
    });
  }

  if (btnRetryIntel) {
    btnRetryIntel.addEventListener('click', () => {
      if (activeBusiness) {
        loadIntelligence(activeBusiness.id, intelWindowSelect ? intelWindowSelect.value : '30', intelTargetSelect ? intelTargetSelect.value : '30');
      }
    });
  }

  // =========================================================================
  // STAGE 7.1: AI INVENTORY ANALYST ENGINE
  // =========================================================================
  function resetAiInsightsUI() {
    cachedAiInsights = null;
    if (aiInsightsIdleState) aiInsightsIdleState.classList.remove('hidden');
    if (aiInsightsContent) aiInsightsContent.classList.add('hidden');
    if (aiInsightsLoadingState) aiInsightsLoadingState.classList.add('hidden');
    if (aiInsightsErrorAlert) aiInsightsErrorAlert.classList.add('hidden');
    if (btnGenerateAiInsights) {
      btnGenerateAiInsights.disabled = false;
      const btnSpan = btnGenerateAiInsights.querySelector('span');
      if (btnSpan) btnSpan.textContent = 'Generate AI Insights';
    }
    if (aiInsightsLastUpdated) {
      aiInsightsLastUpdated.textContent = 'Ready to Analyze';
    }
  }

  async function loadAiInsights(businessId, forceRefresh = false) {
    if (!activeSession || !businessId) return;

    if (!forceRefresh && cachedAiInsights) {
      renderAiInsights(cachedAiInsights, activeBusiness ? activeBusiness.currency : 'INR');
      return;
    }

    if (aiInsightsLoadingState) aiInsightsLoadingState.classList.remove('hidden');
    if (aiInsightsErrorAlert) aiInsightsErrorAlert.classList.add('hidden');
    if (aiInsightsIdleState) aiInsightsIdleState.classList.add('hidden');
    if (btnGenerateAiInsights) btnGenerateAiInsights.disabled = true;

    const reqId = ++aiInsightsRequestId;

    try {
      const res = await fetch('/api/ai/inventory-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeSession.access_token}`
        },
        body: JSON.stringify({ businessId })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || `AI analysis request failed (HTTP ${res.status})`);
      }

      // Guard against stale response or business workspace switch
      if (reqId !== aiInsightsRequestId || !activeBusiness || activeBusiness.id !== businessId) {
        return;
      }

      cachedAiInsights = data.insights;
      renderAiInsights(data.insights, data.currency || (activeBusiness ? activeBusiness.currency : 'INR'), data.metadata);
      showAlert('AI Inventory Insights generated successfully.', 'success');
    } catch (err) {
      if (reqId !== aiInsightsRequestId) return;
      console.error('Failed to generate AI inventory insights:', err);

      if (aiInsightsErrorText) {
        aiInsightsErrorText.textContent = err.message || 'Failed to generate AI inventory insights.';
      }
      if (aiInsightsErrorAlert) aiInsightsErrorAlert.classList.remove('hidden');

      if (!cachedAiInsights && aiInsightsIdleState) {
        aiInsightsIdleState.classList.remove('hidden');
      }
    } finally {
      if (reqId === aiInsightsRequestId) {
        if (aiInsightsLoadingState) aiInsightsLoadingState.classList.add('hidden');
        if (btnGenerateAiInsights) {
          btnGenerateAiInsights.disabled = false;
          const btnSpan = btnGenerateAiInsights.querySelector('span');
          if (btnSpan) btnSpan.textContent = cachedAiInsights ? 'Refresh AI Insights' : 'Generate AI Insights';
        }
      }
    }
  }

  function renderAiInsights(insights, currency = 'INR', metadata = {}) {
    if (!insights) return;

    if (aiInsightsIdleState) aiInsightsIdleState.classList.add('hidden');
    if (aiInsightsErrorAlert) aiInsightsErrorAlert.classList.add('hidden');
    if (aiInsightsContent) aiInsightsContent.classList.remove('hidden');

    // 1. Executive Summary (Safe textContent rendering)
    if (aiInsightsSummary) {
      aiInsightsSummary.textContent = insights.summary || 'Summary unavailable.';
    }

    // 2. Model Badge
    if (aiInsightsModelBadge) {
      const modelName = (metadata && metadata.model) ? metadata.model.toUpperCase() : 'GEMINI 1.5 FLASH';
      aiInsightsModelBadge.textContent = modelName;
    }

    // 3. Timestamp Badge
    if (aiInsightsLastUpdated) {
      const now = new Date();
      aiInsightsLastUpdated.textContent = `Analyzed ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }

    // 4. Prioritized Findings List
    const findings = Array.isArray(insights.findings) ? insights.findings : [];
    if (aiInsightsFindingsCount) {
      aiInsightsFindingsCount.textContent = `${findings.length} Observation${findings.length === 1 ? '' : 's'}`;
    }

    if (aiInsightsFindingsList) {
      aiInsightsFindingsList.innerHTML = '';

      if (findings.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'dash-panel-empty-state';
        emptyDiv.textContent = 'No critical inventory anomalies or restock risks identified.';
        aiInsightsFindingsList.appendChild(emptyDiv);
      } else {
        findings.forEach(f => {
          const card = document.createElement('div');
          const severityClass = (f.severity || 'info').toLowerCase();
          card.className = `ai-finding-card severity-${severityClass}`;

          // Header Row
          const headerRow = document.createElement('div');
          headerRow.className = 'ai-finding-header';

          const titleEl = document.createElement('div');
          titleEl.className = 'ai-finding-title';
          titleEl.textContent = f.title || 'Inventory Finding';

          const badgeEl = document.createElement('span');
          let badgeColorClass = 'cobalt';
          if (f.severity === 'CRITICAL') badgeColorClass = 'critical';
          else if (f.severity === 'HIGH') badgeColorClass = 'high';
          else if (f.severity === 'MODERATE') badgeColorClass = 'moderate';
          else if (f.severity === 'LOW') badgeColorClass = 'healthy';
          badgeEl.className = `risk-badge ${badgeColorClass}`;
          badgeEl.textContent = f.severity || 'INFO';

          headerRow.appendChild(titleEl);
          headerRow.appendChild(badgeEl);
          card.appendChild(headerRow);

          // Evidence Block
          if (f.evidence) {
            const evidenceEl = document.createElement('div');
            evidenceEl.className = 'ai-finding-evidence';
            evidenceEl.textContent = f.evidence;
            card.appendChild(evidenceEl);
          }

          // Explanation
          if (f.explanation) {
            const explEl = document.createElement('div');
            explEl.className = 'ai-finding-explanation';
            explEl.textContent = f.explanation;
            card.appendChild(explEl);
          }

          // Action Row
          if (f.recommended_action) {
            const actionRow = document.createElement('div');
            actionRow.className = 'ai-finding-action-row';

            const actionText = document.createElement('div');
            actionText.className = 'ai-finding-action-text';
            const actionIcon = document.createElement('span');
            actionIcon.textContent = '→ ';
            actionIcon.style.fontWeight = '700';
            actionText.appendChild(actionIcon);
            const actionSpan = document.createElement('span');
            actionSpan.textContent = f.recommended_action;
            actionText.appendChild(actionSpan);
            actionRow.appendChild(actionText);

            // If finding is tied to a specific product that requires restocking, provide a one-click restock CTA
            if (f.product_id) {
              const matchedProduct = cachedProducts.find(p => p.id === f.product_id);
              if (matchedProduct) {
                const restockBtn = document.createElement('button');
                restockBtn.type = 'button';
                restockBtn.className = 'btn btn-primary btn-sm';
                restockBtn.textContent = 'Restock Item';
                restockBtn.title = `Create purchase order for ${matchedProduct.name}`;
                restockBtn.addEventListener('click', () => {
                  openPurchaseModal({
                    productId: matchedProduct.id,
                    quantity: matchedProduct.reorder_level || 1,
                    unitCost: matchedProduct.cost_price || 0
                  });
                });
                actionRow.appendChild(restockBtn);
              }
            }

            card.appendChild(actionRow);
          }

          aiInsightsFindingsList.appendChild(card);
        });
      }
    }

    // 5. Limitations List
    if (aiInsightsLimitations) {
      aiInsightsLimitations.innerHTML = '';
      const limitations = Array.isArray(insights.limitations) ? insights.limitations : [];
      limitations.forEach(lim => {
        const li = document.createElement('li');
        li.textContent = lim;
        aiInsightsLimitations.appendChild(li);
      });
    }
  }

  // AI Inventory Analyst Event Listeners
  if (btnGenerateAiInsights) {
    btnGenerateAiInsights.addEventListener('click', () => {
      if (activeBusiness) {
        loadAiInsights(activeBusiness.id, true);
      }
    });
  }

  if (btnRetryAiInsights) {
    btnRetryAiInsights.addEventListener('click', () => {
      if (activeBusiness) {
        loadAiInsights(activeBusiness.id, true);
      }
    });
  }

  // =========================================================================
  // STAGE 7.3: DEMAND INSIGHTS & SLOW-MOVING STOCK ENGINE
  // =========================================================================
  async function loadDemandInsights(businessId, windowDays = null) {
    if (!activeSession || !businessId) return;

    const wDays = windowDays || (demandWindowSelect ? demandWindowSelect.value : '30');

    if (demandLoadingState) demandLoadingState.classList.remove('hidden');
    if (demandErrorAlert) demandErrorAlert.classList.add('hidden');
    if (demandEmptyCatalog) demandEmptyCatalog.classList.add('hidden');
    if (demandEmptyFilter) demandEmptyFilter.classList.add('hidden');

    const reqId = ++demandRequestId;

    try {
      const res = await fetch(`/api/analytics/demand-insights?businessId=${encodeURIComponent(businessId)}&windowDays=${encodeURIComponent(wDays)}`, {
        headers: { Authorization: `Bearer ${activeSession.access_token}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Guard against stale response or race conditions
      if (reqId !== demandRequestId || !activeBusiness || activeBusiness.id !== businessId) {
        return;
      }

      cachedDemandInsights = data;
      const currency = data.business?.currency || (activeBusiness ? activeBusiness.currency : 'INR');

      // Update Synchronized Timestamp
      const now = new Date();
      if (demandLastUpdated) {
        demandLastUpdated.textContent = `Sync ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      }

      // Update Period Ribbon
      if (demandRecentRange && data.period_context?.recent_period) {
        demandRecentRange.textContent = `${data.period_context.recent_period.start_date} to ${data.period_context.recent_period.end_date}`;
      }
      if (demandPriorRange && data.period_context?.preceding_period) {
        demandPriorRange.textContent = `${data.period_context.preceding_period.start_date} to ${data.period_context.preceding_period.end_date}`;
      }

      // Update Summary Cards
      if (demandSummaryAccelerating) {
        demandSummaryAccelerating.textContent = Number(data.summary?.accelerating_count || 0).toLocaleString();
      }
      if (demandSummaryDecelerating) {
        demandSummaryDecelerating.textContent = Number(data.summary?.decelerating_count || 0).toLocaleString();
      }
      if (demandSummarySlowMoving) {
        demandSummarySlowMoving.textContent = Number(data.summary?.slow_moving_count || 0).toLocaleString();
      }
      if (demandSummaryOverstocked) {
        demandSummaryOverstocked.textContent = Number(data.summary?.overstocked_count || 0).toLocaleString();
      }
      if (demandSummaryExcessCapital) {
        demandSummaryExcessCapital.textContent = `${formatCurrency(data.summary?.total_excess_capital_under_review || 0, currency)} review`;
      }
      if (demandSummaryCalibrating) {
        demandSummaryCalibrating.textContent = Number(data.summary?.calibrating_count || 0).toLocaleString();
      }

      // Update disclaimers dynamically if present
      if (demandDisclaimerPeriods && data.metadata?.disclaimers?.periods) {
        demandDisclaimerPeriods.textContent = data.metadata.disclaimers.periods;
      }
      if (demandDisclaimerOverstock && data.metadata?.disclaimers?.overstock) {
        demandDisclaimerOverstock.textContent = data.metadata.disclaimers.overstock;
      }

      renderDemandTable();
    } catch (err) {
      if (reqId !== demandRequestId) return;
      console.error('Failed to load demand insights:', err);
      if (demandErrorText) {
        demandErrorText.textContent = err.message || 'Failed to calculate demand insights.';
      }
      if (demandErrorAlert) demandErrorAlert.classList.remove('hidden');
    } finally {
      if (reqId === demandRequestId && demandLoadingState) {
        demandLoadingState.classList.add('hidden');
      }
    }
  }

  function renderDemandTable() {
    if (!demandTbody) return;

    if (!cachedDemandInsights || !cachedDemandInsights.items) {
      demandTbody.innerHTML = '';
      return;
    }

    const items = cachedDemandInsights.items;
    const currency = cachedDemandInsights.business?.currency || (activeBusiness ? activeBusiness.currency : 'INR');

    // Update Tab Count Badges from full set
    const totalAll = items.length;
    const countAccel = items.filter(i => i.demand_metrics?.demand_trend === 'ACCELERATING').length;
    const countDecel = items.filter(i => i.demand_metrics?.demand_trend === 'DECELERATING').length;
    const countSlow = items.filter(i => i.velocity_metrics?.is_slow_moving).length;
    const countOverstock = items.filter(i => i.overstock_metrics?.is_overstock).length;
    const countCalib = items.filter(i => i.is_calibrating).length;

    if (demandCountAll) demandCountAll.textContent = totalAll;
    if (demandCountAccel) demandCountAccel.textContent = countAccel;
    if (demandCountDecel) demandCountDecel.textContent = countDecel;
    if (demandCountSlow) demandCountSlow.textContent = countSlow;
    if (demandCountOverstock) demandCountOverstock.textContent = countOverstock;
    if (demandCountCalib) demandCountCalib.textContent = countCalib;

    // Filter Items
    const filtered = items.filter(item => {
      if (currentDemandFilter === 'accel') {
        if (item.demand_metrics?.demand_trend !== 'ACCELERATING') return false;
      } else if (currentDemandFilter === 'decel') {
        if (item.demand_metrics?.demand_trend !== 'DECELERATING') return false;
      } else if (currentDemandFilter === 'slow') {
        if (!item.velocity_metrics?.is_slow_moving) return false;
      } else if (currentDemandFilter === 'overstock') {
        if (!item.overstock_metrics?.is_overstock) return false;
      } else if (currentDemandFilter === 'calib') {
        if (!item.is_calibrating) return false;
      }

      if (currentDemandSearch) {
        const query = currentDemandSearch.toLowerCase();
        const nameMatch = (item.name || '').toLowerCase().includes(query);
        const skuMatch = (item.sku || '').toLowerCase().includes(query);
        const catMatch = (item.category || '').toLowerCase().includes(query);
        if (!nameMatch && !skuMatch && !catMatch) return false;
      }

      return true;
    });

    // Handle Empty States
    if (items.length === 0) {
      if (demandEmptyCatalog) demandEmptyCatalog.classList.remove('hidden');
      if (demandEmptyFilter) demandEmptyFilter.classList.add('hidden');
      if (demandTableContainer) demandTableContainer.classList.add('hidden');
      demandTbody.innerHTML = '';
      return;
    }

    if (filtered.length === 0) {
      if (demandEmptyCatalog) demandEmptyCatalog.classList.add('hidden');
      if (demandEmptyFilter) demandEmptyFilter.classList.remove('hidden');
      if (demandTableContainer) demandTableContainer.classList.add('hidden');
      demandTbody.innerHTML = '';
      return;
    }

    if (demandEmptyCatalog) demandEmptyCatalog.classList.add('hidden');
    if (demandEmptyFilter) demandEmptyFilter.classList.add('hidden');
    if (demandTableContainer) demandTableContainer.classList.remove('hidden');

    demandTbody.innerHTML = filtered.map(item => {
      const dm = item.demand_metrics || {};
      const vm = item.velocity_metrics || {};
      const om = item.overstock_metrics || {};

      // Percentage pill style
      let pillClass = 'neutral';
      if (dm.percentage_change !== null) {
        if (dm.percentage_change > 0) pillClass = 'pos';
        else if (dm.percentage_change < 0) pillClass = 'neg';
      } else if (dm.percentage_change_label && dm.percentage_change_label.startsWith('New Volume')) {
        pillClass = 'pos';
      }

      // Stock health badge
      const isLowStock = item.current_stock <= item.reorder_level;
      const stockColor = item.current_stock === 0 ? 'var(--color-danger, #DC2626)' : (isLowStock ? 'var(--color-warning, #D97706)' : 'var(--color-text-main)');

      // Velocity display
      const turnoverText = dm.turnover_days !== null ? `${dm.turnover_days}d turnover` : (item.current_stock === 0 ? '0 on hand' : 'No recent sales');
      const daysSinceText = item.days_since_last_sale !== null ? `${item.days_since_last_sale}d since last sale` : (dm.recent_units_sold === 0 ? 'No sales in window' : '');

      // Overstock column content
      let overstockHtml = '';
      if (om.is_overstock) {
        overstockHtml = `
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span class="overstock-badge ${om.overstock_severity ? om.overstock_severity.toLowerCase() : 'moderate'}">EXCESS: +${om.excess_units} ${escapeHtml(item.unit)}</span>
              <span class="mono tabular-nums font-semibold" style="font-size: 0.76rem; color: #7C3AED;">${formatCurrency(om.potential_excess_capital, currency)}</span>
            </div>
            <div class="demand-evidence-box">${escapeHtml(om.evidence)}</div>
          </div>
        `;
      } else {
        overstockHtml = `
          <div>
            <span class="overstock-badge normal">ADEQUATE</span>
            <div class="demand-evidence-box" style="color: var(--color-text-muted);">Stock aligns with demand &amp; threshold targets.</div>
          </div>
        `;
      }

      return `
        <tr>
          <td>
            <div style="font-weight: 700; color: var(--color-text-main);">${escapeHtml(item.name)}</div>
            <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem; flex-wrap: wrap;">
              <span class="preview-sku-badge">${escapeHtml(item.sku)}</span>
              <span style="font-size: 0.72rem; color: var(--color-text-muted);">${escapeHtml(item.category || 'General')}</span>
            </div>
          </td>
          <td class="mono tabular-nums" style="text-align: right;">
            <div style="font-weight: 700; color: ${stockColor}; font-size: 0.88rem;">${item.current_stock} <span style="font-size: 0.72rem; font-weight: normal; color: var(--color-text-secondary);">${escapeHtml(item.unit)}</span></div>
            <div style="font-size: 0.72rem; color: var(--color-text-muted);">min ${item.reorder_level}</div>
          </td>
          <td class="mono tabular-nums" style="text-align: right;">
            <div>
              <span style="font-weight: 700; color: var(--color-text-main); font-size: 0.88rem;">${dm.recent_units_sold || 0}</span>
              <span style="font-size: 0.75rem; color: var(--color-text-muted);"> vs ${dm.preceding_units_sold || 0}</span>
            </div>
            <div>
              <span class="demand-change-pill ${pillClass}">${escapeHtml(dm.percentage_change_label || '-')}</span>
            </div>
          </td>
          <td style="text-align: center;">
            <span class="trend-badge ${escapeHtml(dm.trend_badge_class || 'trend-unclassified')}">
              ${escapeHtml(dm.demand_trend_label || 'Unclassified')}
            </span>
          </td>
          <td class="mono tabular-nums" style="text-align: right;">
            <div>
              <span class="velocity-badge velocity-${vm.velocity_status ? vm.velocity_status.toLowerCase() : 'calibrating'}">
                ${escapeHtml(vm.velocity_label || 'Calibrating')}
              </span>
            </div>
            <div style="font-size: 0.74rem; color: var(--color-text-secondary); margin-top: 0.2rem;">
              ${dm.average_daily_sales || 0} ${escapeHtml(item.unit)}/day
            </div>
            <div style="font-size: 0.7rem; color: var(--color-text-muted);">
              ${escapeHtml(turnoverText)}
            </div>
            ${daysSinceText ? `<div style="font-size: 0.68rem; color: var(--color-text-subtle);">${escapeHtml(daysSinceText)}</div>` : ''}
          </td>
          <td>
            ${overstockHtml}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Filter Tab Handler
  function setDemandFilter(filterName, activeTabEl) {
    currentDemandFilter = filterName;
    const tabs = [demandFilterAll, demandFilterAccel, demandFilterDecel, demandFilterSlow, demandFilterOverstock, demandFilterCalib];
    tabs.forEach(tab => {
      if (tab) {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
      }
    });
    if (activeTabEl) {
      activeTabEl.classList.add('active');
      activeTabEl.setAttribute('aria-selected', 'true');
    }
    renderDemandTable();
  }

  if (demandFilterAll) demandFilterAll.addEventListener('click', () => setDemandFilter('all', demandFilterAll));
  if (demandFilterAccel) demandFilterAccel.addEventListener('click', () => setDemandFilter('accel', demandFilterAccel));
  if (demandFilterDecel) demandFilterDecel.addEventListener('click', () => setDemandFilter('decel', demandFilterDecel));
  if (demandFilterSlow) demandFilterSlow.addEventListener('click', () => setDemandFilter('slow', demandFilterSlow));
  if (demandFilterOverstock) demandFilterOverstock.addEventListener('click', () => setDemandFilter('overstock', demandFilterOverstock));
  if (demandFilterCalib) demandFilterCalib.addEventListener('click', () => setDemandFilter('calib', demandFilterCalib));

  if (demandSearchInput) {
    demandSearchInput.addEventListener('input', (e) => {
      currentDemandSearch = (e.target.value || '').trim().toLowerCase();
      renderDemandTable();
    });
  }

  // Demand Controls
  if (demandWindowSelect) {
    demandWindowSelect.addEventListener('change', () => {
      if (activeBusiness) {
        loadDemandInsights(activeBusiness.id, demandWindowSelect.value);
      }
    });
  }

  if (btnRefreshDemand) {
    btnRefreshDemand.addEventListener('click', async () => {
      if (activeBusiness) {
        await loadDemandInsights(activeBusiness.id, demandWindowSelect ? demandWindowSelect.value : '30');
        showAlert('Demand insights and velocity analysis refreshed.', 'success');
      }
    });
  }

  if (btnRetryDemand) {
    btnRetryDemand.addEventListener('click', () => {
      if (activeBusiness) {
        loadDemandInsights(activeBusiness.id, demandWindowSelect ? demandWindowSelect.value : '30');
      }
    });
  }

  // =========================================================================
  // STAGE 6.1: MODULE NAVIGATION (DASHBOARD, INVENTORY, SALES, PURCHASES)
  // =========================================================================
  function switchModule(moduleName) {
    currentModule = moduleName;
    if (navTabDashboard) navTabDashboard.classList.remove('active');
    navTabInventory.classList.remove('active');
    navTabSales.classList.remove('active');
    navTabPurchases.classList.remove('active');
    if (moduleDashboard) moduleDashboard.classList.add('hidden');
    moduleInventory.classList.add('hidden');
    moduleSales.classList.add('hidden');
    modulePurchases.classList.add('hidden');

    if (moduleName === 'dashboard') {
      if (navTabDashboard) navTabDashboard.classList.add('active');
      if (moduleDashboard) moduleDashboard.classList.remove('hidden');
      if (activeBusiness) loadDashboard(activeBusiness.id);
    } else if (moduleName === 'inventory') {
      navTabInventory.classList.add('active');
      moduleInventory.classList.remove('hidden');
      if (activeBusiness) loadInventory(activeBusiness.id);
    } else if (moduleName === 'sales') {
      navTabSales.classList.add('active');
      moduleSales.classList.remove('hidden');
      if (activeBusiness) loadSales(activeBusiness.id);
    } else if (moduleName === 'purchases') {
      navTabPurchases.classList.add('active');
      modulePurchases.classList.remove('hidden');
      if (activeBusiness) loadPurchases(activeBusiness.id);
    }
  }

  if (navTabDashboard) navTabDashboard.addEventListener('click', () => switchModule('dashboard'));
  navTabInventory.addEventListener('click', () => switchModule('inventory'));
  navTabSales.addEventListener('click', () => switchModule('sales'));
  navTabPurchases.addEventListener('click', () => switchModule('purchases'));

  function buildProductSelectOptions(type = 'sale') {
    if (!cachedProducts || cachedProducts.length === 0) {
      return '<option value="" disabled>No products in inventory</option>';
    }

    let html = '<option value="">Select a product...</option>';
    cachedProducts.forEach(p => {
      const stock = Number(p.current_stock || 0);
      const price = Number(p.selling_price || 0);
      const cost = Number(p.purchase_price || p.cost_price || 0);
      const currency = activeBusiness ? activeBusiness.currency : 'INR';

      if (type === 'sale') {
        const isOut = stock <= 0;
        const label = `${escapeHtml(p.name)} (Avail: ${stock} | Price: ${formatCurrency(price, currency)})${isOut ? ' [OUT OF STOCK]' : ''}`;
        html += `<option value="${p.id}" data-stock="${stock}" data-price="${price}" data-cost="${cost}" ${isOut ? 'disabled' : ''}>${label}</option>`;
      } else {
        const label = `${escapeHtml(p.name)} (Current: ${stock} | Cost: ${formatCurrency(cost, currency)})`;
        html += `<option value="${p.id}" data-stock="${stock}" data-cost="${cost}" data-price="${price}">${label}</option>`;
      }
    });
    return html;
  }

  // =========================================================================
  // STAGE 5: SALES WORKFLOW
  // =========================================================================
  function addSaleItemRow() {
    const tr = document.createElement('tr');
    tr.className = 'sale-item-row';
    tr.innerHTML = `
      <td>
        <select class="sale-prod-select" required>
          ${buildProductSelectOptions('sale')}
        </select>
      </td>
      <td><span class="sale-avail-badge text-muted">-</span></td>
      <td><input type="number" class="sale-qty-input" min="1" step="1" value="1" required></td>
      <td><input type="number" class="sale-price-input" min="0" step="0.01" value="0.00" required></td>
      <td><span class="sale-line-total">₹0.00</span></td>
      <td><button type="button" class="btn-remove-row" title="Remove row">&times;</button></td>
    `;

    const prodSelect = tr.querySelector('.sale-prod-select');
    const availBadge = tr.querySelector('.sale-avail-badge');
    const qtyInput = tr.querySelector('.sale-qty-input');
    const priceInput = tr.querySelector('.sale-price-input');
    const lineTotalSpan = tr.querySelector('.sale-line-total');
    const removeBtn = tr.querySelector('.btn-remove-row');

    function updateRowTotal() {
      const selectedOption = prodSelect.options[prodSelect.selectedIndex];
      const stock = selectedOption ? Number(selectedOption.dataset.stock || 0) : 0;
      const qty = Number(qtyInput.value || 0);
      const price = Number(priceInput.value || 0);
      const lineTotal = Math.round(qty * price * 100) / 100;
      const currency = activeBusiness ? activeBusiness.currency : 'INR';

      lineTotalSpan.textContent = formatCurrency(lineTotal, currency);

      if (prodSelect.value) {
        if (qty > stock) {
          availBadge.textContent = `${stock} (Exceeds stock!)`;
          availBadge.style.color = '#dc2626';
          availBadge.style.fontWeight = 'bold';
        } else {
          availBadge.textContent = `${stock} in stock`;
          availBadge.style.color = '#16a34a';
          availBadge.style.fontWeight = 'normal';
        }
      } else {
        availBadge.textContent = '-';
        availBadge.style.color = '';
        availBadge.style.fontWeight = '';
      }

      calculateSaleGrandTotal();
    }

    prodSelect.addEventListener('change', () => {
      const selectedOption = prodSelect.options[prodSelect.selectedIndex];
      if (selectedOption && selectedOption.dataset.price) {
        priceInput.value = Number(selectedOption.dataset.price).toFixed(2);
      }
      updateRowTotal();
    });

    qtyInput.addEventListener('input', updateRowTotal);
    priceInput.addEventListener('input', updateRowTotal);

    removeBtn.addEventListener('click', () => {
      if (saleItemsTbody.children.length > 1) {
        tr.remove();
        calculateSaleGrandTotal();
      } else {
        showAlert('A sale must include at least one item.', 'warning', saleModalAlert);
      }
    });

    saleItemsTbody.appendChild(tr);
    updateRowTotal();
  }

  function calculateSaleGrandTotal() {
    let grandTotal = 0;
    const currency = activeBusiness ? activeBusiness.currency : 'INR';

    saleItemsTbody.querySelectorAll('.sale-item-row').forEach(row => {
      const qty = Number(row.querySelector('.sale-qty-input').value || 0);
      const price = Number(row.querySelector('.sale-price-input').value || 0);
      grandTotal += Math.round(qty * price * 100) / 100;
    });

    saleGrandTotal.textContent = formatCurrency(grandTotal, currency);
  }

  async function loadSales(businessId) {
    if (!activeSession || !businessId) return;

    salesTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Loading sales history...</td></tr>';
    salesEmptyState.classList.add('hidden');

    try {
      const res = await fetch(`/api/sales?businessId=${businessId}`, {
        headers: { Authorization: `Bearer ${activeSession.access_token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      cachedSales = data.sales || [];
      updateSalesStats(cachedSales);
      renderSalesTable(cachedSales);
    } catch (err) {
      console.error('Failed to load sales:', err);
      salesTbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Error loading sales: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function updateSalesStats(sales) {
    const currency = activeBusiness ? activeBusiness.currency : 'INR';
    const totalCount = sales.length;
    let totalUnits = 0;
    let totalRevenue = 0;

    sales.forEach(s => {
      totalUnits += Number(s.item_count || 0);
      totalRevenue += Number(s.total_amount || 0);
    });

    statTotalSales.textContent = totalCount.toLocaleString();
    statTotalUnitsSold.textContent = totalUnits.toLocaleString();
    statTotalSalesRevenue.textContent = formatCurrency(totalRevenue, currency);
  }

  function renderSalesTable(sales) {
    const currency = activeBusiness ? activeBusiness.currency : 'INR';
    if (!sales || sales.length === 0) {
      salesTbody.innerHTML = '';
      salesEmptyState.classList.remove('hidden');
      return;
    }

    salesEmptyState.classList.add('hidden');
    salesTbody.innerHTML = sales.map(s => {
      const dateStr = s.sale_date ? new Date(s.sale_date).toLocaleDateString() : '-';
      return `
        <tr>
          <td><span class="prod-sku-cell">${escapeHtml(s.sale_number)}</span></td>
          <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--color-secondary);">${escapeHtml(dateStr)}</td>
          <td><strong>${escapeHtml(s.customer_name || 'Walk-in Customer')}</strong></td>
          <td class="mono tabular-nums">${s.item_count} units</td>
          <td class="mono tabular-nums font-semibold" style="text-align: right;">${formatCurrency(s.total_amount, currency)}</td>
          <td><span class="status-pill completed">${escapeHtml(s.status || 'completed')}</span></td>
          <td style="text-align: right;">
            <button class="btn-action-history btn-view-sale" data-id="${s.id}" aria-label="View manifest for ${escapeHtml(s.sale_number)}">View Manifest</button>
          </td>
        </tr>
      `;
    }).join('');

    salesTbody.querySelectorAll('.btn-view-sale').forEach(btn => {
      btn.addEventListener('click', () => {
        const sale = cachedSales.find(s => s.id === btn.dataset.id);
        if (sale) showTransactionDetails('sale', sale);
      });
    });
  }

  salesSearch.addEventListener('input', () => {
    clearTimeout(salesSearchDebounceTimer);
    salesSearchDebounceTimer = setTimeout(() => {
      const term = salesSearch.value.trim().toLowerCase();
      if (!term) {
        renderSalesTable(cachedSales);
        return;
      }
      const filtered = cachedSales.filter(s =>
        s.sale_number.toLowerCase().includes(term) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(term))
      );
      renderSalesTable(filtered);
    }, 250);
  });

  function openSaleModal() {
    clearAlert(saleModalAlert);
    saleForm.reset();
    saleDate.value = new Date().toISOString().split('T')[0];
    saleItemsTbody.innerHTML = '';
    addSaleItemRow();
    calculateSaleGrandTotal();
    saleModal.classList.remove('hidden');
  }

  btnOpenRecordSale.addEventListener('click', openSaleModal);
  btnEmptyRecordSale.addEventListener('click', openSaleModal);
  btnCloseSaleModal.addEventListener('click', () => saleModal.classList.add('hidden'));
  btnCancelSale.addEventListener('click', () => saleModal.classList.add('hidden'));
  btnAddSaleRow.addEventListener('click', addSaleItemRow);

  saleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(saleModalAlert);

    if (!activeSession || !activeBusiness) return;

    const rows = saleItemsTbody.querySelectorAll('.sale-item-row');
    if (rows.length === 0) {
      showAlert('Please add at least one line item.', 'error', saleModalAlert);
      return;
    }

    const items = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const prodSelect = row.querySelector('.sale-prod-select');
      const qtyInput = row.querySelector('.sale-qty-input');
      const priceInput = row.querySelector('.sale-price-input');

      const productId = prodSelect.value;
      if (!productId) {
        showAlert(`Item #${i + 1}: Please select a product.`, 'error', saleModalAlert);
        return;
      }

      const selectedOption = prodSelect.options[prodSelect.selectedIndex];
      const availableStock = selectedOption ? Number(selectedOption.dataset.stock || 0) : 0;
      const qty = Number(qtyInput.value);

      if (isNaN(qty) || qty <= 0) {
        showAlert(`Item #${i + 1}: Quantity must be greater than zero.`, 'error', saleModalAlert);
        return;
      }

      if (qty > availableStock) {
        showAlert(`Item #${i + 1}: Requested quantity (${qty}) exceeds available stock (${availableStock}).`, 'error', saleModalAlert);
        return;
      }

      const price = Number(priceInput.value);
      if (isNaN(price) || price < 0) {
        showAlert(`Item #${i + 1}: Unit price cannot be negative.`, 'error', saleModalAlert);
        return;
      }

      items.push({
        product_id: productId,
        quantity: qty,
        unit_price: price
      });
    }

    btnSubmitSale.disabled = true;
    btnSubmitSale.textContent = 'Processing Sale...';

    try {
      const payload = {
        business_id: activeBusiness.id,
        customer_name: saleCustomerName.value.trim() || null,
        sale_date: saleDate.value || new Date().toISOString(),
        notes: saleNotes.value.trim() || null,
        items
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeSession.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert(data.error || 'Failed to complete sale.', 'error', saleModalAlert);
        return;
      }

      saleModal.classList.add('hidden');
      showAlert(`Sale #${data.sale.sale_number} recorded successfully! Inventory stock updated.`, 'success');

      await Promise.all([
        loadSales(activeBusiness.id),
        loadInventory(activeBusiness.id),
        loadDashboard(activeBusiness.id)
      ]);
    } catch (err) {
      console.error('Error recording sale:', err);
      showAlert('A network error occurred while recording the sale.', 'error', saleModalAlert);
    } finally {
      btnSubmitSale.disabled = false;
      btnSubmitSale.textContent = 'Complete Sale';
    }
  });

  // =========================================================================
  // STAGE 5: PURCHASES WORKFLOW
  // =========================================================================
  function addPurchaseItemRow(prefill = null) {
    const tr = document.createElement('tr');
    tr.className = 'purchase-item-row';
    tr.innerHTML = `
      <td>
        <select class="purchase-prod-select" required>
          ${buildProductSelectOptions('purchase')}
        </select>
      </td>
      <td><span class="purchase-stock-badge text-muted">-</span></td>
      <td><input type="number" class="purchase-qty-input" min="1" step="1" value="1" required></td>
      <td><input type="number" class="purchase-cost-input" min="0" step="0.01" value="0.00" required></td>
      <td><span class="purchase-line-total">₹0.00</span></td>
      <td><button type="button" class="btn-remove-row" title="Remove row">&times;</button></td>
    `;

    const prodSelect = tr.querySelector('.purchase-prod-select');
    const stockBadge = tr.querySelector('.purchase-stock-badge');
    const qtyInput = tr.querySelector('.purchase-qty-input');
    const costInput = tr.querySelector('.purchase-cost-input');
    const lineTotalSpan = tr.querySelector('.purchase-line-total');
    const removeBtn = tr.querySelector('.btn-remove-row');

    if (prefill && prefill.productId) {
      prodSelect.value = prefill.productId;
      if (prefill.quantity) {
        qtyInput.value = prefill.quantity;
      }
      if (prefill.unitCost !== undefined && prefill.unitCost !== null) {
        costInput.value = Number(prefill.unitCost).toFixed(2);
      } else {
        const selectedOption = prodSelect.options[prodSelect.selectedIndex];
        if (selectedOption && selectedOption.dataset.cost) {
          costInput.value = Number(selectedOption.dataset.cost).toFixed(2);
        }
      }
    }

    function updateRowTotal() {
      const selectedOption = prodSelect.options[prodSelect.selectedIndex];
      const stock = selectedOption ? Number(selectedOption.dataset.stock || 0) : 0;
      const qty = Number(qtyInput.value || 0);
      const cost = Number(costInput.value || 0);
      const lineTotal = Math.round(qty * cost * 100) / 100;
      const currency = activeBusiness ? activeBusiness.currency : 'INR';

      lineTotalSpan.textContent = formatCurrency(lineTotal, currency);

      if (prodSelect.value) {
        stockBadge.textContent = `${stock} in stock`;
      } else {
        stockBadge.textContent = '-';
      }

      calculatePurchaseGrandTotal();
    }

    prodSelect.addEventListener('change', () => {
      const selectedOption = prodSelect.options[prodSelect.selectedIndex];
      if (selectedOption && selectedOption.dataset.cost) {
        costInput.value = Number(selectedOption.dataset.cost).toFixed(2);
      }
      updateRowTotal();
    });

    qtyInput.addEventListener('input', updateRowTotal);
    costInput.addEventListener('input', updateRowTotal);

    removeBtn.addEventListener('click', () => {
      if (purchaseItemsTbody.children.length > 1) {
        tr.remove();
        calculatePurchaseGrandTotal();
      } else {
        showAlert('A purchase order must include at least one item.', 'warning', purchaseModalAlert);
      }
    });

    purchaseItemsTbody.appendChild(tr);
    updateRowTotal();
  }

  function calculatePurchaseGrandTotal() {
    let grandTotal = 0;
    const currency = activeBusiness ? activeBusiness.currency : 'INR';

    purchaseItemsTbody.querySelectorAll('.purchase-item-row').forEach(row => {
      const qty = Number(row.querySelector('.purchase-qty-input').value || 0);
      const cost = Number(row.querySelector('.purchase-cost-input').value || 0);
      grandTotal += Math.round(qty * cost * 100) / 100;
    });

    purchaseGrandTotal.textContent = formatCurrency(grandTotal, currency);
  }

  async function loadPurchases(businessId) {
    if (!activeSession || !businessId) return;

    purchasesTbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">Loading purchase orders...</td></tr>';
    purchasesEmptyState.classList.add('hidden');

    const statusFilter = filterPurchaseStatus.value;
    const url = `/api/purchases?businessId=${businessId}${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${activeSession.access_token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      cachedPurchases = data.purchases || [];
      updatePurchasesStats(cachedPurchases);
      renderPurchasesTable(cachedPurchases);
    } catch (err) {
      console.error('Failed to load purchases:', err);
      purchasesTbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Error loading purchases: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function updatePurchasesStats(purchases) {
    const currency = activeBusiness ? activeBusiness.currency : 'INR';
    const totalCount = purchases.length;
    let pendingCount = 0;
    let totalSpend = 0;

    purchases.forEach(p => {
      if (p.status === 'ordered' || p.status === 'pending') {
        pendingCount++;
      }
      totalSpend += Number(p.total_amount || 0);
    });

    statTotalPurchases.textContent = totalCount.toLocaleString();
    statPendingPurchases.textContent = pendingCount.toLocaleString();
    statTotalPurchasesSpend.textContent = formatCurrency(totalSpend, currency);
  }

  function renderPurchasesTable(purchases) {
    const currency = activeBusiness ? activeBusiness.currency : 'INR';
    if (!purchases || purchases.length === 0) {
      purchasesTbody.innerHTML = '';
      purchasesEmptyState.classList.remove('hidden');
      return;
    }

    purchasesEmptyState.classList.add('hidden');
    purchasesTbody.innerHTML = purchases.map(p => {
      const dateStr = p.purchase_date ? new Date(p.purchase_date).toLocaleDateString() : '-';
      const supplierName = p.supplier ? p.supplier.name : 'No Supplier Attached';
      const isReceived = p.status === 'received';
      const isCancelled = p.status === 'cancelled';
      const isPendingOrOrdered = p.status === 'ordered' || p.status === 'pending';

      let statusBadge = `<span class="status-pill ordered">${escapeHtml(p.status || 'ordered')}</span>`;
      if (isReceived) {
        statusBadge = `<span class="status-pill received">Received</span>`;
      } else if (isCancelled) {
        statusBadge = `<span class="status-pill cancelled">Cancelled</span>`;
      } else if (p.status === 'pending') {
        statusBadge = `<span class="status-pill ordered">Pending</span>`;
      }

      return `
        <tr>
          <td><span class="prod-sku-cell">${escapeHtml(p.purchase_number)}</span></td>
          <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--color-secondary);">${escapeHtml(dateStr)}</td>
          <td><strong>${escapeHtml(supplierName)}</strong></td>
          <td class="mono tabular-nums">${p.item_count} units</td>
          <td class="mono tabular-nums font-semibold" style="text-align: right;">${formatCurrency(p.total_amount, currency)}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div class="table-actions">
              ${isPendingOrOrdered ? `<button class="btn btn-primary btn-sm btn-receive-po" data-id="${p.id}" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;">Mark Received</button>` : ''}
              <button class="btn-action-history btn-view-purchase" data-id="${p.id}" aria-label="View PO manifest for ${escapeHtml(p.purchase_number)}">Manifest</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    purchasesTbody.querySelectorAll('.btn-view-purchase').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = cachedPurchases.find(item => item.id === btn.dataset.id);
        if (p) showTransactionDetails('purchase', p);
      });
    });

    purchasesTbody.querySelectorAll('.btn-receive-po').forEach(btn => {
      btn.addEventListener('click', () => handleReceivePurchase(btn.dataset.id, btn));
    });
  }

  filterPurchaseStatus.addEventListener('change', () => {
    if (activeBusiness) loadPurchases(activeBusiness.id);
  });

  async function handleReceivePurchase(purchaseId, btnElement) {
    if (!activeSession) return;
    if (btnElement) {
      btnElement.disabled = true;
      btnElement.textContent = 'Receiving...';
    }

    try {
      const res = await fetch(`/api/purchases/${purchaseId}/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeSession.access_token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        showAlert(data.error || 'Failed to receive purchase order.', 'error');
        if (btnElement) {
          btnElement.disabled = false;
          btnElement.textContent = 'Mark Received';
        }
        return;
      }

      showAlert('Purchase order marked as received and stock updated successfully!', 'success');
      await Promise.all([
        loadPurchases(activeBusiness.id),
        loadInventory(activeBusiness.id),
        loadDashboard(activeBusiness.id)
      ]);
    } catch (err) {
      console.error('Error receiving purchase:', err);
      showAlert('A network error occurred while receiving purchase order.');
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = 'Mark Received';
      }
    }
  }

  function openPurchaseModal(prefill = null) {
    clearAlert(purchaseModalAlert);
    purchaseForm.reset();
    purchaseDate.value = new Date().toISOString().split('T')[0];
    purchaseStatusSelect.value = 'ordered';

    purchaseSupplierSelect.innerHTML = '<option value="">No Supplier Attached</option>' +
      cachedSuppliers.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

    // If prefilling for a product that has an assigned supplier, preselect it in the dropdown
    if (prefill && prefill.productId && cachedProducts) {
      const prod = cachedProducts.find(p => p.id === prefill.productId);
      if (prod && prod.supplier_id) {
        purchaseSupplierSelect.value = prod.supplier_id;
      }
    }

    purchaseItemsTbody.innerHTML = '';
    addPurchaseItemRow(prefill);
    calculatePurchaseGrandTotal();
    purchaseModal.classList.remove('hidden');
  }

  btnOpenCreatePurchase.addEventListener('click', () => openPurchaseModal());
  btnEmptyCreatePurchase.addEventListener('click', () => openPurchaseModal());
  btnClosePurchaseModal.addEventListener('click', () => purchaseModal.classList.add('hidden'));
  btnCancelPurchase.addEventListener('click', () => purchaseModal.classList.add('hidden'));
  btnAddPurchaseRow.addEventListener('click', addPurchaseItemRow);

  purchaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert(purchaseModalAlert);

    if (!activeSession || !activeBusiness) return;

    const rows = purchaseItemsTbody.querySelectorAll('.purchase-item-row');
    if (rows.length === 0) {
      showAlert('Please add at least one line item.', 'error', purchaseModalAlert);
      return;
    }

    const items = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const prodSelect = row.querySelector('.purchase-prod-select');
      const qtyInput = row.querySelector('.purchase-qty-input');
      const costInput = row.querySelector('.purchase-cost-input');

      const productId = prodSelect.value;
      if (!productId) {
        showAlert(`Item #${i + 1}: Please select a product.`, 'error', purchaseModalAlert);
        return;
      }

      const qty = Number(qtyInput.value);
      if (isNaN(qty) || qty <= 0) {
        showAlert(`Item #${i + 1}: Quantity must be greater than zero.`, 'error', purchaseModalAlert);
        return;
      }

      const cost = Number(costInput.value);
      if (isNaN(cost) || cost < 0) {
        showAlert(`Item #${i + 1}: Unit cost cannot be negative.`, 'error', purchaseModalAlert);
        return;
      }

      items.push({
        product_id: productId,
        quantity: qty,
        unit_cost: cost
      });
    }

    btnSubmitPurchase.disabled = true;
    btnSubmitPurchase.textContent = 'Creating Order...';

    try {
      const payload = {
        business_id: activeBusiness.id,
        supplier_id: purchaseSupplierSelect.value || null,
        status: purchaseStatusSelect.value || 'ordered',
        purchase_date: purchaseDate.value || new Date().toISOString(),
        notes: purchaseNotes.value.trim() || null,
        items
      };

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeSession.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert(data.error || 'Failed to create purchase order.', 'error', purchaseModalAlert);
        return;
      }

      purchaseModal.classList.add('hidden');
      showAlert(`Purchase order #${data.purchase.purchase_number} created successfully!`, 'success');

      await Promise.all([
        loadPurchases(activeBusiness.id),
        loadInventory(activeBusiness.id),
        loadDashboard(activeBusiness.id)
      ]);
    } catch (err) {
      console.error('Error creating purchase order:', err);
      showAlert('A network error occurred while creating purchase order.', 'error', purchaseModalAlert);
    } finally {
      btnSubmitPurchase.disabled = false;
      btnSubmitPurchase.textContent = 'Create Purchase Order';
    }
  });

  // =========================================================================
  // STAGE 5: TRANSACTION DETAILS MODAL
  // =========================================================================
  function showTransactionDetails(type, record) {
    const currency = activeBusiness ? activeBusiness.currency : 'INR';
    const isSale = type === 'sale';

    modalDetailsTitle.textContent = isSale ? `Sale Order: ${record.sale_number}` : `Purchase Order: ${record.purchase_number}`;
    detailsRefNumber.textContent = isSale ? record.sale_number : record.purchase_number;
    detailsDate.textContent = record.sale_date
      ? new Date(record.sale_date).toLocaleDateString()
      : (record.purchase_date ? new Date(record.purchase_date).toLocaleDateString() : '-');

    detailsEntityLabel.textContent = isSale ? 'Customer' : 'Supplier';
    detailsEntityValue.textContent = isSale
      ? (record.customer_name || 'Walk-in Customer')
      : (record.supplier ? record.supplier.name : 'No Supplier Attached');

    let detailsStatusHtml = `<span class="status-pill ordered">${escapeHtml(record.status || '-')}</span>`;
    if (record.status === 'received') {
      detailsStatusHtml = '<span class="status-pill received">Received</span>';
    } else if (record.status === 'completed') {
      detailsStatusHtml = '<span class="status-pill completed">Completed</span>';
    } else if (record.status === 'cancelled') {
      detailsStatusHtml = '<span class="status-pill cancelled">Cancelled</span>';
    } else if (record.status === 'pending') {
      detailsStatusHtml = '<span class="status-pill ordered">Pending</span>';
    }
    detailsStatus.innerHTML = detailsStatusHtml;

    if (record.notes) {
      detailsNotes.textContent = record.notes;
      detailsNotesWrapper.classList.remove('hidden');
    } else {
      detailsNotesWrapper.classList.add('hidden');
    }

    const items = record.items || [];
    detailsItemsTbody.innerHTML = items.map(item => `
      <tr>
        <td><strong>${escapeHtml(item.product_name)}</strong></td>
        <td><span class="prod-sku-cell">${escapeHtml(item.sku || '-')}</span></td>
        <td class="mono tabular-nums">${item.quantity} units</td>
        <td class="mono tabular-nums" style="text-align: right;">${formatCurrency(isSale ? item.unit_price : item.unit_cost, currency)}</td>
        <td class="mono tabular-nums font-semibold" style="text-align: right;">${formatCurrency(item.line_total, currency)}</td>
      </tr>
    `).join('');

    detailsGrandTotal.textContent = formatCurrency(record.total_amount, currency);
    detailsModal.classList.remove('hidden');
  }

  btnDismissDetails.addEventListener('click', () => detailsModal.classList.add('hidden'));
  btnCloseDetailsModal.addEventListener('click', () => detailsModal.classList.add('hidden'));

  // =========================================================================
  // PUBLIC HOMEPAGE NAVIGATION & INTERACTION LISTENERS
  // =========================================================================
  if (btnNavSignin) {
    btnNavSignin.addEventListener('click', () => {
      window.location.hash = '#/login';
      showView('auth', 'login');
    });
  }

  if (btnCtaSignin) {
    btnCtaSignin.addEventListener('click', () => {
      window.location.hash = '#/login';
      showView('auth', 'login');
    });
  }

  if (btnNavGetstarted) {
    btnNavGetstarted.addEventListener('click', () => {
      window.location.hash = '#/register';
      showView('auth', 'register');
    });
  }

  if (btnHeroGetstarted) {
    btnHeroGetstarted.addEventListener('click', () => {
      window.location.hash = '#/register';
      showView('auth', 'register');
    });
  }

  if (btnCtaGetstarted) {
    btnCtaGetstarted.addEventListener('click', () => {
      window.location.hash = '#/register';
      showView('auth', 'register');
    });
  }

  if (btnCompGetstarted) {
    btnCompGetstarted.addEventListener('click', () => {
      window.location.hash = '#/register';
      showView('auth', 'register');
    });
  }

  if (btnDemoCreatePo) {
    btnDemoCreatePo.addEventListener('click', () => {
      if (activeSession) {
        showView('workspace');
        switchModule('purchases');
        openPurchaseModal();
      } else {
        window.location.hash = '#/register';
        showView('auth', 'register');
      }
    });
  }

  if (btnNavWorkspace) {
    btnNavWorkspace.addEventListener('click', () => {
      window.location.hash = '#/workspace';
      showView('workspace');
    });
  }

  if (navBrandHome) {
    navBrandHome.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#/';
      showView('home');
    });
  }

  if (btnAuthBackHome) {
    btnAuthBackHome.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '#/';
      showView('home');
    });
  }

  if (btnMobileNav) {
    btnMobileNav.addEventListener('click', () => {
      if (primaryNavLinks) {
        const isShown = primaryNavLinks.style.display === 'flex';
        primaryNavLinks.style.display = isShown ? 'none' : 'flex';
        if (!isShown) {
          primaryNavLinks.style.flexDirection = 'column';
          primaryNavLinks.style.position = 'absolute';
          primaryNavLinks.style.top = '100%';
          primaryNavLinks.style.left = '0';
          primaryNavLinks.style.right = '0';
          primaryNavLinks.style.backgroundColor = '#FFFFFF';
          primaryNavLinks.style.padding = '1rem';
          primaryNavLinks.style.boxShadow = '0 10px 15px -3px rgba(15, 23, 42, 0.1)';
          primaryNavLinks.style.borderBottom = '1px solid #E2E8F0';
        }
      }
    });
  }

  // Demo Shell Tabs
  if (demoTabInventory) {
    demoTabInventory.addEventListener('click', () => {
      demoTabInventory.classList.add('active');
      if (demoTabSales) demoTabSales.classList.remove('active');
      if (demoTabPurchases) demoTabPurchases.classList.remove('active');
    });
  }
  if (demoTabSales) {
    demoTabSales.addEventListener('click', () => {
      demoTabSales.classList.add('active');
      if (demoTabInventory) demoTabInventory.classList.remove('active');
      if (demoTabPurchases) demoTabPurchases.classList.remove('active');
    });
  }
  if (demoTabPurchases) {
    demoTabPurchases.addEventListener('click', () => {
      demoTabPurchases.classList.add('active');
      if (demoTabInventory) demoTabInventory.classList.remove('active');
      if (demoTabSales) demoTabSales.classList.remove('active');
    });
  }

  // Hash Navigation Handler
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash === '#/login' || hash === '#login') {
      showView('auth', 'login');
    } else if (hash === '#/register' || hash === '#register') {
      showView('auth', 'register');
    } else if (hash === '#/workspace' || hash === '#workspace') {
      if (activeSession) {
        showView('workspace');
      } else {
        showView('auth', 'login');
      }
    } else if (hash === '#/' || hash === '' || hash === '#home') {
      showView('home');
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
      updateNavAuthState();
      window.location.hash = '#/';
      showView('home');
      showAlert('You have been logged out.', 'success');
    }
  }

  btnHeaderLogout.addEventListener('click', handleLogout);
});
