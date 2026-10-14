// StockPilot Frontend Entry Script
document.addEventListener('DOMContentLoaded', () => {
  console.log('StockPilot frontend initialized.');

  // Confirm frontend JavaScript execution in the UI
  const frontendStatusEl = document.getElementById('frontend-status');
  if (frontendStatusEl) {
    frontendStatusEl.textContent = 'Active';
    frontendStatusEl.classList.remove('pending');
    frontendStatusEl.classList.add('success');
  }

  // Verify connection to the Express backend health endpoint
  const apiStatusEl = document.getElementById('api-status');
  if (apiStatusEl) {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        apiStatusEl.textContent = `Online (${data.status})`;
        apiStatusEl.classList.remove('pending');
        apiStatusEl.classList.add('success');
        console.log('Health check response:', data);
      })
      .catch((error) => {
        apiStatusEl.textContent = 'Offline / Error';
        apiStatusEl.classList.remove('pending');
        apiStatusEl.classList.add('error');
        console.error('Failed to connect to API:', error);
      });
  }
});
