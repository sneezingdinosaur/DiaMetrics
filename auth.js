// Authentication module
const API_URL = 'http://localhost:5000';

let authToken = localStorage.getItem('authToken');
let currentUsername = localStorage.getItem('username');

export function isLoggedIn() {
    return authToken !== null;
}

export function getAuthToken() {
    return authToken;
}

export function getCurrentUsername() {
    return currentUsername;
}

export async function signup(username, password) {
    const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
    }

    return data;
}

export async function login(username, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Login failed');
    }

    authToken = data.token;
    currentUsername = data.username;
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('username', currentUsername);

    return data;
}

export async function logout() {
    if (authToken) {
        try {
            await fetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    authToken = null;
    currentUsername = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
}

export async function authenticatedFetch(url, options = {}) {
    if (!authToken) {
        throw new Error('Not authenticated');
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        await logout();
        throw new Error('Session expired. Please login again.');
    }

    return response;
}

export async function fetchGlucoseData() {
    const response = await authenticatedFetch(`${API_URL}/data/glucose`);
    return await response.json();
}

export async function saveGlucoseData(date, value) {
    const response = await authenticatedFetch(`${API_URL}/data/glucose`, {
        method: 'POST',
        body: JSON.stringify({ date, value })
    });
    return await response.json();
}

export async function fetchNutritionData() {
    const response = await authenticatedFetch(`${API_URL}/data/nutrition`);
    return await response.json();
}

export async function saveNutritionData(data) {
    const response = await authenticatedFetch(`${API_URL}/data/nutrition`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    return await response.json();
}

export async function deleteNutritionData(index) {
    const response = await authenticatedFetch(`${API_URL}/data/nutrition`, {
        method: 'DELETE',
        body: JSON.stringify({ index })
    });
    return await response.json();
}

export async function fetchActivityData() {
    const response = await authenticatedFetch(`${API_URL}/data/activity`);
    return await response.json();
}

export async function saveActivityData(data) {
    const response = await authenticatedFetch(`${API_URL}/data/activity`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    return await response.json();
}

export async function deleteActivityData(index) {
    const response = await authenticatedFetch(`${API_URL}/data/activity`, {
        method: 'DELETE',
        body: JSON.stringify({ index })
    });
    return await response.json();
}

export async function fetchWeightData() {
    const response = await authenticatedFetch(`${API_URL}/data/weight`);
    return await response.json();
}

export async function saveWeightData(data) {
    const response = await authenticatedFetch(`${API_URL}/data/weight`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    return await response.json();
}

export async function deleteWeightData(index) {
    const response = await authenticatedFetch(`${API_URL}/data/weight`, {
        method: 'DELETE',
        body: JSON.stringify({ index })
    });
    return await response.json();
}

export async function fetchRiskData() {
    const response = await authenticatedFetch(`${API_URL}/data/risk`);
    return await response.json();
}

export async function saveRiskData(probability, risk_level) {
    const response = await authenticatedFetch(`${API_URL}/data/risk`, {
        method: 'POST',
        body: JSON.stringify({ probability, risk_level })
    });
    return await response.json();
}

export async function fetchGoals() {
    const response = await authenticatedFetch(`${API_URL}/data/goals`);
    return await response.json();
}

export async function saveGoals(goals) {
    const response = await authenticatedFetch(`${API_URL}/data/goals`, {
        method: 'POST',
        body: JSON.stringify(goals)
    });
    return await response.json();
}

export async function fetchStreaks() {
    const response = await authenticatedFetch(`${API_URL}/data/streaks`);
    return await response.json();
}

export async function fetchMilestones() {
    const response = await authenticatedFetch(`${API_URL}/data/milestones`);
    return await response.json();
}

export async function analyzeGoals(goals, recentData) {
    const response = await authenticatedFetch(`${API_URL}/analyze-goals`, {
        method: 'POST',
        body: JSON.stringify({ goals, recent_data: recentData })
    });
    return await response.json();
}
