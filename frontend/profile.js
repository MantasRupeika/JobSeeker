/**
 * Profile Management Module
 * 
 * This module handles all profile-related functionality including:
 * - User profile data loading from API
 * - CV CRUD operations via REST API
 * - Submission history display
 * - Profile settings updates
 * 
 * API Strategy:
 * - Uses JWT token stored in localStorage for authentication
 * - All API requests include Authorization header with Bearer token
 * - Falls back to localStorage if API is unavailable (graceful degradation)
 * - Implements proper error handling and user feedback
 */

// ============ CONFIGURATION ============
const API_BASE_URL = window.location.origin + '/api';
const TOKEN_KEY = 'jobseeker_jwt';

// Utility function to get JWT token from localStorage
function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Utility function to create API headers with authentication
function getApiHeaders(isJson = true) {
  const headers = {
    'Authorization': `Bearer ${getAuthToken()}`
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

// ============ USER PROFILE MANAGEMENT ============

/**
 * Fetch user profile from API
 * The profile contains: id, email, name (from users table)
 * Additional data (phone, city, bio, profession) stored in preferences (future enhancement)
 */
async function fetchUserProfile() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: getApiHeaders()
    });

    if (!response.ok) {
      // If endpoint doesn't exist, use localStorage fallback
      if (response.status === 404) {
        console.log('API endpoint not available, using localStorage');
        return getStoredProfile();
      }
      throw new Error(`Failed to fetch profile: ${response.statusText}`);
    }

    const data = await response.json();
    // Cache in localStorage for quick access
    localStorage.setItem('userProfile', JSON.stringify(data));
    return data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return getStoredProfile();
  }
}

/**
 * Get profile from localStorage (fallback/cache)
 */
function getStoredProfile() {
  const stored = localStorage.getItem('profileSettings');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return getDefaultProfile();
    }
  }
  return getDefaultProfile();
}

/**
 * Default profile structure
 * Note: bio, profession, city, notifications are not in database yet
 * These should be stored in a user_preferences table in future
 */
function getDefaultProfile() {
  return {
    id: null,
    name: 'User Name',
    email: 'user@example.com',
    phone: '',
    profession: '',
    city: '',
    bio: '',
    notifications: 'all'
  };
}

/**
 * Update user profile via API
 * Currently updates full_name and other basic info
 * Future: Add endpoint to update additional fields
 */
async function updateUserProfile(profileData) {
  try {
    localStorage.setItem('profileSettings', JSON.stringify(profileData));

    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify({
          name: profileData.name || profileData.fullName,
          email: profileData.email
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.status}`);
      }
    } catch (error) {
      console.warn('Could not update profile on server, profile saved locally:', error.message);
    }

    return profileData;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

/**
 * Populate profile header with user data
 */
function populateProfileHeader(profile) {
  document.getElementById('profileUserName').textContent =
    profile.fullName || profile.name || 'User Name';
  document.getElementById('profileUserEmail').textContent =
    profile.email || 'user@example.com';
}

/**
 * Populate settings form with profile data
 */
function populateSettingsForm(profile) {
  document.getElementById('fullName').value = profile.fullName || profile.name || '';
  document.getElementById('email').value = profile.email || '';
  document.getElementById('phone').value = profile.phone || '';
  document.getElementById('profession').value = profile.profession || '';
  document.getElementById('city').value = profile.city || '';
  document.getElementById('bio').value = profile.bio || '';
  document.getElementById('notifications').value = profile.notifications || 'all';
}

// ============ CV MANAGEMENT ============

/**
 * Fetch all CVs for current user from API
 * GET /api/cv - returns array of user's CVs
 * Falls back to localStorage if API unavailable
 */
async function fetchUserCVs() {
  try {
    const response = await fetch(`${API_BASE_URL}/cv`, {
      method: 'GET',
      headers: getApiHeaders()
    });

    if (!response.ok) {
      // Fallback to localStorage
      console.log('Using localStorage for CVs');
      return getStoredCVs();
    }

    const cvs = await response.json();
    // Cache in localStorage
    localStorage.setItem('userCVs', JSON.stringify(cvs));
    return cvs;
  } catch (error) {
    console.error('Error fetching CVs:', error);
    return getStoredCVs();
  }
}

/**
 * Get CVs from localStorage (fallback/cache)
 */
function getStoredCVs() {
  const stored = localStorage.getItem('userCVs');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Delete a CV via API
 * DELETE /api/cv/:id
 */
async function deleteCV(cvId) {
  try {
    const response = await fetch(`${API_BASE_URL}/cv/${cvId}`, {
      method: 'DELETE',
      headers: getApiHeaders()
    });

    /*
    if (!response.ok) {
      throw new Error('Failed to delete CV from server');
    }
    */

    // Remove from localStorage cache
    let cvs = getStoredCVs();
    cvs = cvs.filter(cv => cv.id !== cvId);
    localStorage.setItem('userCVs', JSON.stringify(cvs));

    return true;
  } catch (error) {
    console.error('Error deleting CV:', error);
    throw error;
  }
}

/**
 * Render CV list with edit/delete buttons
 */
function renderCVList(cvs) {
  const cvListContainer = document.getElementById('cvListContainer');
  const cvEmptyState = document.getElementById('cvEmptyState');

  if (!cvs || cvs.length === 0) {
    cvEmptyState.style.display = 'block';
    cvListContainer.innerHTML = '';
    return;
  }

  cvEmptyState.style.display = 'none';
  cvListContainer.innerHTML = '';

  cvs.forEach(cv => {
    const cvCard = document.createElement('div');
    cvCard.className = 'cv-card';

    // Handle both API format (created_at) and localStorage format (createdAt)
    const createdDate = new Date(cv.created_at || cv.createdAt).toLocaleDateString();

    cvCard.innerHTML = `
      <h3>${cv.name || 'Unnamed CV'}</h3>
      <p class="cv-info">Email: ${cv.email || '-'}</p>
      <p class="cv-info">Phone: ${cv.phone || '-'}</p>
      <p class="cv-info">Created: ${createdDate}</p>
      <div class="cv-actions">
        <button class="cv-edit-btn" data-id="${cv.id}">Edit</button>
        <button class="cv-delete-btn" data-id="${cv.id}">Delete</button>
      </div>
    `;

    cvListContainer.appendChild(cvCard);
  });

  // Add event listeners
  setupCVEventListeners();
}

/**
 * Setup event listeners for edit/delete buttons
 */
function setupCVEventListeners() {
  // Edit button listeners
  document.querySelectorAll('.cv-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cvId = btn.getAttribute('data-id');
      // Redirect to CV editor with edit mode
      window.location.href = `cv.html?action=edit&id=${cvId}`;
    });
  });

  // Delete button listeners
  document.querySelectorAll('.cv-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cvId = btn.getAttribute('data-id');
      if (confirm('Are you sure you want to delete this CV?')) {
        try {
          await deleteCV(cvId);
          // Refresh the CV list
          const cvs = await fetchUserCVs();
          renderCVList(cvs);
        } catch (error) {
          alert('Failed to delete CV: ' + error.message);
        }
      }
    });
  });
}

// ============ SUBMISSION HISTORY MANAGEMENT ============

/**
 * Fetch submission history (applications) from API
 * GET /api/applications or GET /api/submissions
 * Returns: job_title, company, sent_date, cv_used
 * Note: Status column removed per requirements
 */
async function fetchSubmissionHistory() {
  try {
    // Try /api/applications endpoint first
    let response = await fetch(`${API_BASE_URL}/applications`, {
      method: 'GET',
      headers: getApiHeaders()
    });

    if (!response.ok) {
      // If not found, API might not be implemented yet
      console.log('Applications endpoint not available');
      return getStoredSubmissionHistory();
    }

    const applications = await response.json();
    // Transform applications to match table format
    const history = applications.map(app => ({
      jobTitle: app.job_title || 'Job Title',
      company: app.company || 'Company',
      sentDate: new Date(app.sent_at).toLocaleDateString(),
      cvUsed: app.cv_name || 'CV Name'
    }));

    // Cache in localStorage
    localStorage.setItem('submissionHistory', JSON.stringify(history));
    return history;
  } catch (error) {
    console.error('Error fetching submission history:', error);
    return getStoredSubmissionHistory();
  }
}

/**
 * Get submission history from localStorage (fallback/cache)
 */
function getStoredSubmissionHistory() {
  const stored = localStorage.getItem('submissionHistory');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Render submission history table
 */
function renderSubmissionHistory(history) {
  const tableBody = document.getElementById('historyTableBody');
  const emptyState = document.getElementById('historyEmptyState');

  if (!history || history.length === 0) {
    emptyState.style.display = 'block';
    tableBody.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';
  tableBody.innerHTML = '';

  history.forEach(submission => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${submission.jobTitle || '-'}</td>
      <td>${submission.company || '-'}</td>
      <td>${submission.sentDate || '-'}</td>
      <td>${submission.cvUsed || '-'}</td>
    `;
    tableBody.appendChild(row);
  });
}

// ============ TAB NAVIGATION ============

/**
 * Setup tab navigation
 * Switches between CV, History, and Settings tabs
 */
function setupTabNavigation() {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Remove active class from all tabs and buttons
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
      });

      // Add active class to selected tab and button
      document.getElementById(tabName).classList.add('active');
      button.classList.add('active');
    });
  });
}

// ============ FORM SUBMISSION ============

/**
 * Handle profile settings form submission
 * Sends updated profile to API and stores locally
 */
document.addEventListener('DOMContentLoaded', () => {
  const settingsForm = document.getElementById('settingsForm');

  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        profession: document.getElementById('profession').value,
        city: document.getElementById('city').value,
        bio: document.getElementById('bio').value,
        notifications: document.getElementById('notifications').value
      };

      try {
        await updateUserProfile(formData);
        populateProfileHeader(formData);
        alert('Profile settings saved successfully!');
      } catch (error) {
        alert('Failed to save profile: ' + error.message);
      }
    });
  }

  // Setup Add CV button
  const addCvBtn = document.getElementById('addCvBtn');
  if (addCvBtn) {
    addCvBtn.addEventListener('click', () => {
      window.location.href = 'cv.html?action=create';
    });
  }
});

// ============ INITIALIZATION ============

/**
 * Initialize profile page
 * 1. Load user profile from API
 * 2. Populate profile header and form
 * 3. Load and display CVs
 * 4. Load and display submission history
 * 5. Setup tab navigation
 */
async function initializeProfile() {
  if (window.AppAuth && !window.AppAuth.requireAuth()) {
    return;
  }

  try {
    // Load user profile
    const profile = await fetchUserProfile();
    populateProfileHeader(profile);
    populateSettingsForm(profile);

    // Load CVs
    const cvs = await fetchUserCVs();
    renderCVList(cvs);

    // Load submission history
    const history = await fetchSubmissionHistory();
    renderSubmissionHistory(history);

    // Setup navigation
    setupTabNavigation();
  } catch (error) {
    console.error('Failed to initialize profile:', error);
    // Still show page with empty/default data
    populateProfileHeader(getDefaultProfile());
    setupTabNavigation();
  }
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeProfile);
} else {
  initializeProfile();
}
