import * as auth from './auth.js';

const tabs = [
    { id: 'goals', name: 'Dashboard', icon: '🎯' },
    { id: 'glucose', name: 'Glucose', icon: '📊' },
    { id: 'nutrition', name: 'Nutrition', icon: '🍎' },
    { id: 'activity', name: 'Activity', icon: '🏃' },
    { id: 'weight', name: 'Weight', icon: '⚖️' },
    { id: 'risk', name: 'Risk', icon: '⚠️' }
];

// const tabContent = {
//     goals: {
//         title: 'Goals',
//         description: 'Set and track your diabetes management goals',
//         content: 'Goal setting and tracking interface will appear here.'
//     },
//     glucose: {
//         title: 'Glucose',
//         description: 'Monitor your blood glucose levels and trends',
//         content: 'Glucose monitoring and trend analysis will appear here.'
//     },
//     nutrition: {
//         title: 'Nutrition',
//         description: 'Track your meals and nutritional intake',
//         content: 'Nutrition tracking and meal analysis will appear here.'
//     },
//     activity: {
//         title: 'Activity',
//         description: 'Log and analyze your physical activity',
//         content: 'Activity tracking and analysis will appear here.'
//     },
//     insulin: {
//         title: 'Insulin',
//         description: 'Track your insulin doses and timing',
//         content: 'Insulin tracking and dosage analysis will appear here.'
//     },
//     risk: {
//         title: 'Risk',
//         description: 'Assess your diabetes risk using ML-based prediction',
//         content: ''
//     }
// };

const tabContent = {
    goals: {
        title: '',
        description: '',
        content: 'Goal setting and tracking interface will appear here.'
    },
    glucose: {
        title: '',
        description: '',
        content: ''
    },
    nutrition: {
        title: '',
        description: '',
        content: 'Nutrition tracking and meal analysis will appear here.'
    },
    activity: {
        title: '',
        description: '',
        content: 'Activity tracking and analysis will appear here.'
    },
    weight: {
        title: '',
        description: '',
        content: 'Weight tracking and progress analysis will appear here.'
    },
    risk: {
        title: '',
        description: '',
        content: ''
    }
};

// Helper function to get local date in YYYY-MM-DD format (avoiding timezone issues)
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

let activeTab = 'goals';
let chartInstances = {};
let glucoseData = [];
let glucoseViewMode = 'week'; // day, week, month, year
let nutritionData = [];
let nutritionViewMode = 'today'; // today, week, month, year
let nutritionChartMode = 'pie'; // pie, line
let selectedNutritionDate = getLocalDateString();
let activityData = [];
let selectedActivityDate = getLocalDateString();
let activityViewMode = 'month'; // week, month, year
let activityChartMode = 'minutes'; // minutes, calories
let weightData = [];
let selectedWeightDate = getLocalDateString();
let weightViewMode = 'month'; // week, month, year
let riskViewMode = 'month'; // week, month, year

// Load data from API
let currentRiskData = null;
let currentGoals = null;
let currentStreaks = null;
let currentMilestones = [];

async function loadAllData() {
    if (!auth.isLoggedIn()) return;

    try {
        glucoseData = await auth.fetchGlucoseData();
        nutritionData = await auth.fetchNutritionData();
        activityData = await auth.fetchActivityData();
        weightData = await auth.fetchWeightData();
        currentRiskData = await auth.fetchRiskData();
        currentGoals = await auth.fetchGoals();
        currentStreaks = await auth.fetchStreaks();
        currentMilestones = await auth.fetchMilestones();
    } catch (error) {
        console.error('Error loading data:', error);
        if (error.message.includes('Session expired')) {
            showLoginScreen();
        }
    }
}

// Common foods database with macros (per serving)
const foodDatabase = {
    // Proteins
    'Chicken Breast (100g)': { carbs: 0, protein: 31, fat: 3.6, fiber: 0, calories: 165 },
    'Salmon (100g)': { carbs: 0, protein: 25, fat: 13, fiber: 0, calories: 208 },
    'Eggs (2 large)': { carbs: 1, protein: 13, fat: 10, fiber: 0, calories: 143 },
    'Greek Yogurt (1 cup)': { carbs: 9, protein: 17, fat: 5, fiber: 0, calories: 146 },
    'Tofu (100g)': { carbs: 2, protein: 8, fat: 4, fiber: 1, calories: 76 },

    // Carbs
    'Brown Rice (1 cup cooked)': { carbs: 45, protein: 5, fat: 2, fiber: 4, calories: 218 },
    'Quinoa (1 cup cooked)': { carbs: 39, protein: 8, fat: 4, fiber: 5, calories: 222 },
    'Whole Wheat Bread (2 slices)': { carbs: 24, protein: 8, fat: 2, fiber: 4, calories: 140 },
    'Oatmeal (1 cup cooked)': { carbs: 27, protein: 6, fat: 3, fiber: 4, calories: 154 },
    'Sweet Potato (medium)': { carbs: 26, protein: 2, fat: 0, fiber: 4, calories: 112 },

    // Vegetables
    'Broccoli (1 cup)': { carbs: 6, protein: 3, fat: 0, fiber: 2, calories: 31 },
    'Spinach (1 cup)': { carbs: 1, protein: 1, fat: 0, fiber: 1, calories: 7 },
    'Mixed Salad (2 cups)': { carbs: 4, protein: 2, fat: 0, fiber: 2, calories: 20 },

    // Fruits
    'Apple (medium)': { carbs: 25, protein: 0, fat: 0, fiber: 4, calories: 95 },
    'Banana (medium)': { carbs: 27, protein: 1, fat: 0, fiber: 3, calories: 105 },
    'Berries (1 cup)': { carbs: 14, protein: 1, fat: 0, fiber: 4, calories: 84 },

    // Fats
    'Avocado (half)': { carbs: 9, protein: 2, fat: 15, fiber: 7, calories: 160 },
    'Almonds (handful/28g)': { carbs: 6, protein: 6, fat: 14, fiber: 4, calories: 164 },
    'Olive Oil (1 tbsp)': { carbs: 0, protein: 0, fat: 14, fiber: 0, calories: 119 },

    // Snacks
    'Protein Shake': { carbs: 5, protein: 25, fat: 2, fiber: 1, calories: 140 },
    'Peanut Butter (2 tbsp)': { carbs: 8, protein: 8, fat: 16, fiber: 2, calories: 188 }
};

// Sample data generators
function generateGlucoseData() {
    if (glucoseData.length === 0) {
        // Return empty data
        return { labels: [], data: [] };
    }

    // Sort by date
    const sortedData = [...glucoseData].sort((a, b) => new Date(a.date + 'T00:00:00') - new Date(b.date + 'T00:00:00'));

    // Filter based on view mode
    const now = new Date();
    let filteredData = sortedData;

    switch(glucoseViewMode) {
        case 'day':
            // Last 24 hours
            const oneDayAgo = new Date(now);
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            filteredData = sortedData.filter(d => new Date(d.date + 'T00:00:00') >= oneDayAgo);
            break;
        case 'week':
            // Last 7 days
            const oneWeekAgo = new Date(now);
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            filteredData = sortedData.filter(d => new Date(d.date + 'T00:00:00') >= oneWeekAgo);
            break;
        case 'month':
            // Last 30 days
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
            filteredData = sortedData.filter(d => new Date(d.date + 'T00:00:00') >= oneMonthAgo);
            break;
        case 'year':
            // Last 365 days
            const oneYearAgo = new Date(now);
            oneYearAgo.setDate(oneYearAgo.getDate() - 365);
            filteredData = sortedData.filter(d => new Date(d.date + 'T00:00:00') >= oneYearAgo);
            break;
    }

    const labels = filteredData.map(d => {
        const date = new Date(d.date + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = filteredData.map(d => d.value);
    return { labels, data };
}

function generateNutritionData() {
    if (nutritionData.length === 0) {
        return {
            labels: ['Carbs', 'Protein', 'Fat', 'Fiber'],
            data: [0, 0, 0, 0],
            calories: 0
        };
    }

    // Filter based on chart mode and view mode
    let filteredFoods = nutritionData;

    // When in pie chart mode (Today), only show selected date
    if (nutritionChartMode === 'pie') {
        filteredFoods = nutritionData.filter(item => item.date === selectedNutritionDate);
    } else {
        // When in line chart mode (History), filter by time range
        const selectedDate = new Date(selectedNutritionDate + 'T00:00:00');

        switch(nutritionViewMode) {
            case 'week':
                const oneWeekAgo = new Date(selectedDate);
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                filteredFoods = nutritionData.filter(item => {
                    const itemDate = new Date(item.date + 'T00:00:00');
                    return itemDate >= oneWeekAgo && itemDate <= selectedDate;
                });
                break;
            case 'month':
                const oneMonthAgo = new Date(selectedDate);
                oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
                filteredFoods = nutritionData.filter(item => {
                    const itemDate = new Date(item.date + 'T00:00:00');
                    return itemDate >= oneMonthAgo && itemDate <= selectedDate;
                });
                break;
            case 'year':
                const oneYearAgo = new Date(selectedDate);
                oneYearAgo.setDate(oneYearAgo.getDate() - 365);
                filteredFoods = nutritionData.filter(item => {
                    const itemDate = new Date(item.date + 'T00:00:00');
                    return itemDate >= oneYearAgo && itemDate <= selectedDate;
                });
                break;
        }
    }

    const totals = filteredFoods.reduce((acc, item) => {
        acc.carbs += item.carbs;
        acc.protein += item.protein;
        acc.fat += item.fat;
        acc.fiber += item.fiber;
        acc.calories += item.calories;
        return acc;
    }, { carbs: 0, protein: 0, fat: 0, fiber: 0, calories: 0 });

    return {
        labels: ['Carbs', 'Protein', 'Fat', 'Fiber'],
        data: [totals.carbs, totals.protein, totals.fat, totals.fiber],
        calories: totals.calories
    };
}

function generateNutritionHistoryData() {
    if (nutritionData.length === 0) {
        return { labels: [], calories: [], carbs: [] };
    }

    // Group by date and sum totals
    const dateMap = {};
    nutritionData.forEach(item => {
        if (!dateMap[item.date]) {
            dateMap[item.date] = { calories: 0, carbs: 0, protein: 0, fat: 0 };
        }
        dateMap[item.date].calories += item.calories;
        dateMap[item.date].carbs += item.carbs;
        dateMap[item.date].protein += item.protein;
        dateMap[item.date].fat += item.fat;
    });

    // Sort by date
    const sortedDates = Object.keys(dateMap).sort((a, b) => new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00'));

    // Filter based on view mode and selected date
    const selectedDate = new Date(selectedNutritionDate + 'T00:00:00');
    let filteredDates = sortedDates;

    switch(nutritionViewMode) {
        case 'today':
            filteredDates = sortedDates.filter(d => d === selectedNutritionDate);
            break;
        case 'week':
            const oneWeekAgo = new Date(selectedDate);
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            filteredDates = sortedDates.filter(d => {
                const itemDate = new Date(d + 'T00:00:00');
                return itemDate >= oneWeekAgo && itemDate <= selectedDate;
            });
            break;
        case 'month':
            const oneMonthAgo = new Date(selectedDate);
            oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
            filteredDates = sortedDates.filter(d => {
                const itemDate = new Date(d + 'T00:00:00');
                return itemDate >= oneMonthAgo && itemDate <= selectedDate;
            });
            break;
        case 'year':
            const oneYearAgo = new Date(selectedDate);
            oneYearAgo.setDate(oneYearAgo.getDate() - 365);
            filteredDates = sortedDates.filter(d => {
                const itemDate = new Date(d + 'T00:00:00');
                return itemDate >= oneYearAgo && itemDate <= selectedDate;
            });
            break;
    }

    const labels = filteredDates.map(d => {
        const date = new Date(d + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const calories = filteredDates.map(d => Math.round(dateMap[d].calories));
    const carbs = filteredDates.map(d => Math.round(dateMap[d].carbs));

    return { labels, calories, carbs };
}

function generateActivityData() {
    if (activityData.length === 0) {
        return { labels: [], minutes: [], calories: [] };
    }

    // Group activities by date and sum minutes + calculate calories
    const dateMap = {};
    activityData.forEach(item => {
        if (!dateMap[item.date]) {
            dateMap[item.date] = { minutes: 0, calories: 0 };
        }
        dateMap[item.date].minutes += item.minutes;
        // Use stored calories if available (from AI), otherwise estimate at 5 cal/min
        if (item.calories) {
            dateMap[item.date].calories += item.calories;
        } else {
            dateMap[item.date].calories += item.minutes * 5;
        }
    });

    // Sort by date
    const sortedDates = Object.keys(dateMap).sort((a, b) => new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00'));
    const now = new Date();
    let filteredDates = sortedDates;

    // Filter based on view mode
    switch(activityViewMode) {
        case 'week':
            const oneWeekAgo = new Date(now);
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            filteredDates = sortedDates.filter(d => new Date(d + 'T00:00:00') >= oneWeekAgo);
            break;
        case 'month':
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
            filteredDates = sortedDates.filter(d => new Date(d + 'T00:00:00') >= oneMonthAgo);
            break;
        case 'year':
            const oneYearAgo = new Date(now);
            oneYearAgo.setDate(oneYearAgo.getDate() - 365);
            filteredDates = sortedDates.filter(d => new Date(d + 'T00:00:00') >= oneYearAgo);
            break;
    }

    const labels = filteredDates.map(d => {
        const date = new Date(d + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const minutes = filteredDates.map(d => dateMap[d].minutes);
    const calories = filteredDates.map(d => dateMap[d].calories);

    return { labels, minutes, calories };
}

function generateWeightData() {
    if (weightData.length === 0) {
        return { labels: [], data: [] };
    }

    // Group by date (take latest weight for each day)
    const dateMap = {};
    weightData.forEach(item => {
        dateMap[item.date] = item.weight;
    });

    // Sort by date
    const sortedDates = Object.keys(dateMap).sort((a, b) => new Date(a + 'T00:00:00') - new Date(b + 'T00:00:00'));

    // Filter based on view mode
    const now = new Date();
    let filteredDates = sortedDates;

    switch(weightViewMode) {
        case 'week':
            const oneWeekAgo = new Date(now);
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            filteredDates = sortedDates.filter(d => new Date(d + 'T00:00:00') >= oneWeekAgo);
            break;
        case 'month':
            const oneMonthAgo = new Date(now);
            oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
            filteredDates = sortedDates.filter(d => new Date(d + 'T00:00:00') >= oneMonthAgo);
            break;
        case 'year':
            const oneYearAgo = new Date(now);
            oneYearAgo.setDate(oneYearAgo.getDate() - 365);
            filteredDates = sortedDates.filter(d => new Date(d + 'T00:00:00') >= oneYearAgo);
            break;
    }

    const labels = filteredDates.map(d => {
        const date = new Date(d + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = filteredDates.map(d => dateMap[d]);

    return { labels, data };
}

function generateRiskHistoryData() {
    const labels = [];
    const data = [];
    const now = new Date();

    let periods, dateFormat;
    switch(riskViewMode) {
        case 'week':
            periods = 7;
            for (let i = periods - 1; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                data.push(Math.floor(Math.random() * 3) + 3); // Random risk level 3-6
            }
            break;
        case 'month':
            periods = 30;
            for (let i = periods - 1; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                data.push(Math.floor(Math.random() * 3) + 3);
            }
            break;
        case 'year':
            periods = 12;
            for (let i = periods - 1; i >= 0; i--) {
                const date = new Date(now);
                date.setMonth(date.getMonth() - i);
                labels.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
                data.push(Math.floor(Math.random() * 3) + 3);
            }
            break;
    }

    return { labels, data };
}

function renderGlucoseTab() {
    const avgGlucose = glucoseData.length > 0
        ? Math.round(glucoseData.reduce((sum, d) => sum + d.value, 0) / glucoseData.length)
        : 0;

    const targetRange = currentGoals && currentGoals.glucose_min && currentGoals.glucose_max
        ? `${currentGoals.glucose_min}-${currentGoals.glucose_max} mg/dL`
        : '80-130 mg/dL';

    return `
        <div class="glucose-container">
            <div class="glucose-input-section">
                <h3>Add Glucose Reading</h3>
                <form id="glucose-form">
                    <div class="glucose-form-grid">
                        <div class="form-group">
                            <label for="glucose-date">Date</label>
                            <input type="date" id="glucose-date" required value="${getLocalDateString()}">
                        </div>
                        <div class="form-group">
                            <label for="glucose-value">Blood Glucose (mg/dL)</label>
                            <input type="number" id="glucose-value" min="20" max="600" step="1" placeholder="Enter value" required>
                        </div>
                        <div class="form-group-button">
                            <button type="submit" class="btn-primary">Add Reading</button>
                        </div>
                    </div>
                </form>
            </div>

            <div class="chart-container">
                <div class="chart-header">
                    <h3>Blood Glucose History</h3>
                    <div class="view-selector">
                        <button class="view-btn ${glucoseViewMode === 'week' ? 'active' : ''}" data-view="week">Week</button>
                        <button class="view-btn ${glucoseViewMode === 'month' ? 'active' : ''}" data-view="month">Month</button>
                        <button class="view-btn ${glucoseViewMode === 'year' ? 'active' : ''}" data-view="year">Year</button>
                    </div>
                </div>
                <canvas id="glucose-chart"></canvas>
                <div class="chart-stats">
                    <div class="stat-card">
                        <span class="stat-label">Average</span>
                        <span class="stat-value">${avgGlucose} mg/dL</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Target Range</span>
                        <span class="stat-value">${targetRange}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Total Readings</span>
                        <span class="stat-value">${glucoseData.length}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderNutritionTab() {
    const nutritionStats = generateNutritionData();
    const totalMacros = nutritionStats.data.slice(0, 3).reduce((a, b) => a + b, 0);
    const carbsPercent = totalMacros > 0 ? Math.round((nutritionStats.data[0] / totalMacros) * 100) : 0;

    const calorieTarget = currentGoals && currentGoals.calorie_target
        ? `${currentGoals.calorie_target} kcal`
        : '1,800-2,200 kcal';
    const carbGoal = currentGoals && currentGoals.carb_target
        ? `${currentGoals.carb_target}g`
        : '45-60% of calories';

    return `
        <div class="nutrition-container">
            <div class="nutrition-input-section">
                <div class="date-selector-section">
                    <label for="nutrition-date">Select Date:</label>
                    <input type="date" id="nutrition-date" value="${selectedNutritionDate}">
                </div>

                <h3>Add Food</h3>

                <div class="input-tabs">
                    <button class="tab-btn active" data-tab="quick">Quick Select</button>
                    <button class="tab-btn" data-tab="barcode">Scan Barcode</button>
                    <button class="tab-btn" data-tab="ai">AI Description</button>
                </div>

                <div id="quick-input" class="input-tab-content active">
                    <form id="nutrition-form">
                        <div class="nutrition-form-grid">
                            <div class="form-group">
                                <label for="food-select">Select Food</label>
                                <select id="food-select" required>
                                <option value="">Choose a food...</option>
                                <optgroup label="Proteins">
                                    ${Object.keys(foodDatabase).filter(f =>
                                        f.includes('Chicken') || f.includes('Salmon') || f.includes('Eggs') ||
                                        f.includes('Greek') || f.includes('Tofu')
                                    ).map(food => `<option value="${food}">${food}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Carbs">
                                    ${Object.keys(foodDatabase).filter(f =>
                                        f.includes('Rice') || f.includes('Quinoa') || f.includes('Bread') ||
                                        f.includes('Oatmeal') || f.includes('Potato')
                                    ).map(food => `<option value="${food}">${food}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Vegetables">
                                    ${Object.keys(foodDatabase).filter(f =>
                                        f.includes('Broccoli') || f.includes('Spinach') || f.includes('Salad')
                                    ).map(food => `<option value="${food}">${food}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Fruits">
                                    ${Object.keys(foodDatabase).filter(f =>
                                        f.includes('Apple') || f.includes('Banana') || f.includes('Berries')
                                    ).map(food => `<option value="${food}">${food}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Fats">
                                    ${Object.keys(foodDatabase).filter(f =>
                                        f.includes('Avocado') || f.includes('Almonds') || f.includes('Olive')
                                    ).map(food => `<option value="${food}">${food}</option>`).join('')}
                                </optgroup>
                                <optgroup label="Snacks">
                                    ${Object.keys(foodDatabase).filter(f =>
                                        f.includes('Protein Shake') || f.includes('Peanut')
                                    ).map(food => `<option value="${food}">${food}</option>`).join('')}
                                </optgroup>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="servings">Servings</label>
                            <input type="number" id="servings" min="0.25" max="10" step="0.25" value="1" required>
                        </div>
                            <div class="form-group-button">
                                <button type="submit" class="btn-primary">Add Food</button>
                            </div>
                        </div>
                    </form>
                </div>

                <div id="barcode-input" class="input-tab-content">
                    <form id="barcode-form">
                        <div class="barcode-form-container">
                            <div class="form-group">
                                <label>Scan Product Photo with AI</label>
                                <input type="file" id="barcode-photo" accept="image/*" capture="environment" style="margin-bottom: 1rem;">
                                <button type="button" class="btn-secondary" id="photo-scan-btn">
                                    <span class="btn-text">📷 Scan Photo</span>
                                    <span class="btn-loading hidden">Scanning...</span>
                                </button>
                                <p style="font-size: 0.85rem; color: #718096; margin-top: 0.5rem;">AI will read the barcode and servings from the photo</p>
                            </div>
                            <div style="text-align: center; margin: 1rem 0; color: #a0aec0; font-weight: 600;">OR</div>
                            <div class="form-group">
                                <label for="barcode-input-field">Enter Barcode Number Manually</label>
                                <input type="text" id="barcode-input-field" placeholder="e.g., 737628064502" pattern="[0-9]+" inputmode="numeric">
                            </div>
                            <div class="form-group">
                                <label for="barcode-servings">Servings</label>
                                <input type="number" id="barcode-servings" min="0.5" step="0.5" value="1" required>
                            </div>
                            <button type="submit" class="btn-primary" id="barcode-scan-btn">
                                <span class="btn-text">🔍 Look Up Product</span>
                                <span class="btn-loading hidden">Looking up...</span>
                            </button>
                        </div>
                        <div id="barcode-result" class="barcode-result"></div>
                    </form>
                </div>

                <div id="ai-input" class="input-tab-content">
                    <form id="ai-nutrition-form">
                        <div class="ai-form-container">
                            <div class="form-group">
                                <label for="food-description">Describe what you ate</label>
                                <textarea id="food-description" rows="3" placeholder="E.g., I had a turkey sandwich with lettuce and tomato, a side of chips, and an apple" required></textarea>
                            </div>
                            <button type="submit" class="btn-primary" id="ai-analyze-btn">
                                <span class="btn-text">Analyze with AI</span>
                                <span class="btn-loading hidden">Analyzing...</span>
                            </button>
                        </div>
                    </form>
                </div>

                <div id="todays-foods" class="todays-foods">
                    ${renderTodaysFoods()}
                </div>
            </div>

            <div class="chart-container">
                <div class="chart-header">
                    <h3>Nutrition Overview</h3>
                    <div class="view-selector">
                        <button class="view-btn ${nutritionChartMode === 'pie' ? 'active' : ''}" data-mode="pie">Today</button>
                        <button class="view-btn ${nutritionChartMode === 'line' ? 'active' : ''}" data-mode="line">History</button>
                    </div>
                </div>
                ${nutritionChartMode === 'line' ? `
                    <div class="view-selector" style="margin-bottom: 1rem;">
                        <button class="view-btn ${nutritionViewMode === 'week' ? 'active' : ''}" data-view="week">Week</button>
                        <button class="view-btn ${nutritionViewMode === 'month' ? 'active' : ''}" data-view="month">Month</button>
                        <button class="view-btn ${nutritionViewMode === 'year' ? 'active' : ''}" data-view="year">Year</button>
                    </div>
                ` : ''}

                ${nutritionChartMode === 'pie' ? `
                    <div class="chart-wrapper-small">
                        <canvas id="nutrition-chart"></canvas>
                    </div>
                    <div class="chart-stats">
                        <div class="stat-card">
                            <span class="stat-label">Total Calories</span>
                            <span class="stat-value">${nutritionStats.calories} kcal</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Carbs</span>
                            <span class="stat-value">${nutritionStats.data[0]}g (${carbsPercent}%)</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Protein</span>
                            <span class="stat-value">${nutritionStats.data[1]}g</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Fat</span>
                            <span class="stat-value">${nutritionStats.data[2]}g</span>
                        </div>
                    </div>
                ` : `
                    <canvas id="nutrition-history-chart"></canvas>
                    <div class="chart-stats">
                        <div class="stat-card">
                            <span class="stat-label">Target Calories</span>
                            <span class="stat-value">${calorieTarget}</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label">Carb Goal</span>
                            <span class="stat-value">${carbGoal}</span>
                        </div>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderTodaysFoods() {
    // Use the stored selected date
    const selectedDate = selectedNutritionDate;
    const selectedFoods = nutritionData.filter(item => item.date === selectedDate);

    const dateLabel = selectedDate === getLocalDateString()
        ? "Today's"
        : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (selectedFoods.length === 0) {
        return `<p class="no-foods">No foods added for ${dateLabel === "Today's" ? "today" : dateLabel}</p>`;
    }

    const totalCals = selectedFoods.reduce((sum, item) => sum + item.calories, 0);

    return `
        <div class="foods-list">
            <div class="foods-list-header">
                <h4>${dateLabel} Foods:</h4>
                <span class="foods-total">${Math.round(totalCals)} kcal total</span>
            </div>
            ${selectedFoods.map((item, index) => `
                <div class="food-item">
                    <span class="food-name">${item.name} ${item.servings > 1 ? `(${item.servings}x)` : ''}</span>
                    <span class="food-calories">${Math.round(item.calories)} kcal</span>
                    <button class="btn-remove" data-date="${item.date}" data-index="${index}">×</button>
                </div>
            `).join('')}
        </div>
    `;
}

function renderActivityTab() {
    const totalMinutes = activityData.reduce((sum, d) => sum + d.minutes, 0);
    const totalCalories = totalMinutes * 5; // ~5 calories per minute
    const uniqueDates = [...new Set(activityData.map(d => d.date))];
    const avgMinutes = uniqueDates.length > 0 ? Math.round(totalMinutes / uniqueDates.length) : 0;
    const avgCalories = uniqueDates.length > 0 ? Math.round(totalCalories / uniqueDates.length) : 0;

    // Choose display values based on chart mode
    const avgValue = activityChartMode === 'calories' ? avgCalories : avgMinutes;
    const avgUnit = activityChartMode === 'calories' ? 'cal' : 'min';

    // Use goal if set, otherwise show default
    const weeklyGoalValue = currentGoals && currentGoals.activity_weekly_minutes
        ? (activityChartMode === 'calories' ? currentGoals.activity_weekly_minutes * 7 : currentGoals.activity_weekly_minutes)
        : (activityChartMode === 'calories' ? '1,050' : '150');
    const weeklyGoalUnit = activityChartMode === 'calories' ? 'cal' : 'min';

    return `
        <div class="activity-container">
            <div class="activity-input-section">
                <h3>Log Activity</h3>

                <div class="input-tabs">
                    <button class="tab-btn active" data-tab="quick">Quick Log</button>
                    <button class="tab-btn" data-tab="ai">AI Calculate</button>
                </div>

                <div id="quick-input" class="input-tab-content active">
                    <form id="activity-form">
                        <div class="activity-form-grid">
                            <div class="form-group">
                                <label for="activity-date">Date</label>
                                <input type="date" id="activity-date" required value="${selectedActivityDate}">
                            </div>
                            <div class="form-group">
                                <label for="activity-minutes">Minutes of Activity</label>
                                <input type="number" id="activity-minutes" min="1" max="1440" step="1" placeholder="Enter minutes" required>
                            </div>
                            <div class="form-group">
                                <label for="activity-type">Activity Type</label>
                                <select id="activity-type" required>
                                    <option value="">Select type...</option>
                                    <option value="Walking">Walking</option>
                                    <option value="Running">Running</option>
                                    <option value="Cycling">Cycling</option>
                                    <option value="Swimming">Swimming</option>
                                    <option value="Strength Training">Strength Training</option>
                                    <option value="Yoga">Yoga</option>
                                    <option value="Sports">Sports</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div class="form-group-button">
                                <button type="submit" class="btn-primary">Add Activity</button>
                            </div>
                        </div>
                    </form>
                </div>

                <div id="ai-input" class="input-tab-content">
                    <form id="ai-activity-form">
                        <div class="ai-form-container">
                            <div class="form-group">
                                <label for="ai-activity-date">Date</label>
                                <input type="date" id="ai-activity-date" required value="${selectedActivityDate}">
                            </div>
                            <div class="form-group">
                                <label for="ai-activity-description">Describe your activity</label>
                                <textarea id="ai-activity-description" rows="3" placeholder="E.g., I played basketball for 45 minutes, or I did 30 minutes of rock climbing" required></textarea>
                            </div>
                            <button type="submit" class="btn-primary" id="ai-activity-btn">
                                <span class="btn-text">Calculate Calories</span>
                                <span class="btn-loading hidden">Calculating...</span>
                            </button>
                        </div>
                    </form>
                </div>

                <div id="activity-log" class="activity-log">
                    ${renderActivityLog()}
                </div>
            </div>

            <div class="chart-container">
                <div class="chart-header">
                    <h3>Activity History</h3>
                    <div class="view-selector">
                        <button class="view-btn ${activityViewMode === 'week' ? 'active' : ''}" data-view="week">Week</button>
                        <button class="view-btn ${activityViewMode === 'month' ? 'active' : ''}" data-view="month">Month</button>
                        <button class="view-btn ${activityViewMode === 'year' ? 'active' : ''}" data-view="year">Year</button>
                    </div>
                </div>
                <div class="view-selector">
                    <button class="view-btn ${activityChartMode === 'minutes' ? 'active' : ''}" data-mode="minutes">Minutes</button>
                    <button class="view-btn ${activityChartMode === 'calories' ? 'active' : ''}" data-mode="calories">Calories</button>
                </div>
                <canvas id="activity-chart"></canvas>
                <div class="chart-stats">
                    <div class="stat-card">
                        <span class="stat-label">Average Daily</span>
                        <span class="stat-value">${avgValue} ${avgUnit}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Weekly Goal</span>
                        <span class="stat-value">${weeklyGoalValue} ${weeklyGoalUnit}</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Total Activities</span>
                        <span class="stat-value">${activityData.length}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderActivityLog() {
    // Use the stored selected date
    const selectedDate = selectedActivityDate;

    // Filter activities for selected date only
    const dateActivities = activityData
        .map((item, index) => ({ ...item, globalIndex: index }))
        .filter(item => item.date === selectedDate);

    if (dateActivities.length === 0) {
        const dateLabel = selectedDate === getLocalDateString()
            ? 'today'
            : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<p class="no-activities">No activities logged for ${dateLabel}</p>`;
    }

    const totalMins = dateActivities.reduce((sum, a) => sum + a.minutes, 0);
    const totalCals = dateActivities.reduce((sum, a) => sum + (a.calories || a.minutes * 5), 0);
    const dateLabel = selectedDate === getLocalDateString()
        ? 'Today'
        : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });

    return `
        <div class="activity-list">
            <div class="activity-date-group">
                <div class="activity-date-header">
                    <span class="activity-date-label">${dateLabel}'s Activities</span>
                    <span class="activity-date-total">${totalMins} min / ${totalCals} cal</span>
                </div>
                ${dateActivities.map(activity => {
                    const activityCals = activity.calories || activity.minutes * 5;
                    return `
                    <div class="activity-item">
                        <span class="activity-type-icon">${getActivityIcon(activity.type)}</span>
                        <span class="activity-type-name">${activity.type}</span>
                        <span class="activity-minutes">${activity.minutes} min${activity.calories ? ` (${activityCals} cal)` : ''}</span>
                        <button class="btn-remove-small" data-index="${activity.globalIndex}">×</button>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function getActivityIcon(type) {
    const icons = {
        'Walking': '🚶',
        'Running': '🏃',
        'Cycling': '🚴',
        'Swimming': '🏊',
        'Strength Training': '💪',
        'Yoga': '🧘',
        'Sports': '⚽',
        'Other': '🏋️'
    };
    return icons[type] || '🏋️';
}

function renderWeightTab() {
    const avgWeight = weightData.length > 0
        ? (weightData.reduce((sum, d) => sum + d.weight, 0) / weightData.length).toFixed(1)
        : 0;
    const latestWeight = weightData.length > 0 ? weightData[weightData.length - 1].weight : 0;
    const weightChange = weightData.length >= 2
        ? (weightData[weightData.length - 1].weight - weightData[0].weight).toFixed(1)
        : 0;

    return `
        <div class="weight-container">
            <div class="weight-input-section">
                <div class="date-selector-section">
                    <label for="weight-date">Select Date:</label>
                    <input type="date" id="weight-date" value="${selectedWeightDate}">
                </div>

                <h3>Log Weight</h3>
                <form id="weight-form">
                    <div class="weight-form-grid">
                        <div class="form-group">
                            <label for="weight-value">Weight (lbs)</label>
                            <input type="number" id="weight-value" min="50" max="500" step="0.1" placeholder="Enter weight" required>
                        </div>
                        <div class="form-group-button">
                            <button type="submit" class="btn-primary">Add Weight</button>
                        </div>
                    </div>
                </form>

                <div id="weight-log" class="weight-log">
                    ${renderWeightLog()}
                </div>
            </div>

            <div class="chart-container weight-chart-full">
                <div class="chart-header">
                    <h3>Weight History</h3>
                    <div class="view-selector">
                        <button class="view-btn ${weightViewMode === 'week' ? 'active' : ''}" data-view="week">Week</button>
                        <button class="view-btn ${weightViewMode === 'month' ? 'active' : ''}" data-view="month">Month</button>
                        <button class="view-btn ${weightViewMode === 'year' ? 'active' : ''}" data-view="year">Year</button>
                    </div>
                </div>
                <canvas id="weight-chart"></canvas>
                <div class="chart-stats">
                    <div class="stat-card">
                        <span class="stat-label">Current Weight</span>
                        <span class="stat-value">${latestWeight} lbs</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Average Weight</span>
                        <span class="stat-value">${avgWeight} lbs</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Total Change</span>
                        <span class="stat-value ${weightChange < 0 ? 'positive' : ''}">${weightChange > 0 ? '+' : ''}${weightChange} lbs</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">${currentGoals && currentGoals.weight_target ? 'Target Weight' : 'Entries'}</span>
                        <span class="stat-value">${currentGoals && currentGoals.weight_target ? currentGoals.weight_target + ' lbs' : weightData.length}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderWeightLog() {
    // Use the stored selected date
    const selectedDate = selectedWeightDate;

    // Filter weight entries for selected date only
    const dateWeights = weightData
        .map((item, index) => ({ ...item, globalIndex: index }))
        .filter(item => item.date === selectedDate);

    if (dateWeights.length === 0) {
        const dateLabel = selectedDate === getLocalDateString()
            ? 'today'
            : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `<p class="no-weight">No weight logged for ${dateLabel}</p>`;
    }

    const dateLabel = selectedDate === getLocalDateString()
        ? 'Today'
        : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });

    return `
        <div class="weight-list">
            <h4>${dateLabel}'s Weight</h4>
            ${dateWeights.map(entry => {
                return `
                    <div class="weight-item">
                        <span class="weight-date">${dateLabel}</span>
                        <span class="weight-value">${entry.weight} lbs</span>
                        <button class="btn-remove-small" data-index="${entry.globalIndex}">×</button>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderRiskCalculator() {
    return `
        <div class="risk-calculator">
            <div class="risk-calculator-header">
                <h2>Diabetes Risk Assessment</h2>
                <p class="risk-subtitle">Enter your health information to calculate your diabetes risk using NHANES data</p>
            </div>

            <form id="risk-form" class="risk-form">
                <div class="form-grid-2col">
                    <div class="form-group">
                        <label for="gender">
                            Gender <span class="required">*</span>
                        </label>
                        <select id="gender" required>
                            <option value="">Select...</option>
                            <option value="1">Male</option>
                            <option value="2">Female</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="age">
                            Age (years) <span class="required">*</span>
                        </label>
                        <input type="number" id="age" min="18" max="120" step="1" placeholder="e.g., 45" required>
                    </div>

                    <div class="form-group full-width">
                        <label for="race">
                            Race/Ethnicity (NHANES RIDRETH1) <span class="required">*</span>
                            <span class="info-tooltip" title="Based on NHANES survey categories. Self-reported race and Hispanic origin.">ⓘ</span>
                        </label>
                        <select id="race" required>
                            <option value="">Select...</option>
                            <option value="1">Mexican American</option>
                            <option value="2">Other Hispanic</option>
                            <option value="3">Non-Hispanic White</option>
                            <option value="4">Non-Hispanic Black</option>
                            <option value="5">Other Race (including Non-Hispanic Asian and Multi-racial)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="weight">
                            Weight (kg) <span class="required">*</span>
                            <span class="conversion-hint">1 lb = 0.453 kg</span>
                        </label>
                        <input type="number" id="weight" min="30" max="300" step="0.1" placeholder="e.g., 95.3" required>
                    </div>

                    <div class="form-group">
                        <label for="height">
                            Height (cm) <span class="required">*</span>
                            <span class="conversion-hint">1 in = 2.54 cm</span>
                        </label>
                        <input type="number" id="height" min="100" max="250" step="0.1" placeholder="e.g., 177.8" required>
                    </div>

                    <div class="form-group">
                        <label for="waist">
                            Waist Circumference (cm)
                            <span class="info-tooltip" title="Measure around your natural waistline, above your hip bone">ⓘ</span>
                        </label>
                        <input type="number" id="waist" min="50" max="200" step="0.1" placeholder="Optional">
                    </div>

                    <div class="form-group">
                        <label for="hip">
                            Hip Circumference (cm)
                            <span class="info-tooltip" title="Measure around the widest part of your hips">ⓘ</span>
                        </label>
                        <input type="number" id="hip" min="50" max="200" step="0.1" placeholder="Optional">
                    </div>
                </div>

                <button type="submit" class="btn-calculate">🔬 Calculate My Risk</button>
            </form>

            <div id="risk-results" class="risk-results hidden">
                <h3>Your Risk Assessment Results</h3>
                <div class="result-cards-grid">
                    <div class="result-card">
                        <div class="result-icon">📊</div>
                        <div class="metric">
                            <span class="metric-label">
                                Risk Probability
                                <span class="info-tooltip" title="The likelihood of developing Type 2 diabetes based on your health metrics">ⓘ</span>
                            </span>
                            <span class="metric-value large" id="probability">-</span>
                        </div>
                    </div>
                    <div class="result-card">
                        <div class="result-icon">⚠️</div>
                        <div class="metric">
                            <span class="metric-label">
                                Risk Level
                                <span class="info-tooltip" title="Risk level on a scale of 1-10, where 1 is lowest risk and 10 is highest">ⓘ</span>
                            </span>
                            <span class="metric-value large" id="risk-level">-</span>
                        </div>
                    </div>
                </div>

                <div class="risk-bar-container">
                    <div class="risk-bar">
                        <div class="risk-bar-fill" id="risk-bar-fill"></div>
                    </div>
                    <div class="risk-bar-labels">
                        <span>Low</span>
                        <span>Moderate</span>
                        <span>High</span>
                    </div>
                </div>

                <div id="risk-interpretation" class="risk-interpretation">
                    <!-- Will be populated with interpretation based on risk level -->
                </div>
            </div>
        </div>
    `;
}

function renderGoalsTab() {
    // Get the most recent risk calculation from database
    let riskDisplay = 'No risk assessment yet';
    let riskLevel = '-';
    let riskProbability = '-';
    let riskBarWidth = '0%';
    let riskBarColor = '#e2e8f0';

    if (currentRiskData) {
        riskProbability = `${(currentRiskData.probability * 100).toFixed(1)}%`;
        riskLevel = currentRiskData.risk_level;
        riskBarWidth = `${currentRiskData.probability * 100}%`;

        if (currentRiskData.risk_level <= 3) {
            riskBarColor = '#48bb78';
        } else if (currentRiskData.risk_level <= 6) {
            riskBarColor = '#ed8936';
        } else {
            riskBarColor = '#f56565';
        }
    }

    return `
        <div class="goals-container">
            <div class="current-risk-section">
                <h3>Current Risk Assessment</h3>
                <div class="risk-display">
                    <div class="metric">
                        <span class="metric-label">Risk Probability</span>
                        <span class="metric-value">${riskProbability}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Risk Level (1-10)</span>
                        <span class="metric-value">${riskLevel}</span>
                    </div>
                    <div class="risk-bar">
                        <div class="risk-bar-fill" style="width: ${riskBarWidth}; background-color: ${riskBarColor};"></div>
                    </div>
                </div>
            </div>

            ${currentGoals ? `
                <div class="current-goals-section">
                    <h3>Your Current Goals</h3>
                    <div class="current-goals-grid">
                        ${currentGoals.glucose_min && currentGoals.glucose_max ? `
                            <div class="current-goal-item">
                                <span class="goal-icon">📊</span>
                                <div>
                                    <div class="goal-name">Glucose Range</div>
                                    <div class="goal-value">${currentGoals.glucose_min}-${currentGoals.glucose_max} mg/dL</div>
                                </div>
                            </div>
                        ` : ''}
                        ${currentGoals.calorie_target ? `
                            <div class="current-goal-item">
                                <span class="goal-icon">🍎</span>
                                <div>
                                    <div class="goal-name">Daily Calories</div>
                                    <div class="goal-value">${currentGoals.calorie_target} kcal</div>
                                </div>
                            </div>
                        ` : ''}
                        ${currentGoals.carb_target ? `
                            <div class="current-goal-item">
                                <span class="goal-icon">🍎</span>
                                <div>
                                    <div class="goal-name">Daily Carbs</div>
                                    <div class="goal-value">${currentGoals.carb_target}g</div>
                                </div>
                            </div>
                        ` : ''}
                        ${currentGoals.activity_weekly_minutes ? `
                            <div class="current-goal-item">
                                <span class="goal-icon">🏃</span>
                                <div>
                                    <div class="goal-name">Weekly Activity</div>
                                    <div class="goal-value">${currentGoals.activity_weekly_minutes} min</div>
                                </div>
                            </div>
                        ` : ''}
                        ${currentGoals.weight_target ? `
                            <div class="current-goal-item">
                                <span class="goal-icon">⚖️</span>
                                <div>
                                    <div class="goal-name">Target Weight</div>
                                    <div class="goal-value">${currentGoals.weight_target} lbs</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}

            ${currentStreaks ? `
                <div class="streaks-section">
                    <h3>🔥 Your Streak</h3>
                    <div class="streak-display">
                        <div class="streak-card">
                            <span class="streak-label">Current Streak</span>
                            <span class="streak-value">${currentStreaks.current_streak} days</span>
                        </div>
                        <div class="streak-card">
                            <span class="streak-label">Longest Streak</span>
                            <span class="streak-value">${currentStreaks.longest_streak} days</span>
                        </div>
                    </div>
                    <p class="streak-message">
                        ${currentStreaks.current_streak > 0
                            ? `Keep it up! You're on a ${currentStreaks.current_streak}-day streak 🎉`
                            : 'Start tracking today to begin your streak!'}
                    </p>
                </div>
            ` : ''}

            ${currentMilestones && currentMilestones.length > 0 ? `
                <div class="milestones-section">
                    <h3>🏆 Milestones Achieved</h3>
                    <div class="milestones-grid">
                        ${currentMilestones.slice(0, 6).map(milestone => {
                            const milestoneIcons = {
                                '3_day_streak': '🥉',
                                '7_day_streak': '🥈',
                                '14_day_streak': '🥇',
                                '30_day_streak': '🌟',
                                '60_day_streak': '💎',
                                '100_day_streak': '👑'
                            };
                            const icon = milestoneIcons[milestone.name] || '🏆';
                            const displayName = milestone.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                            return `
                                <div class="milestone-badge">
                                    <span class="milestone-icon">${icon}</span>
                                    <span class="milestone-name">${displayName}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}

            ${currentGoals ? `
                <div class="goal-analysis-section">
                    <div class="analysis-header">
                        <h3>AI Progress Analysis</h3>
                        <button id="analyze-goals-btn" class="btn-analyze">
                            <span>🤖</span> Analyze My Progress
                        </button>
                    </div>
                    <div id="goal-analysis-results" class="analysis-results hidden">
                        <div class="analysis-loading">
                            <div class="spinner"></div>
                            <p>Analyzing your progress...</p>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="export-section">
                <h3>Export Data for Doctor</h3>
                <p style="color: #718096; margin-bottom: 1rem;">Download your health data to share with your healthcare provider</p>
                <div class="export-buttons">
                    <button id="export-csv-btn" class="btn-export">
                        📊 Export CSV
                    </button>
                    <button id="export-pdf-btn" class="btn-export">
                        📄 Export PDF Report
                    </button>
                </div>
            </div>

            <h3 style="margin-top: 2rem;">Set Your Goals</h3>
            <div class="goals-grid">
                <div class="goal-card">
                    <div class="goal-header">
                        <span class="goal-icon">📊</span>
                        <h4>Glucose Goal</h4>
                    </div>
                    <form class="goal-form" id="glucose-goal-form">
                        <div class="form-group">
                            <label for="glucose-target">Target Range (mg/dL)</label>
                            <div class="range-inputs">
                                <input type="number" id="glucose-min" placeholder="Min" min="0" step="1" value="${currentGoals?.glucose_min || ''}">
                                <span>-</span>
                                <input type="number" id="glucose-max" placeholder="Max" min="0" step="1" value="${currentGoals?.glucose_max || ''}">
                            </div>
                        </div>
                        <button type="submit" class="btn-primary">Set Goal</button>
                    </form>
                </div>

                <div class="goal-card">
                    <div class="goal-header">
                        <span class="goal-icon">🍎</span>
                        <h4>Nutrition Goal</h4>
                    </div>
                    <form class="goal-form" id="nutrition-goal-form">
                        <div class="form-group">
                            <label for="calorie-target">Daily Calorie Target (kcal)</label>
                            <input type="number" id="calorie-target" placeholder="e.g., 2000" min="0" step="50" value="${currentGoals?.calorie_target || ''}">
                        </div>
                        <div class="form-group">
                            <label for="carb-target">Daily Carb Limit (g)</label>
                            <input type="number" id="carb-target" placeholder="e.g., 150" min="0" step="5" value="${currentGoals?.carb_target || ''}">
                        </div>
                        <button type="submit" class="btn-primary">Set Goal</button>
                    </form>
                </div>

                <div class="goal-card">
                    <div class="goal-header">
                        <span class="goal-icon">🏃</span>
                        <h4>Activity Goal</h4>
                    </div>
                    <form class="goal-form" id="activity-goal-form">
                        <div class="form-group">
                            <label for="activity-target">Weekly Activity (minutes)</label>
                            <input type="number" id="activity-target" placeholder="e.g., 150" min="0" step="10" value="${currentGoals?.activity_weekly_minutes || ''}">
                        </div>
                        <button type="submit" class="btn-primary">Set Goal</button>
                    </form>
                </div>

                <div class="goal-card">
                    <div class="goal-header">
                        <span class="goal-icon">⚖️</span>
                        <h4>Weight Goal</h4>
                    </div>
                    <form class="goal-form" id="weight-goal-form">
                        <div class="form-group">
                            <label for="weight-target">Target Weight (lbs)</label>
                            <input type="number" id="weight-target" placeholder="e.g., 180" min="50" max="500" step="0.1" value="${currentGoals?.weight_target || ''}">
                        </div>
                        <button type="submit" class="btn-primary">Set Goal</button>
                    </form>
                </div>
            </div>
        </div>
    `;
}

function getTabContent(tab) {
    switch(tab) {
        case 'goals':
            return renderGoalsTab();
        case 'glucose':
            return renderGlucoseTab();
        case 'nutrition':
            return renderNutritionTab();
        case 'activity':
            return renderActivityTab();
        case 'weight':
            return renderWeightTab();
        case 'risk':
            return renderRiskCalculator();
        default:
            return `<p class="placeholder">${tabContent[tab].content}</p>`;
    }
}

// Export functions
function exportToCSV() {
    const username = auth.getCurrentUsername();
    const date = new Date().toISOString().split('T')[0];

    let csv = `Diabetes Management Data Export - ${username}\nGenerated: ${date}\n\n`;

    // Glucose Data
    csv += 'GLUCOSE READINGS\n';
    csv += 'Date,Value (mg/dL)\n';
    glucoseData.forEach(d => {
        csv += `${d.date},${d.value}\n`;
    });

    // Nutrition Data
    csv += '\nNUTRITION LOG\n';
    csv += 'Date,Food,Servings,Carbs (g),Protein (g),Fat (g),Fiber (g),Calories\n';
    nutritionData.forEach(d => {
        csv += `${d.date},"${d.name}",${d.servings},${d.carbs},${d.protein},${d.fat},${d.fiber},${d.calories}\n`;
    });

    // Activity Data
    csv += '\nACTIVITY LOG\n';
    csv += 'Date,Type,Minutes,Calories\n';
    activityData.forEach(d => {
        csv += `${d.date},"${d.type}",${d.minutes},${d.calories || 'N/A'}\n`;
    });

    // Weight Data
    csv += '\nWEIGHT LOG\n';
    csv += 'Date,Weight (lbs)\n';
    weightData.forEach(d => {
        csv += `${d.date},${d.weight}\n`;
    });

    // Goals
    if (currentGoals) {
        csv += '\nCURRENT GOALS\n';
        if (currentGoals.glucose_min) csv += `Glucose Range,${currentGoals.glucose_min}-${currentGoals.glucose_max} mg/dL\n`;
        if (currentGoals.calorie_target) csv += `Daily Calories,${currentGoals.calorie_target} kcal\n`;
        if (currentGoals.carb_target) csv += `Daily Carbs,${currentGoals.carb_target}g\n`;
        if (currentGoals.activity_weekly_minutes) csv += `Weekly Activity,${currentGoals.activity_weekly_minutes} min\n`;
        if (currentGoals.weight_target) csv += `Target Weight,${currentGoals.weight_target} lbs\n`;
    }

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diabetes-data-${username}-${date}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function exportToPDF() {
    const username = auth.getCurrentUsername();
    const date = new Date().toISOString().split('T')[0];

    // Create printable HTML
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Diabetes Management Report - ${username}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
                h1 { color: #2d3748; border-bottom: 3px solid #667eea; padding-bottom: 10px; }
                h2 { color: #4a5568; margin-top: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th { background: #f7fafc; padding: 10px; text-align: left; border: 1px solid #e2e8f0; font-weight: 600; }
                td { padding: 8px; border: 1px solid #e2e8f0; }
                .header { text-align: center; margin-bottom: 40px; }
                .date { color: #718096; font-size: 14px; }
                .summary-box { background: #f7fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Diabetes Management Report</h1>
                <p><strong>Patient:</strong> ${username}</p>
                <p class="date">Generated: ${new Date().toLocaleDateString()}</p>
            </div>

            ${currentGoals ? `
                <h2>Current Goals</h2>
                <div class="summary-box">
                    ${currentGoals.glucose_min ? `<p><strong>Glucose Range:</strong> ${currentGoals.glucose_min}-${currentGoals.glucose_max} mg/dL</p>` : ''}
                    ${currentGoals.calorie_target ? `<p><strong>Daily Calories:</strong> ${currentGoals.calorie_target} kcal</p>` : ''}
                    ${currentGoals.carb_target ? `<p><strong>Daily Carbs:</strong> ${currentGoals.carb_target}g</p>` : ''}
                    ${currentGoals.activity_weekly_minutes ? `<p><strong>Weekly Activity:</strong> ${currentGoals.activity_weekly_minutes} min</p>` : ''}
                    ${currentGoals.weight_target ? `<p><strong>Target Weight:</strong> ${currentGoals.weight_target} lbs</p>` : ''}
                </div>
            ` : ''}

            <h2>Glucose Readings</h2>
            <table>
                <thead>
                    <tr><th>Date</th><th>Value (mg/dL)</th></tr>
                </thead>
                <tbody>
                    ${glucoseData.slice(-30).map(d => `<tr><td>${d.date}</td><td>${d.value}</td></tr>`).join('')}
                </tbody>
            </table>

            <h2>Nutrition Log</h2>
            <table>
                <thead>
                    <tr><th>Date</th><th>Food</th><th>Calories</th><th>Carbs (g)</th><th>Protein (g)</th></tr>
                </thead>
                <tbody>
                    ${nutritionData.slice(-30).map(d => `<tr><td>${d.date}</td><td>${d.name}</td><td>${Math.round(d.calories)}</td><td>${Math.round(d.carbs)}</td><td>${Math.round(d.protein)}</td></tr>`).join('')}
                </tbody>
            </table>

            <h2>Activity Log</h2>
            <table>
                <thead>
                    <tr><th>Date</th><th>Type</th><th>Minutes</th><th>Calories</th></tr>
                </thead>
                <tbody>
                    ${activityData.slice(-30).map(d => `<tr><td>${d.date}</td><td>${d.type}</td><td>${d.minutes}</td><td>${d.calories || 'N/A'}</td></tr>`).join('')}
                </tbody>
            </table>

            <h2>Weight Log</h2>
            <table>
                <thead>
                    <tr><th>Date</th><th>Weight (lbs)</th></tr>
                </thead>
                <tbody>
                    ${weightData.slice(-30).map(d => `<tr><td>${d.date}</td><td>${d.weight}</td></tr>`).join('')}
                </tbody>
            </table>

            <p style="margin-top: 40px; color: #718096; font-size: 12px; text-align: center;">
                This report contains the most recent 30 entries per category. Generated by DiaMetrics.
            </p>
        </body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

async function analyzeGoalProgress() {
    const resultsDiv = document.getElementById('goal-analysis-results');
    resultsDiv.classList.remove('hidden');
    resultsDiv.innerHTML = `
        <div class="analysis-loading">
            <div class="spinner"></div>
            <p>Analyzing your progress...</p>
        </div>
    `;

    try {
        // Get recent data (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];

        const recentGlucose = glucoseData.filter(d => d.date >= cutoffDate);
        const recentNutrition = nutritionData.filter(d => d.date >= cutoffDate);
        const recentActivity = activityData.filter(d => d.date >= cutoffDate);
        const recentWeight = weightData.filter(d => d.date >= cutoffDate);

        const recentData = {
            glucose: recentGlucose,
            nutrition: recentNutrition,
            activity: recentActivity,
            weight: recentWeight
        };

        const analysis = await auth.analyzeGoals(currentGoals, recentData);

        // Display results
        const statusColors = {
            'on_track': '#48bb78',
            'needs_attention': '#ed8936',
            'excellent': '#4299e1',
            'needs_improvement': '#f56565'
        };

        resultsDiv.innerHTML = `
            <div class="analysis-complete">
                <div class="analysis-summary ${analysis.overall_status}">
                    <h4>Overall Status: ${analysis.overall_status.replace('_', ' ').toUpperCase()}</h4>
                    <p>${analysis.summary}</p>
                </div>

                <div class="insights-grid">
                    ${analysis.insights.map(insight => {
                        const categoryIcons = {
                            'glucose': '📊',
                            'nutrition': '🍎',
                            'activity': '🏃',
                            'weight': '⚖️'
                        };
                        const icon = categoryIcons[insight.category.toLowerCase()] || '📈';
                        return `
                            <div class="insight-card" style="border-left: 4px solid ${statusColors[insight.status]}">
                                <div class="insight-header">
                                    <span class="insight-category">${icon} ${insight.category}</span>
                                    <span class="insight-status ${insight.status}">${insight.status.replace('_', ' ')}</span>
                                </div>
                                <p class="insight-message">${insight.message}</p>
                            </div>
                        `;
                    }).join('')}
                </div>

                <div class="recommendations">
                    <h4>Recommendations</h4>
                    <ul>
                        ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;

    } catch (error) {
        resultsDiv.innerHTML = `
            <div class="analysis-error">
                <p>⚠️ Error analyzing progress: ${error.message}</p>
                <p style="font-size: 0.9rem; color: #718096;">Make sure you have set goals and have some recent data.</p>
            </div>
        `;
    }
}

function renderApp() {
    // Destroy existing charts
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};

    const root = document.getElementById('root');

    const app = `
        <div class="app-container">
            <aside class="sidebar">
                <div class="sidebar-header">
                    <img src="DiaMetrics.png" alt="DiaMetrics Logo" class="logo">
                    <h1>DiaMetrics</h1>
                </div>
                <nav class="sidebar-nav">
                    ${tabs.map(tab => `
                        <div class="nav-item ${activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
                            <span class="nav-icon">${tab.icon}</span>
                            <span>${tab.name}</span>
                        </div>
                    `).join('')}
                </nav>
                <div class="user-info">
                    <span class="username">👤 ${auth.getCurrentUsername()}</span>
                    <button id="logout-btn" class="btn-logout">Logout</button>
                </div>
            </aside>
            <main class="main-content">
                <div class="content-header">
                    <h2>${tabContent[activeTab].title}</h2>
                    <p>${tabContent[activeTab].description}</p>
                </div>
                <div class="content-body">
                    ${getTabContent(activeTab)}
                </div>
            </main>
        </div>
    `;

    root.innerHTML = app;

    // Add logout button handler
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await auth.logout();
        glucoseData = [];
        nutritionData = [];
        activityData = [];
        weightData = [];
        showLoginScreen();
    });

    // Add click handlers
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const tabId = e.currentTarget.getAttribute('data-tab');
            activeTab = tabId;
            renderApp();
        });
    });

    // Render charts based on active tab
    setTimeout(() => {
        switch(activeTab) {
            case 'goals':
                // Add export button handlers
                document.getElementById('export-csv-btn')?.addEventListener('click', exportToCSV);
                document.getElementById('export-pdf-btn')?.addEventListener('click', exportToPDF);

                // Add analyze goals button handler
                document.getElementById('analyze-goals-btn')?.addEventListener('click', async () => {
                    await analyzeGoalProgress();
                });

                // Add goal form handlers
                document.getElementById('glucose-goal-form')?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const min = document.getElementById('glucose-min').value;
                    const max = document.getElementById('glucose-max').value;
                    if (min && max) {
                        try {
                            const goals = currentGoals || {};
                            goals.glucose_min = parseFloat(min);
                            goals.glucose_max = parseFloat(max);
                            await auth.saveGoals(goals);
                            currentGoals = goals;
                            renderApp();
                        } catch (error) {
                            alert('Error saving goal: ' + error.message);
                        }
                    }
                });

                document.getElementById('nutrition-goal-form')?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const calories = document.getElementById('calorie-target').value;
                    const carbs = document.getElementById('carb-target').value;
                    if (calories || carbs) {
                        try {
                            const goals = currentGoals || {};
                            if (calories) goals.calorie_target = parseFloat(calories);
                            if (carbs) goals.carb_target = parseFloat(carbs);
                            await auth.saveGoals(goals);
                            currentGoals = goals;
                            renderApp();
                        } catch (error) {
                            alert('Error saving goal: ' + error.message);
                        }
                    }
                });

                document.getElementById('activity-goal-form')?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const minutes = document.getElementById('activity-target').value;
                    if (minutes) {
                        try {
                            const goals = currentGoals || {};
                            goals.activity_weekly_minutes = parseInt(minutes);
                            await auth.saveGoals(goals);
                            currentGoals = goals;
                            renderApp();
                        } catch (error) {
                            alert('Error saving goal: ' + error.message);
                        }
                    }
                });

                document.getElementById('weight-goal-form')?.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const weight = document.getElementById('weight-target').value;
                    if (weight) {
                        try {
                            const goals = currentGoals || {};
                            goals.weight_target = parseFloat(weight);
                            await auth.saveGoals(goals);
                            currentGoals = goals;
                            renderApp();
                        } catch (error) {
                            alert('Error saving goal: ' + error.message);
                        }
                    }
                });
                break;
            case 'glucose':
                renderGlucoseChart();
                const glucoseForm = document.getElementById('glucose-form');
                glucoseForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    addGlucoseReading();
                });

                // Add view selector handlers
                document.querySelectorAll('.view-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        glucoseViewMode = e.target.getAttribute('data-view');
                        renderApp();
                    });
                });
                break;
            case 'nutrition':
                if (nutritionChartMode === 'pie') {
                    renderNutritionChart();
                } else {
                    renderNutritionHistoryChart();
                }

                const nutritionForm = document.getElementById('nutrition-form');
                nutritionForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    addFood();
                });

                const aiNutritionForm = document.getElementById('ai-nutrition-form');
                aiNutritionForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await analyzeFoodWithAI();
                });

                const barcodeForm = document.getElementById('barcode-form');
                barcodeForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await lookupBarcode();
                });

                const photoScanBtn = document.getElementById('photo-scan-btn');
                photoScanBtn.addEventListener('click', async () => {
                    await scanBarcodePhoto();
                });

                // Tab switching for input method
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const tab = e.target.getAttribute('data-tab');
                        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                        document.querySelectorAll('.input-tab-content').forEach(c => c.classList.remove('active'));
                        e.target.classList.add('active');
                        document.getElementById(`${tab}-input`).classList.add('active');
                    });
                });

                // View mode switching (time period)
                document.querySelectorAll('.chart-container .view-btn[data-view]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        nutritionViewMode = e.target.getAttribute('data-view');
                        renderApp();
                    });
                });

                // Chart mode switching (pie vs line)
                document.querySelectorAll('.chart-container .view-btn[data-mode]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        nutritionChartMode = e.target.getAttribute('data-mode');
                        renderApp();
                    });
                });

                // Add remove food handlers
                document.querySelectorAll('.btn-remove').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const date = e.target.getAttribute('data-date');
                        const dateFoods = nutritionData.filter(item => item.date === date);
                        const index = parseInt(e.target.getAttribute('data-index'));
                        const foodToRemove = dateFoods[index];
                        const globalIndex = nutritionData.indexOf(foodToRemove);

                        try {
                            await auth.deleteNutritionData(globalIndex);
                            await loadAllData();
                            renderApp();
                        } catch (error) {
                            alert('Error deleting food: ' + error.message);
                        }
                    });
                });

                // Date picker change handler
                const nutritionDatePicker = document.getElementById('nutrition-date');
                if (nutritionDatePicker) {
                    nutritionDatePicker.addEventListener('change', (e) => {
                        selectedNutritionDate = e.target.value;
                        renderApp();
                    });
                }
                break;
            case 'activity':
                renderActivityChart();
                const activityForm = document.getElementById('activity-form');
                activityForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    addActivity();
                });

                // AI Activity form
                const aiActivityForm = document.getElementById('ai-activity-form');
                aiActivityForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    analyzeActivityWithAI();
                });

                // Tab switching for input method (reusing nutrition tab logic)
                document.querySelectorAll('.activity-input-section .tab-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const tab = e.target.getAttribute('data-tab');
                        document.querySelectorAll('.activity-input-section .tab-btn').forEach(b => b.classList.remove('active'));
                        document.querySelectorAll('.activity-input-section .input-tab-content').forEach(c => c.classList.remove('active'));
                        e.target.classList.add('active');
                        document.getElementById(`${tab}-input`).classList.add('active');
                    });
                });

                // Add remove activity handlers
                document.querySelectorAll('.btn-remove-small').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const index = parseInt(e.target.getAttribute('data-index'));
                        try {
                            await auth.deleteActivityData(index);
                            await loadAllData();
                            renderApp();
                        } catch (error) {
                            alert('Error deleting activity: ' + error.message);
                        }
                    });
                });

                // Date picker change handler for activity
                const activityDatePicker = document.getElementById('activity-date');
                if (activityDatePicker) {
                    activityDatePicker.addEventListener('change', (e) => {
                        selectedActivityDate = e.target.value;
                        renderApp();
                    });
                }

                // View mode switching for activity chart (time period)
                document.querySelectorAll('.chart-container .view-btn[data-view]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const view = e.target.getAttribute('data-view');
                        if (view === 'week' || view === 'month' || view === 'year') {
                            activityViewMode = view;
                            renderApp();
                        }
                    });
                });

                // Chart mode switching for activity (minutes vs calories)
                document.querySelectorAll('.chart-container .view-btn[data-mode]').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const mode = e.target.getAttribute('data-mode');
                        if (mode === 'minutes' || mode === 'calories') {
                            activityChartMode = mode;
                            renderApp();
                        }
                    });
                });
                break;
            case 'weight':
                renderWeightChart();
                const weightForm = document.getElementById('weight-form');
                weightForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    addWeight();
                });

                // Date picker change handler for weight
                const weightDatePicker = document.getElementById('weight-date');
                if (weightDatePicker) {
                    weightDatePicker.addEventListener('change', (e) => {
                        selectedWeightDate = e.target.value;
                        renderApp();
                    });
                }

                // View mode switching for weight chart
                document.querySelectorAll('.weight-chart-full .view-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const view = e.target.getAttribute('data-view');
                        if (view === 'week' || view === 'month' || view === 'year') {
                            weightViewMode = view;
                            renderApp();
                        }
                    });
                });

                // Add remove weight handlers
                document.querySelectorAll('.weight-log .btn-remove-small').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const index = parseInt(e.target.getAttribute('data-index'));
                        try {
                            await auth.deleteWeightData(index);
                            await loadAllData();
                            renderApp();
                        } catch (error) {
                            alert('Error deleting weight entry: ' + error.message);
                        }
                    });
                });
                break;
            case 'risk':
                const form = document.getElementById('risk-form');
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await calculateRisk();
                });
                break;
        }
    }, 10);
}

async function addGlucoseReading() {
    const date = document.getElementById('glucose-date').value;
    const value = parseFloat(document.getElementById('glucose-value').value);

    if (!date || !value || value < 20 || value > 600) {
        alert('Please enter a valid date and glucose value (20-600 mg/dL)');
        return;
    }

    try {
        await auth.saveGlucoseData(date, value);
        await loadAllData();
        document.getElementById('glucose-value').value = '';
        renderApp();
    } catch (error) {
        alert('Error saving glucose data: ' + error.message);
    }
}

async function addFood() {
    const foodName = document.getElementById('food-select').value;
    const servings = parseFloat(document.getElementById('servings').value);
    const selectedDate = document.getElementById('nutrition-date').value;

    if (!foodName || !servings || servings <= 0) {
        alert('Please select a food and enter valid servings');
        return;
    }

    const foodData = foodDatabase[foodName];

    const data = {
        date: selectedDate,
        name: foodName,
        servings: servings,
        carbs: foodData.carbs * servings,
        protein: foodData.protein * servings,
        fat: foodData.fat * servings,
        fiber: foodData.fiber * servings,
        calories: foodData.calories * servings
    };

    try {
        await auth.saveNutritionData(data);
        await loadAllData();
        document.getElementById('food-select').value = '';
        document.getElementById('servings').value = '1';
        renderApp();
    } catch (error) {
        alert('Error saving nutrition data: ' + error.message);
    }
}

async function addActivity() {
    const date = document.getElementById('activity-date').value;
    const minutes = parseFloat(document.getElementById('activity-minutes').value);
    const type = document.getElementById('activity-type').value;

    if (!date || !minutes || minutes <= 0 || !type) {
        alert('Please fill in all fields');
        return;
    }

    const data = {
        date: date,
        minutes: minutes,
        type: type,
        calories: null
    };

    try {
        await auth.saveActivityData(data);
        await loadAllData();
        document.getElementById('activity-minutes').value = '';
        document.getElementById('activity-type').value = '';
        renderApp();
    } catch (error) {
        alert('Error saving activity data: ' + error.message);
    }
}

async function addWeight() {
    const date = selectedWeightDate;
    const weight = parseFloat(document.getElementById('weight-value').value);

    if (!weight || weight <= 0 || weight < 50 || weight > 500) {
        alert('Please enter a valid weight (50-500 lbs)');
        return;
    }

    const data = {
        date: date,
        weight: weight
    };

    try {
        await auth.saveWeightData(data);
        await loadAllData();
        document.getElementById('weight-value').value = '';
        renderApp();
    } catch (error) {
        alert('Error saving weight data: ' + error.message);
    }
}

async function analyzeActivityWithAI() {
    const description = document.getElementById('ai-activity-description').value.trim();
    const selectedDate = document.getElementById('ai-activity-date').value;

    if (!description) {
        alert('Please describe your activity');
        return;
    }

    const btn = document.getElementById('ai-activity-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');

    // Show loading state
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    btn.disabled = true;

    try {
        const response = await fetch('http://localhost:5000/analyze-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
        });

        if (!response.ok) throw new Error('Failed to analyze activity');

        const result = await response.json();

        // Save activity to database
        const data = {
            date: selectedDate,
            minutes: result.minutes,
            type: result.activity_type,
            calories: result.calories
        };

        await auth.saveActivityData(data);
        await loadAllData();

        // Reset form
        document.getElementById('ai-activity-description').value = '';

        // Re-render
        renderApp();

    } catch (error) {
        alert('Error analyzing activity. Make sure the Python backend is running on port 5000.');
        console.error(error);
    } finally {
        // Reset button state
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        btn.disabled = false;
    }
}

async function scanBarcodePhoto() {
    const fileInput = document.getElementById('barcode-photo');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a photo');
        return;
    }

    const btn = document.getElementById('photo-scan-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');
    const resultDiv = document.getElementById('barcode-result');

    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    btn.disabled = true;

    try {
        // Convert image to base64
        const reader = new FileReader();
        const imageData = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        // Call API to analyze photo
        const response = await fetch('http://localhost:5000/analyze-barcode-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });

        if (!response.ok) {
            throw new Error('Failed to analyze photo');
        }

        const result = await response.json();
        const selectedDate = document.getElementById('nutrition-date').value;
        const confidenceColor = result.confidence === 'high' ? '#48bb78' : result.confidence === 'medium' ? '#ed8936' : '#f56565';

        // Check if nutrition label was visible
        if (result.has_nutrition_label && result.nutrition.calories > 0) {
            // Nutrition extracted from photo - show it with product info from barcode lookup if available

            // If barcode is available, fetch product image and name
            if (result.barcode) {
                try {
                    const barcodeResponse = await fetch(`https://world.openfoodfacts.org/api/v2/product/${result.barcode}.json`);
                    const barcodeData = await barcodeResponse.json();

                    if (barcodeData.status === 1) {
                        const product = barcodeData.product;

                        resultDiv.innerHTML = `
                            <div class="barcode-success">
                                <h4>✅ Nutrition Extracted from Photo!</h4>
                                <div class="product-info">
                                    ${product.image_url ? `<img src="${product.image_url}" alt="${product.product_name}" class="product-image">` : ''}
                                    <div class="product-details">
                                        <h4>${product.product_name || result.product_name}</h4>
                                        <p class="product-brand">${product.brands || ''}</p>
                                        <p class="product-serving">Serving: 100g</p>
                                        <p class="product-serving">Confidence: <span style="color: ${confidenceColor}; font-weight: 600;">${result.confidence}</span></p>
                                    </div>
                                </div>
                                <div class="nutrition-preview">
                                    <h5>Nutrition Per Serving (from label):</h5>
                                    <div class="nutrition-grid">
                                        <div class="nutrition-item">
                                            <div class="nutrition-label">Calories</div>
                                            <div class="nutrition-value">${result.nutrition.calories}</div>
                                        </div>
                                        <div class="nutrition-item">
                                            <div class="nutrition-label">Carbs</div>
                                            <div class="nutrition-value">${result.nutrition.carbs}g</div>
                                        </div>
                                        <div class="nutrition-item">
                                            <div class="nutrition-label">Protein</div>
                                            <div class="nutrition-value">${result.nutrition.protein}g</div>
                                        </div>
                                        <div class="nutrition-item">
                                            <div class="nutrition-label">Fat</div>
                                            <div class="nutrition-value">${result.nutrition.fat}g</div>
                                        </div>
                                        <div class="nutrition-item">
                                            <div class="nutrition-label">Fiber</div>
                                            <div class="nutrition-value">${result.nutrition.fiber}g</div>
                                        </div>
                                    </div>
                                </div>
                                <button type="button" class="btn-primary" id="add-direct-nutrition">Add to Log</button>
                            </div>
                        `;

                        document.getElementById('add-direct-nutrition').addEventListener('click', async () => {
                            try {
                                await auth.saveNutritionData({
                                    date: selectedDate,
                                    name: product.product_name || result.product_name,
                                    servings: 1,
                                    carbs: result.nutrition.carbs,
                                    protein: result.nutrition.protein,
                                    fat: result.nutrition.fat,
                                    fiber: result.nutrition.fiber,
                                    calories: result.nutrition.calories
                                });

                                await loadAllData();
                                fileInput.value = '';
                                resultDiv.innerHTML = '';
                                renderApp();
                                alert('Food added successfully!');
                            } catch (error) {
                                alert('Error adding food: ' + error.message);
                            }
                        });

                        return; // Exit early since we handled it
                    }
                } catch (err) {
                    console.log('Could not fetch barcode info, using photo data only');
                }
            }

            // No barcode or barcode lookup failed - use photo data only
            resultDiv.innerHTML = `
                <div class="barcode-success">
                    <h4>✅ Nutrition Extracted from Photo!</h4>
                    <div class="product-info">
                        <div class="product-details">
                            <h4>${result.product_name || 'Product'}</h4>
                            <p class="product-serving">Servings: ${result.servings}</p>
                            <p class="product-serving">Confidence: <span style="color: ${confidenceColor}; font-weight: 600;">${result.confidence}</span></p>
                        </div>
                    </div>
                    <div class="nutrition-preview">
                        <h5>Nutrition Per Serving:</h5>
                        <div class="nutrition-grid">
                            <div class="nutrition-item">
                                <div class="nutrition-label">Calories</div>
                                <div class="nutrition-value">${result.nutrition.calories}</div>
                            </div>
                            <div class="nutrition-item">
                                <div class="nutrition-label">Carbs</div>
                                <div class="nutrition-value">${result.nutrition.carbs}g</div>
                            </div>
                            <div class="nutrition-item">
                                <div class="nutrition-label">Protein</div>
                                <div class="nutrition-value">${result.nutrition.protein}g</div>
                            </div>
                            <div class="nutrition-item">
                                <div class="nutrition-label">Fat</div>
                                <div class="nutrition-value">${result.nutrition.fat}g</div>
                            </div>
                            <div class="nutrition-item">
                                <div class="nutrition-label">Fiber</div>
                                <div class="nutrition-value">${result.nutrition.fiber}g</div>
                            </div>
                        </div>
                    </div>
                    <button type="button" class="btn-primary" id="add-direct-nutrition">Add to Log</button>
                </div>
            `;

            document.getElementById('add-direct-nutrition').addEventListener('click', async () => {
                try {
                    await auth.saveNutritionData({
                        date: selectedDate,
                        name: result.product_name || 'Product',
                        servings: 1,
                        carbs: result.nutrition.carbs,
                        protein: result.nutrition.protein,
                        fat: result.nutrition.fat,
                        fiber: result.nutrition.fiber,
                        calories: result.nutrition.calories
                    });

                    await loadAllData();
                    fileInput.value = '';
                    resultDiv.innerHTML = '';
                    renderApp();
                    alert('Food added successfully!');
                } catch (error) {
                    alert('Error adding food: ' + error.message);
                }
            });

        } else if (result.barcode) {
            // No nutrition label visible, but barcode detected - fill in fields for lookup
            document.getElementById('barcode-input-field').value = result.barcode;
            document.getElementById('barcode-servings').value = result.servings || 1;

            resultDiv.innerHTML = `
                <div style="background: #f7fafc; padding: 1rem; border-radius: 8px; border-left: 4px solid ${confidenceColor}; margin-bottom: 1rem;">
                    <p style="color: #2d3748; font-weight: 600;">📷 Barcode Detected!</p>
                    <p style="color: #4a5568; font-size: 0.9rem; margin-top: 0.5rem;">
                        Barcode: <strong>${result.barcode}</strong><br>
                        Servings: <strong>${result.servings}</strong><br>
                        Confidence: <span style="color: ${confidenceColor}; font-weight: 600;">${result.confidence}</span>
                    </p>
                    <p style="color: #718096; font-size: 0.85rem; margin-top: 0.5rem;">
                        ${result.confidence === 'low' ? '⚠️ Please verify the values below before looking up' : '✓ Click "Look Up Product" to get nutrition info'}
                    </p>
                </div>
            `;
        } else {
            // Neither nutrition label nor barcode found
            resultDiv.innerHTML = `
                <div class="barcode-error">
                    <p>❌ Could not extract nutrition or barcode from photo</p>
                    <p style="font-size: 0.9rem;">Try taking a clearer photo or use manual entry</p>
                </div>
            `;
        }

    } catch (error) {
        resultDiv.innerHTML = `
            <div class="barcode-error">
                <p>❌ Error scanning photo: ${error.message}</p>
                <p style="font-size: 0.9rem;">Make sure the backend is running and try again</p>
            </div>
        `;
    } finally {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        btn.disabled = false;
    }
}

async function lookupBarcode() {
    const barcode = document.getElementById('barcode-input-field').value.trim();
    const servings = parseFloat(document.getElementById('barcode-servings').value);
    const selectedDate = document.getElementById('nutrition-date').value;

    if (!barcode) {
        alert('Please enter a barcode number');
        return;
    }

    const resultDiv = document.getElementById('barcode-result');
    const btnText = document.querySelector('#barcode-scan-btn .btn-text');
    const btnLoading = document.querySelector('#barcode-scan-btn .btn-loading');
    const btn = document.getElementById('barcode-scan-btn');

    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    btn.disabled = true;

    try {
        // Call Open Food Facts API
        const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);

        if (!response.ok) {
            throw new Error('Product not found');
        }

        const data = await response.json();

        if (data.status === 0) {
            resultDiv.innerHTML = `
                <div class="barcode-error">
                    <p>❌ Product not found in database</p>
                    <p style="font-size: 0.9rem; color: #718096;">Try a different barcode or use Quick Select/AI Description</p>
                </div>
            `;
            resultDiv.classList.remove('hidden');
            return;
        }

        const product = data.product;
        const nutriments = product.nutriments;

        // Extract nutrition info (per 100g from Open Food Facts)
        const per100g = {
            carbs: nutriments['carbohydrates_100g'] || 0,
            protein: nutriments['proteins_100g'] || 0,
            fat: nutriments['fat_100g'] || 0,
            fiber: nutriments['fiber_100g'] || 0,
            calories: nutriments['energy-kcal_100g'] || 0
        };

        // Get serving size (default to 100g if not specified)
        const servingSize = nutriments['serving_quantity'] || 100;
        const servingUnit = nutriments['serving_quantity_unit'] || 'g';

        // Calculate nutrition for one serving
        const perServing = {
            carbs: (per100g.carbs * servingSize) / 100,
            protein: (per100g.protein * servingSize) / 100,
            fat: (per100g.fat * servingSize) / 100,
            fiber: (per100g.fiber * servingSize) / 100,
            calories: (per100g.calories * servingSize) / 100
        };

        // Show product info
        resultDiv.innerHTML = `
            <div class="barcode-success">
                <h4>✅ Product Found!</h4>
                <div class="product-info">
                    ${product.image_url ? `<img src="${product.image_url}" alt="${product.product_name}" style="max-width: 150px; border-radius: 8px;">` : ''}
                    <div>
                        <p><strong>${product.product_name || 'Unknown Product'}</strong></p>
                        <p style="color: #718096; font-size: 0.9rem;">${product.brands || ''}</p>
                        <p style="color: #718096; font-size: 0.85rem;">Serving: ${servingSize}${servingUnit}</p>
                    </div>
                </div>
                <div class="nutrition-preview">
                    <p><strong>Per Serving (×${servings}):</strong></p>
                    <ul>
                        <li>Calories: ${Math.round(perServing.calories * servings)} kcal</li>
                        <li>Carbs: ${Math.round(perServing.carbs * servings)}g</li>
                        <li>Protein: ${Math.round(perServing.protein * servings)}g</li>
                        <li>Fat: ${Math.round(perServing.fat * servings)}g</li>
                        <li>Fiber: ${Math.round(perServing.fiber * servings)}g</li>
                    </ul>
                </div>
                <button type="button" class="btn-primary" id="add-barcode-food">Add to Log</button>
            </div>
        `;
        resultDiv.classList.remove('hidden');

        // Add click handler for the add button
        document.getElementById('add-barcode-food').addEventListener('click', async () => {
            try {
                await auth.saveNutritionData({
                    date: selectedDate,
                    name: product.product_name || `Product ${barcode}`,
                    servings: servings,
                    carbs: perServing.carbs * servings,
                    protein: perServing.protein * servings,
                    fat: perServing.fat * servings,
                    fiber: perServing.fiber * servings,
                    calories: perServing.calories * servings
                });

                await loadAllData();
                document.getElementById('barcode-input-field').value = '';
                document.getElementById('barcode-servings').value = '1';
                resultDiv.classList.add('hidden');
                renderApp();
            } catch (error) {
                alert('Error adding food: ' + error.message);
            }
        });

    } catch (error) {
        resultDiv.innerHTML = `
            <div class="barcode-error">
                <p>❌ ${error.message}</p>
                <p style="font-size: 0.9rem; color: #718096;">Check the barcode number and try again</p>
            </div>
        `;
        resultDiv.classList.remove('hidden');
    } finally {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        btn.disabled = false;
    }
}

async function analyzeFoodWithAI() {
    const description = document.getElementById('food-description').value.trim();
    const selectedDate = document.getElementById('nutrition-date').value;

    if (!description) {
        alert('Please describe what you ate');
        return;
    }

    const btn = document.getElementById('ai-analyze-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoading = btn.querySelector('.btn-loading');

    // Show loading state
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    btn.disabled = true;

    try {
        const response = await fetch('http://localhost:5000/analyze-food', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
        });

        if (!response.ok) throw new Error('Failed to analyze food');

        const result = await response.json();

        // Save parsed foods to database
        for (const food of result.foods) {
            const data = {
                date: selectedDate,
                name: food.name,
                servings: 1,
                carbs: food.carbs,
                protein: food.protein,
                fat: food.fat,
                fiber: food.fiber,
                calories: food.calories
            };
            await auth.saveNutritionData(data);
        }

        await loadAllData();

        // Reset form
        document.getElementById('food-description').value = '';

        // Re-render
        renderApp();

    } catch (error) {
        alert('Error analyzing food. Make sure the Python backend is running on port 5000.');
        console.error(error);
    } finally {
        // Reset button state
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        btn.disabled = false;
    }
}

async function calculateRisk() {
    const payload = {
        RIAGENDR: parseFloat(document.getElementById('gender').value),
        RIDAGEYR: parseFloat(document.getElementById('age').value),
        RIDRETH1: parseFloat(document.getElementById('race').value),
        BMXWT: parseFloat(document.getElementById('weight').value),
        BMXHT: parseFloat(document.getElementById('height').value),
        BMXWAIST: parseFloat(document.getElementById('waist').value) || null,
        BMXHIP: parseFloat(document.getElementById('hip').value) || null
    };

    // Calculate BMI
    if (payload.BMXWT && payload.BMXHT) {
        payload.BMXBMI = payload.BMXWT / Math.pow(payload.BMXHT / 100, 2);
    }

    try {
        const response = await fetch('http://localhost:5000/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Prediction failed');

        const result = await response.json();
        await displayResults(result);
    } catch (error) {
        alert('Error calculating risk. Make sure the Python backend is running on port 5000.');
        console.error(error);
    }
}

async function displayResults(result) {
    const resultsDiv = document.getElementById('risk-results');
    resultsDiv.classList.remove('hidden');

    document.getElementById('probability').textContent = `${(result.probability * 100).toFixed(1)}%`;
    document.getElementById('risk-level').textContent = `${result.risk_level}/10`;

    const barFill = document.getElementById('risk-bar-fill');
    barFill.style.width = `${result.probability * 100}%`;

    // Color based on risk level
    let riskColor = '';
    if (result.risk_level <= 3) {
        barFill.style.backgroundColor = '#48bb78';
        riskColor = 'low';
    } else if (result.risk_level <= 6) {
        barFill.style.backgroundColor = '#ed8936';
        riskColor = 'moderate';
    } else {
        barFill.style.backgroundColor = '#f56565';
        riskColor = 'high';
    }

    // Add risk interpretation
    const interpretationDiv = document.getElementById('risk-interpretation');
    interpretationDiv.innerHTML = getRiskInterpretation(result.risk_level, result.probability, riskColor);

    // Save to database for user's account
    try {
        await auth.saveRiskData(result.probability, result.risk_level);
        currentRiskData = result;
    } catch (error) {
        console.error('Error saving risk data:', error);
    }

    // Scroll to results
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function getRiskInterpretation(riskLevel, probability, riskColor) {
    let statusClass = riskColor === 'low' ? 'status-low' : riskColor === 'moderate' ? 'status-moderate' : 'status-high';
    let statusIcon = riskColor === 'low' ? '✅' : riskColor === 'moderate' ? '⚠️' : '🚨';
    let statusText = riskColor === 'low' ? 'Low Risk' : riskColor === 'moderate' ? 'Moderate Risk' : 'High Risk';

    let interpretation = '';
    let recommendations = '';

    if (riskLevel <= 3) {
        // Low Risk (1-3)
        interpretation = `Your risk of developing Type 2 diabetes is <strong>low</strong>. With a ${(probability * 100).toFixed(1)}% probability, your current health metrics indicate good metabolic health.`;
        recommendations = `
            <h4>Maintain Your Health:</h4>
            <ul>
                <li>✅ Keep up your healthy lifestyle habits</li>
                <li>✅ Continue regular physical activity (150+ min/week)</li>
                <li>✅ Maintain a balanced diet</li>
                <li>✅ Get screened every 3 years if over 45</li>
                <li>✅ Monitor your weight and stay active</li>
            </ul>
        `;
    } else if (riskLevel <= 6) {
        // Moderate Risk (4-6)
        interpretation = `Your risk of developing Type 2 diabetes is <strong>moderate</strong>. With a ${(probability * 100).toFixed(1)}% probability, lifestyle changes can significantly reduce your risk.`;
        recommendations = `
            <h4>Take Preventive Action:</h4>
            <ul>
                <li>⚠️ <strong>Schedule a doctor's appointment</strong> for diabetes screening (fasting glucose or A1C test)</li>
                <li>⚠️ Aim for 5-10% weight loss if overweight</li>
                <li>⚠️ Exercise at least 150 minutes per week (brisk walking, cycling, swimming)</li>
                <li>⚠️ Reduce refined carbs and sugary drinks</li>
                <li>⚠️ Increase fiber intake (vegetables, whole grains, legumes)</li>
                <li>⚠️ Get screened annually</li>
            </ul>
            <div class="prevention-note">
                <strong>Good news:</strong> Studies show that lifestyle changes can reduce diabetes risk by up to 58%!
            </div>
        `;
    } else {
        // High Risk (7-10)
        interpretation = `Your risk of developing Type 2 diabetes is <strong>high</strong>. With a ${(probability * 100).toFixed(1)}% probability, immediate medical consultation is recommended.`;
        recommendations = `
            <h4>Urgent Action Needed:</h4>
            <ul>
                <li>🚨 <strong>See your doctor immediately</strong> for comprehensive diabetes screening</li>
                <li>🚨 Ask about preventive medications (like metformin) if appropriate</li>
                <li>🚨 Join a diabetes prevention program (DPP)</li>
                <li>🚨 Work with a dietitian for personalized meal planning</li>
                <li>🚨 Start daily physical activity (even 10-15 min walks help)</li>
                <li>🚨 Lose 7-10% of body weight (most effective prevention)</li>
                <li>🚨 Get screened every 6 months</li>
            </ul>
            <div class="urgent-note">
                <strong>Important:</strong> Early intervention is crucial. Don't wait – schedule your doctor's appointment today.
            </div>
        `;
    }

    return `
        <div class="risk-status ${statusClass}">
            <div class="status-badge">${statusIcon} ${statusText}</div>
        </div>
        <div class="interpretation-content">
            <p class="interpretation-text">${interpretation}</p>
            ${recommendations}
        </div>
        <div class="risk-cutoffs">
            <h4>Risk Level Guide:</h4>
            <div class="cutoff-scale">
                <div class="cutoff-item cutoff-low">
                    <div class="cutoff-label">Low Risk</div>
                    <div class="cutoff-range">1-3</div>
                    <div class="cutoff-desc">Screen every 3 years</div>
                </div>
                <div class="cutoff-item cutoff-moderate">
                    <div class="cutoff-label">Moderate Risk</div>
                    <div class="cutoff-range">4-6</div>
                    <div class="cutoff-desc">See doctor, screen annually</div>
                </div>
                <div class="cutoff-item cutoff-high">
                    <div class="cutoff-label">High Risk</div>
                    <div class="cutoff-range">7-10</div>
                    <div class="cutoff-desc">Urgent: See doctor immediately</div>
                </div>
            </div>
        </div>
    `;
}

// Chart rendering functions
function renderGlucoseChart() {
    const canvas = document.getElementById('glucose-chart');
    if (!canvas) return;

    const data = generateGlucoseData();
    chartInstances.glucose = new Chart(canvas, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Blood Glucose (mg/dL)',
                data: data.data,
                borderColor: '#4299e1',
                backgroundColor: 'rgba(66, 153, 225, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    suggestedMin: 60,
                    suggestedMax: 200,
                    ticks: {
                        stepSize: 20
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

function renderNutritionChart() {
    const canvas = document.getElementById('nutrition-chart');
    if (!canvas) return;

    const data = generateNutritionData();
    chartInstances.nutrition = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: ['#4299e1', '#48bb78', '#ed8936', '#9f7aea']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderNutritionHistoryChart() {
    const canvas = document.getElementById('nutrition-history-chart');
    if (!canvas) return;

    const data = generateNutritionHistoryData();
    chartInstances.nutritionHistory = new Chart(canvas, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Calories',
                    data: data.calories,
                    borderColor: '#ed8936',
                    backgroundColor: 'rgba(237, 137, 54, 0.1)',
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Carbs (g)',
                    data: data.carbs,
                    borderColor: '#4299e1',
                    backgroundColor: 'rgba(66, 153, 225, 0.1)',
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.dataset.label.includes('Calories')
                                    ? context.parsed.y + ' kcal'
                                    : context.parsed.y + 'g';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Calories (kcal)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Carbs (g)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            }
        }
    });
}

function renderActivityChart() {
    const canvas = document.getElementById('activity-chart');
    if (!canvas) return;

    const data = generateActivityData();
    const isCaloriesView = activityChartMode === 'calories';

    chartInstances.activity = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: isCaloriesView ? 'Calories Burned' : 'Minutes of Activity',
                data: isCaloriesView ? data.calories : data.minutes,
                backgroundColor: isCaloriesView ? '#ed8936' : '#48bb78',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return isCaloriesView
                                ? context.parsed.y + ' calories'
                                : context.parsed.y + ' minutes';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: isCaloriesView ? 'Calories' : 'Minutes'
                    }
                }
            }
        }
    });
}

function renderWeightChart() {
    const canvas = document.getElementById('weight-chart');
    if (!canvas) return;

    const data = generateWeightData();
    chartInstances.weight = new Chart(canvas, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Weight (lbs)',
                data: data.data,
                borderColor: '#805ad5',
                backgroundColor: 'rgba(128, 90, 213, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

function renderRiskChart() {
    const canvas = document.getElementById('risk-chart');
    if (!canvas) return;

    const data = generateRiskHistoryData();
    chartInstances.risk = new Chart(canvas, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Risk Level (1-10)',
                data: data.data,
                borderColor: '#ed8936',
                backgroundColor: 'rgba(237, 137, 54, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 10,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Login/Signup screen
function showLoginScreen() {
    const root = document.getElementById('root');
    root.innerHTML = `
        <div class="auth-container">
            <div class="auth-box">
                <h1>DiaMetrics</h1>
                <p class="auth-subtitle">Please login or create an account</p>

                <div class="auth-tabs">
                    <button class="auth-tab active" data-tab="login">Login</button>
                    <button class="auth-tab" data-tab="signup">Sign Up</button>
                </div>

                <div id="login-form" class="auth-form active">
                    <h2>Login</h2>
                    <form id="login-submit">
                        <div class="form-group">
                            <label for="login-username">Username</label>
                            <input type="text" id="login-username" required autocomplete="username">
                        </div>
                        <div class="form-group">
                            <label for="login-password">Password</label>
                            <input type="password" id="login-password" required autocomplete="current-password">
                        </div>
                        <div id="login-error" class="error-message"></div>
                        <button type="submit" class="btn-primary">Login</button>
                    </form>
                </div>

                <div id="signup-form" class="auth-form">
                    <h2>Create Account</h2>
                    <form id="signup-submit">
                        <div class="form-group">
                            <label for="signup-username">Username</label>
                            <input type="text" id="signup-username" required autocomplete="username">
                        </div>
                        <div class="form-group">
                            <label for="signup-password">Password (min 6 characters)</label>
                            <input type="password" id="signup-password" required minlength="6" autocomplete="new-password">
                        </div>
                        <div class="form-group">
                            <label for="signup-password-confirm">Confirm Password</label>
                            <input type="password" id="signup-password-confirm" required autocomplete="new-password">
                        </div>
                        <div id="signup-error" class="error-message"></div>
                        <button type="submit" class="btn-primary">Sign Up</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.getAttribute('data-tab');
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`${tabName}-form`).classList.add('active');
        });
    });

    // Login form
    document.getElementById('login-submit').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        try {
            await auth.login(username, password);
            await loadAllData();
            renderApp();
        } catch (error) {
            errorDiv.textContent = error.message;
        }
    });

    // Signup form
    document.getElementById('signup-submit').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-password-confirm').value;
        const errorDiv = document.getElementById('signup-error');

        if (password !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match';
            return;
        }

        try {
            await auth.signup(username, password);
            errorDiv.textContent = '';
            errorDiv.style.color = 'green';
            errorDiv.textContent = 'Account created! Please login.';
            // Switch to login tab
            setTimeout(() => {
                document.querySelector('.auth-tab[data-tab="login"]').click();
            }, 1000);
        } catch (error) {
            errorDiv.style.color = 'red';
            errorDiv.textContent = error.message;
        }
    });
}

// Initialize app
async function initializeApp() {
    if (!auth.isLoggedIn()) {
        showLoginScreen();
    } else {
        await loadAllData();
        renderApp();
    }
}

initializeApp();
