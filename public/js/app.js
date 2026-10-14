// StockPilot Client Application & Authentication Controller
document.addEventListener('DOMContentLoaded', () => {
  // Elements: Health & Environment
  const frontendStatusEl = document.getElementById('frontend-status');
  const apiStatusEl = document.getElementById('api-status');
  const authStatusBadge = document.getElementById('auth-status-badge');

  // Elements: Auth UI containers
  const authAlertEl = document.getElementById('auth-alert');
  const authFormsContainer = document.getElementById('auth-forms-container');
  const authUserContainer = document.getElementById('auth-user-container');

  // Elements: Tabs & Panels
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginPanel = document.getElementById('login-panel');
  const registerPanel = document.getElementById('register-panel');

  // Elements: Forms & Buttons
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginSubmitBtn = document.getElementById('login-submit-btn');
  const registerSubmitBtn = document.getElementById('register-submit-btn');
  const btnLogout = document.getElementById('btn-logout');
  const btnTestRls = document.getElementById('btn-test-rls');

  // Elements: User Profile
  const profileEmail = document.getElementById('profile-email');
  const profileId = document.getElementById('profile-id');
  const profileLastLogin = document.getElementById('profile-last-login');
  const rlsOutputContainer = document.getElementById('rls-output-container');
  const rlsOutputText = document.getElementById('rls-output-text');

  const STORAGE_KEY = 'stockpilot_auth_session';

  // 1. Confirm frontend runtime
  if (frontendStatusEl) {
    frontendStatusEl.textContent = 'Active';
    frontendStatusEl.className = 'status-badge success';
  }

  // 2. Check API health
  checkApiHealth();

  // 3. Initialize Auth State
  restoreSession();

  // =========================================================================
  // TAB SWITCHING
  // =========================================================================
  tabLogin.addEventListener('click', () => switchTab('login'));
  tabRegister.addEventListener('click', () => switchTab('register'));

  function switchTab(tab) {
    clearAlert();
    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabLogin.setAttribute('aria-selected', 'true');
      tabRegister.classList.remove('active');
      tabRegister.setAttribute('aria-selected', 'false');
      loginPanel.classList.remove('hidden');
      registerPanel.classList.add('hidden');
    } else {
      tabRegister.classList.add('active');
      tabRegister.setAttribute('aria-selected', 'true');
      tabLogin.classList.remove('active');
      tabLogin.setAttribute('aria-selected', 'false');
      registerPanel.classList.remove('hidden');
      loginPanel.classList.add('hidden');
    }
  }

  // =========================================================================
  // ALERT BANNER HELPER
  // =========================================================================
  function showAlert(message, type = 'error') {
    authAlertEl.textContent = message;
    authAlertEl.className = `alert alert-${type}`;
    authAlertEl.classList.remove('hidden');
  }

  function clearAlert() {
    authAlertEl.textContent = '';
    authAlertEl.className = 'alert hidden';
  }

  // =========================================================================
  // HEALTH CHECK
  // =========================================================================
  function checkApiHealth() {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        apiStatusEl.textContent = `Online (${data.status})`;
        apiStatusEl.className = 'status-badge success';
      })
      .catch((err) => {
        apiStatusEl.textContent = 'Offline';
        apiStatusEl.className = 'status-badge error';
        console.error('API health check error:', err);
      });
  }

  // =========================================================================
  // SESSION STORAGE & RESTORATION
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
    } catch (err) {
      console.error('Failed to save session to localStorage:', err);
    }
  }

  function clearStoredSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  async function restoreSession() {
    const session = getStoredSession();
    if (!session || !session.access_token) {
      renderUnauthenticated();
      return;
    }

    authStatusBadge.textContent = 'Verifying...';
    authStatusBadge.className = 'status-badge pending';

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) {
        throw new Error('Session expired or invalid');
      }

      const data = await res.json();
      renderAuthenticated(data.user);
    } catch (err) {
      console.warn('Session verification failed, clearing stored token:', err.message);
      clearStoredSession();
      renderUnauthenticated();
    }
  }

  function renderAuthenticated(user) {
    authStatusBadge.textContent = 'Authenticated';
    authStatusBadge.className = 'status-badge success';

    profileEmail.textContent = user.email || 'N/A';
    profileId.textContent = user.id || 'N/A';
    profileLastLogin.textContent = user.last_sign_in_at
      ? new Date(user.last_sign_in_at).toLocaleString()
      : 'First session';

    authFormsContainer.classList.add('hidden');
    authUserContainer.classList.remove('hidden');
    rlsOutputContainer.classList.add('hidden');
  }

  function renderUnauthenticated() {
    authStatusBadge.textContent = 'Unauthenticated';
    authStatusBadge.className = 'status-badge pending';

    authUserContainer.classList.add('hidden');
    authFormsContainer.classList.remove('hidden');
  }

  // =========================================================================
  // SIGN IN
  // =========================================================================
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showAlert('Please enter both email and password.');
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
          showAlert(data.error || 'Failed to sign in. Please check your credentials.', 'error');
        }
        return;
      }

      saveSession(data.session);
      renderAuthenticated(data.user);
      loginForm.reset();
      showAlert('Signed in successfully!', 'success');
    } catch (err) {
      showAlert('Network error occurred during login. Please try again.');
      console.error(err);
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = 'Sign In';
    }
  });

  // =========================================================================
  // SIGN UP
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
        showAlert(data.error || 'Failed to create account.', 'error');
        return;
      }

      if (data.status === 'unverified') {
        registerForm.reset();
        switchTab('login');
        document.getElementById('login-email').value = email;
        showAlert(
          'Account created! A confirmation email has been sent. Please confirm your email before signing in.',
          'warning'
        );
      } else if (data.status === 'authenticated' && data.session) {
        saveSession(data.session);
        renderAuthenticated(data.user);
        registerForm.reset();
        showAlert('Account created and logged in!', 'success');
      }
    } catch (err) {
      showAlert('Network error occurred during registration. Please try again.');
      console.error(err);
    } finally {
      registerSubmitBtn.disabled = false;
      registerSubmitBtn.textContent = 'Create Account';
    }
  });

  // =========================================================================
  // LOGOUT
  // =========================================================================
  btnLogout.addEventListener('click', async () => {
    const session = getStoredSession();
    clearAlert();
    btnLogout.disabled = true;

    try {
      if (session && session.access_token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
      }
    } catch (err) {
      console.warn('Logout network error (clearing local session anyway):', err);
    } finally {
      clearStoredSession();
      renderUnauthenticated();
      btnLogout.disabled = false;
      showAlert('You have been logged out.', 'success');
    }
  });

  // =========================================================================
  // TEST RLS ACCESS (AUTHENTICATED SCOPED QUERY)
  // =========================================================================
  btnTestRls.addEventListener('click', async () => {
    const session = getStoredSession();
    if (!session || !session.access_token) {
      showAlert('No active session. Please sign in again.');
      return;
    }

    rlsOutputContainer.classList.remove('hidden');
    rlsOutputText.textContent = 'Querying database under your authenticated user context...';
    btnTestRls.disabled = true;

    try {
      const res = await fetch('/api/auth/test-rls', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      const data = await res.json();

      if (!res.ok) {
        rlsOutputText.textContent = JSON.stringify(data, null, 2);
        return;
      }

      rlsOutputText.textContent = JSON.stringify(
        {
          status: data.status,
          message: data.message,
          verifiedUserId: data.verifiedUserId,
          accessibleBusinessesCount: data.accessibleBusinessesCount,
          businesses: data.businesses
        },
        null,
        2
      );
    } catch (err) {
      rlsOutputText.textContent = `Error querying RLS endpoint: ${err.message}`;
    } finally {
      btnTestRls.disabled = false;
    }
  });
});
