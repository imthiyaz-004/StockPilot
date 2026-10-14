// StockPilot Application & Onboarding Controller
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

  // Auth Form elements
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginPanel = document.getElementById('login-panel');
  const registerPanel = document.getElementById('register-panel');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const registerSubmitBtn = document.getElementById('register-submit-btn');

  // Onboarding Form elements
  const onboardingForm = document.getElementById('onboarding-form');
  const onboardingSubmitBtn = document.getElementById('onboarding-submit-btn');
  const bizIndustrySelect = document.getElementById('biz-industry');
  const bizIndustryCustomGroup = document.getElementById('biz-industry-custom-group');
  const bizIndustryCustomInput = document.getElementById('biz-industry-custom');

  // Workspace elements
  const workspaceName = document.getElementById('workspace-name');
  const workspaceRoleBadge = document.getElementById('workspace-role-badge');
  const workspaceIndustry = document.getElementById('workspace-industry');
  const workspaceLocation = document.getElementById('workspace-location');
  const workspaceCurrency = document.getElementById('workspace-currency');
  const workspaceId = document.getElementById('workspace-id');
  const btnVerifyWorkspaceRls = document.getElementById('btn-verify-workspace-rls');
  const btnWorkspaceLogout = document.getElementById('btn-workspace-logout');
  const workspaceRlsOutput = document.getElementById('workspace-rls-output');
  const workspaceRlsJson = document.getElementById('workspace-rls-json');

  let activeSession = null;
  let activeBusiness = null;

  // Initialize runtime check
  if (frontendStatusEl) {
    frontendStatusEl.textContent = 'Active';
    frontendStatusEl.className = 'status-badge success';
  }

  // 1. Check API Health
  checkApiHealth();

  // 2. Check Session & Initialize View
  initAppSession();

  // =========================================================================
  // VIEW ROUTING & STATE HELPERS
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

      // Check whether user has an existing business
      await loadUserBusiness(session.access_token);
    } catch (err) {
      console.warn('Session verification failed, resetting to sign in:', err.message);
      clearStoredSession();
      showView('auth');
    }
  }

  // =========================================================================
  // BUSINESS LOADER
  // =========================================================================
  async function loadUserBusiness(token) {
    try {
      const res = await fetch('/api/businesses/mine', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to query user businesses');
      }

      const data = await res.json();

      if (data.hasBusiness && data.primaryBusiness) {
        activeBusiness = data.primaryBusiness;
        renderWorkspace(activeBusiness);
        showView('workspace');
      } else {
        showView('onboarding');
      }
    } catch (err) {
      console.error('Error loading business:', err);
      showView('onboarding');
    }
  }

  function renderWorkspace(business) {
    workspaceName.textContent = business.name || 'Unnamed Business';
    workspaceRoleBadge.textContent = (business.role || 'Owner').toUpperCase();
    workspaceIndustry.textContent = business.industry || 'Not Specified';
    workspaceLocation.textContent = business.location || 'Not Specified';
    workspaceCurrency.textContent = `${business.currency || 'INR'} ${getCurrencySymbol(business.currency)}`;
    workspaceId.textContent = business.id || '-';
    workspaceRlsOutput.classList.add('hidden');
  }

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

  // =========================================================================
  // AUTH TABS
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

  // =========================================================================
  // SIGN IN SUBMISSION
  // =========================================================================
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

      // Check onboarding status
      await loadUserBusiness(data.session.access_token);
    } catch (err) {
      showAlert('A network error occurred. Please try again.');
      console.error(err);
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = 'Sign In';
    }
  });

  // =========================================================================
  // SIGN UP SUBMISSION
  // =========================================================================
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
  // INDUSTRY "OTHER" TOGGLE
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

  // =========================================================================
  // BUSINESS ONBOARDING SUBMISSION
  // =========================================================================
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

      renderWorkspace(activeBusiness);
      showView('workspace');
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
  // WORKSPACE RLS VERIFICATION QUERY
  // =========================================================================
  btnVerifyWorkspaceRls.addEventListener('click', async () => {
    const session = getStoredSession();
    if (!session || !session.access_token) {
      showAlert('Session expired. Please sign in again.');
      showView('auth');
      return;
    }

    workspaceRlsOutput.classList.remove('hidden');
    workspaceRlsJson.textContent = 'Executing authenticated query against Supabase PostgreSQL...';
    btnVerifyWorkspaceRls.disabled = true;

    try {
      const res = await fetch('/api/businesses/mine', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      const data = await res.json();
      workspaceRlsJson.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      workspaceRlsJson.textContent = `Error executing RLS query: ${err.message}`;
    } finally {
      btnVerifyWorkspaceRls.disabled = false;
    }
  });

  // =========================================================================
  // LOGOUT HANDLER
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
      console.warn('Logout network error (clearing local session anyway):', err);
    } finally {
      clearStoredSession();
      headerUserEmail.textContent = '';
      showView('auth');
      showAlert('You have been logged out.', 'success');
    }
  }

  btnHeaderLogout.addEventListener('click', handleLogout);
  btnWorkspaceLogout.addEventListener('click', handleLogout);
});
