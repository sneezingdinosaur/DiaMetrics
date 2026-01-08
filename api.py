import sys
import os
import json
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify, g
from flask_cors import CORS

from pathlib import Path
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

try:
    from openai import OpenAI
except ImportError:
    print("Error: Could not import OpenAI. Installing...")
    os.system('pip install --upgrade openai')
    from openai import OpenAI

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ml'))

try:
    from scorer import predict_one, load_bundle
except ImportError as e:
    print(f"Error importing scorer: {e}")
    print("Make sure the model has been trained and risk_model_bundle.joblib exists")
    sys.exit(1)

app = Flask(__name__)
CORS(app)

DATABASE = 'diabetes_app.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS auth_tokens (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS glucose_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            value REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS nutrition_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            name TEXT NOT NULL,
            servings REAL NOT NULL,
            carbs REAL NOT NULL,
            protein REAL NOT NULL,
            fat REAL NOT NULL,
            fiber REAL NOT NULL,
            calories REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS activity_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            minutes INTEGER NOT NULL,
            type TEXT NOT NULL,
            calories INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS weight_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            weight REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS risk_assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            probability REAL NOT NULL,
            risk_level INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            glucose_min REAL,
            glucose_max REAL,
            calorie_target REAL,
            carb_target REAL,
            activity_weekly_minutes INTEGER,
            weight_target REAL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS streaks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            current_streak INTEGER DEFAULT 0,
            longest_streak INTEGER DEFAULT 0,
            last_activity_date TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS milestones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            milestone_type TEXT NOT NULL,
            milestone_name TEXT NOT NULL,
            achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    conn.commit()
    conn.close()
    print("Database initialized successfully")

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token():
    return secrets.token_urlsafe(32)

def update_streak(user_id, activity_date):
    db = get_db()
    cursor = db.cursor()

    cursor.execute('SELECT current_streak, longest_streak, last_activity_date FROM streaks WHERE user_id = ?', (user_id,))
    streak_data = cursor.fetchone()

    if not streak_data:
        cursor.execute('INSERT INTO streaks (user_id, current_streak, longest_streak, last_activity_date) VALUES (?, 1, 1, ?)',
                      (user_id, activity_date))
        db.commit()
        check_milestones(user_id, 1)
        return

    current_streak, longest_streak, last_activity_date = streak_data

    from datetime import datetime, timedelta
    try:
        activity_dt = datetime.strptime(activity_date, '%Y-%m-%d')
        last_dt = datetime.strptime(last_activity_date, '%Y-%m-%d') if last_activity_date else None
    except:
        return

    if last_dt:
        day_diff = (activity_dt - last_dt).days

        if day_diff == 0:
            return
        elif day_diff == 1:
            current_streak += 1
        elif day_diff > 1:
            current_streak = 1
    else:
        current_streak = 1

    if current_streak > longest_streak:
        longest_streak = current_streak

    cursor.execute('''UPDATE streaks SET current_streak = ?, longest_streak = ?,
                      last_activity_date = ?, updated_at = CURRENT_TIMESTAMP
                      WHERE user_id = ?''',
                  (current_streak, longest_streak, activity_date, user_id))
    db.commit()

    check_milestones(user_id, current_streak)

def check_milestones(user_id, current_streak):
    db = get_db()
    cursor = db.cursor()

    milestone_thresholds = {
        3: "3_day_streak",
        7: "7_day_streak",
        14: "14_day_streak",
        30: "30_day_streak",
        60: "60_day_streak",
        100: "100_day_streak"
    }

    for threshold, milestone_name in milestone_thresholds.items():
        if current_streak >= threshold:
            cursor.execute('SELECT id FROM milestones WHERE user_id = ? AND milestone_name = ?',
                          (user_id, milestone_name))
            if not cursor.fetchone():
                cursor.execute('INSERT INTO milestones (user_id, milestone_type, milestone_name) VALUES (?, ?, ?)',
                              (user_id, 'streak', milestone_name))

    db.commit()

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"error": "No authorization token provided"}), 401

        if token.startswith('Bearer '):
            token = token[7:]

        db = get_db()
        cursor = db.cursor()
        cursor.execute('''
            SELECT user_id FROM auth_tokens
            WHERE token = ? AND expires_at > datetime('now')
        ''', (token,))

        result = cursor.fetchone()
        if not result:
            return jsonify({"error": "Invalid or expired token"}), 401

        g.user_id = result[0]
        return f(*args, **kwargs)

    return decorated_function

init_db()

try:
    bundle = load_bundle()
    print("Model loaded successfully")
except Exception as e:
    print(f"Failed to load model: {e}")
    bundle = None

@app.route('/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    db = get_db()
    cursor = db.cursor()

    cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
    if cursor.fetchone():
        return jsonify({"error": "Username already exists"}), 400

    password_hash = hash_password(password)
    cursor.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                   (username, password_hash))
    db.commit()

    return jsonify({"message": "Account created successfully"}), 201

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    db = get_db()
    cursor = db.cursor()

    cursor.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()

    if not user or user[1] != hash_password(password):
        return jsonify({"error": "Invalid username or password"}), 401

    user_id = user[0]

    token = generate_token()
    expires_at = datetime.now() + timedelta(days=30)

    cursor.execute('INSERT INTO auth_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
                   (token, user_id, expires_at))
    db.commit()

    return jsonify({
        "token": token,
        "username": username,
        "expires_at": expires_at.isoformat()
    }), 200

@app.route('/auth/logout', methods=['POST'])
@require_auth
def logout():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')

    db = get_db()
    cursor = db.cursor()
    cursor.execute('DELETE FROM auth_tokens WHERE token = ?', (token,))
    db.commit()

    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/data/glucose', methods=['GET', 'POST', 'DELETE'])
@require_auth
def glucose_data():
    db = get_db()
    cursor = db.cursor()

    if request.method == 'GET':
        cursor.execute('SELECT date, value FROM glucose_data WHERE user_id = ? ORDER BY date',
                       (g.user_id,))
        rows = cursor.fetchall()
        return jsonify([{"date": row[0], "value": row[1]} for row in rows]), 200

    elif request.method == 'POST':
        data = request.get_json()
        date = data.get('date')
        value = data.get('value')

        if not date or value is None:
            return jsonify({"error": "Date and value required"}), 400

        cursor.execute('INSERT INTO glucose_data (user_id, date, value) VALUES (?, ?, ?)',
                       (g.user_id, date, value))
        db.commit()

        update_streak(g.user_id, date)

        return jsonify({"message": "Glucose data added"}), 201

    elif request.method == 'DELETE':
        data = request.get_json()
        date = data.get('date')
        cursor.execute('DELETE FROM glucose_data WHERE user_id = ? AND date = ?',
                       (g.user_id, date))
        db.commit()
        return jsonify({"message": "Glucose data deleted"}), 200

@app.route('/data/nutrition', methods=['GET', 'POST', 'DELETE'])
@require_auth
def nutrition_data_endpoint():
    db = get_db()
    cursor = db.cursor()

    if request.method == 'GET':
        cursor.execute('''SELECT date, name, servings, carbs, protein, fat, fiber, calories
                          FROM nutrition_data WHERE user_id = ? ORDER BY date''',
                       (g.user_id,))
        rows = cursor.fetchall()
        return jsonify([{
            "date": row[0], "name": row[1], "servings": row[2],
            "carbs": row[3], "protein": row[4], "fat": row[5],
            "fiber": row[6], "calories": row[7]
        } for row in rows]), 200

    elif request.method == 'POST':
        data = request.get_json()
        cursor.execute('''INSERT INTO nutrition_data
                          (user_id, date, name, servings, carbs, protein, fat, fiber, calories)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                       (g.user_id, data['date'], data['name'], data['servings'],
                        data['carbs'], data['protein'], data['fat'], data['fiber'], data['calories']))
        db.commit()

        update_streak(g.user_id, data['date'])

        return jsonify({"message": "Nutrition data added"}), 201

    elif request.method == 'DELETE':
        data = request.get_json()
        idx = data.get('index')
        cursor.execute('''SELECT id FROM nutrition_data WHERE user_id = ? ORDER BY date''',
                       (g.user_id,))
        rows = cursor.fetchall()
        if idx < len(rows):
            cursor.execute('DELETE FROM nutrition_data WHERE id = ?', (rows[idx][0],))
            db.commit()
        return jsonify({"message": "Nutrition data deleted"}), 200

@app.route('/data/activity', methods=['GET', 'POST', 'DELETE'])
@require_auth
def activity_data_endpoint():
    db = get_db()
    cursor = db.cursor()

    if request.method == 'GET':
        cursor.execute('''SELECT date, minutes, type, calories
                          FROM activity_data WHERE user_id = ? ORDER BY date''',
                       (g.user_id,))
        rows = cursor.fetchall()
        return jsonify([{
            "date": row[0], "minutes": row[1], "type": row[2], "calories": row[3]
        } for row in rows]), 200

    elif request.method == 'POST':
        data = request.get_json()
        cursor.execute('''INSERT INTO activity_data
                          (user_id, date, minutes, type, calories)
                          VALUES (?, ?, ?, ?, ?)''',
                       (g.user_id, data['date'], data['minutes'], data['type'],
                        data.get('calories')))
        db.commit()

        update_streak(g.user_id, data['date'])

        return jsonify({"message": "Activity data added"}), 201

    elif request.method == 'DELETE':
        data = request.get_json()
        idx = data.get('index')
        cursor.execute('''SELECT id FROM activity_data WHERE user_id = ? ORDER BY date''',
                       (g.user_id,))
        rows = cursor.fetchall()
        if idx < len(rows):
            cursor.execute('DELETE FROM activity_data WHERE id = ?', (rows[idx][0],))
            db.commit()
        return jsonify({"message": "Activity data deleted"}), 200

@app.route('/data/weight', methods=['GET', 'POST', 'DELETE'])
@require_auth
def weight_data_endpoint():
    db = get_db()
    cursor = db.cursor()

    if request.method == 'GET':
        cursor.execute('''SELECT date, weight
                          FROM weight_data WHERE user_id = ? ORDER BY date''',
                       (g.user_id,))
        rows = cursor.fetchall()
        return jsonify([{
            "date": row[0], "weight": row[1]
        } for row in rows]), 200

    elif request.method == 'POST':
        data = request.get_json()
        cursor.execute('''INSERT INTO weight_data
                          (user_id, date, weight)
                          VALUES (?, ?, ?)''',
                       (g.user_id, data['date'], data['weight']))
        db.commit()

        update_streak(g.user_id, data['date'])

        return jsonify({"message": "Weight data added"}), 201

    elif request.method == 'DELETE':
        data = request.get_json()
        idx = data.get('index')
        cursor.execute('''SELECT id FROM weight_data WHERE user_id = ? ORDER BY date''',
                       (g.user_id,))
        rows = cursor.fetchall()
        if idx < len(rows):
            cursor.execute('DELETE FROM weight_data WHERE id = ?', (rows[idx][0],))
            db.commit()
        return jsonify({"message": "Weight data deleted"}), 200

@app.route('/data/risk', methods=['GET', 'POST'])
@require_auth
def risk_data_endpoint():
    db = get_db()
    cursor = db.cursor()

    if request.method == 'GET':
        cursor.execute('''SELECT probability, risk_level, created_at
                          FROM risk_assessments WHERE user_id = ?
                          ORDER BY created_at DESC LIMIT 1''',
                       (g.user_id,))
        row = cursor.fetchone()
        if row:
            return jsonify({
                "probability": row[0],
                "risk_level": row[1],
                "created_at": row[2]
            }), 200
        else:
            return jsonify(None), 200

    elif request.method == 'POST':
        data = request.get_json()
        cursor.execute('''INSERT INTO risk_assessments
                          (user_id, probability, risk_level)
                          VALUES (?, ?, ?)''',
                       (g.user_id, data['probability'], data['risk_level']))
        db.commit()
        return jsonify({"message": "Risk assessment saved"}), 201

@app.route('/data/goals', methods=['GET', 'POST'])
@require_auth
def goals_data_endpoint():
    db = get_db()
    cursor = db.cursor()

    if request.method == 'GET':
        cursor.execute('''SELECT glucose_min, glucose_max, calorie_target, carb_target,
                          activity_weekly_minutes, weight_target
                          FROM goals WHERE user_id = ?''',
                       (g.user_id,))
        row = cursor.fetchone()
        if row:
            return jsonify({
                "glucose_min": row[0],
                "glucose_max": row[1],
                "calorie_target": row[2],
                "carb_target": row[3],
                "activity_weekly_minutes": row[4],
                "weight_target": row[5]
            }), 200
        else:
            return jsonify(None), 200

    elif request.method == 'POST':
        data = request.get_json()

        cursor.execute('SELECT id FROM goals WHERE user_id = ?', (g.user_id,))
        existing = cursor.fetchone()

        if existing:
            cursor.execute('''UPDATE goals SET
                              glucose_min = ?, glucose_max = ?, calorie_target = ?,
                              carb_target = ?, activity_weekly_minutes = ?, weight_target = ?,
                              updated_at = CURRENT_TIMESTAMP
                              WHERE user_id = ?''',
                           (data.get('glucose_min'), data.get('glucose_max'),
                            data.get('calorie_target'), data.get('carb_target'),
                            data.get('activity_weekly_minutes'), data.get('weight_target'),
                            g.user_id))
        else:
            cursor.execute('''INSERT INTO goals
                              (user_id, glucose_min, glucose_max, calorie_target, carb_target,
                               activity_weekly_minutes, weight_target)
                              VALUES (?, ?, ?, ?, ?, ?, ?)''',
                           (g.user_id, data.get('glucose_min'), data.get('glucose_max'),
                            data.get('calorie_target'), data.get('carb_target'),
                            data.get('activity_weekly_minutes'), data.get('weight_target')))

        db.commit()
        return jsonify({"message": "Goals saved"}), 200

@app.route('/predict', methods=['POST'])
def predict():
    if bundle is None:
        return jsonify({"error": "Model not loaded"}), 500

    try:
        payload = request.get_json()

        required_fields = ["RIAGENDR", "RIDAGEYR", "RIDRETH1", "BMXWT", "BMXHT"]
        missing = [f for f in required_fields if f not in payload]
        if missing:
            return jsonify({"error": f"Missing required fields: {missing}"}), 400

        if "BMXBMI" not in payload or payload["BMXBMI"] is None:
            weight = payload["BMXWT"]
            height_m = payload["BMXHT"] / 100.0
            payload["BMXBMI"] = weight / (height_m ** 2)

        result = predict_one(payload, bundle=bundle)

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analyze-food', methods=['POST'])
def analyze_food():
    try:
        data = request.get_json()
        description = data.get('description', '').strip()

        if not description:
            return jsonify({"error": "No description provided"}), 400

        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            return jsonify({"error": "OPENAI_API_KEY not set"}), 500

        client = OpenAI(api_key=api_key)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a nutrition expert. Analyze food descriptions and return nutritional data in JSON format only, with no additional text."
                },
                {
                    "role": "user",
                    "content": f"""Analyze this food description and extract nutritional information for each food item mentioned.

Food description: {description}

Return ONLY a valid JSON array with no additional text, where each item has:
- name: descriptive name of the food
- carbs: carbohydrates in grams
- protein: protein in grams
- fat: fat in grams
- fiber: fiber in grams
- calories: total calories

Example format:
[
  {{"name": "Turkey Sandwich", "carbs": 35, "protein": 25, "fat": 8, "fiber": 3, "calories": 320}},
  {{"name": "Potato Chips (1 oz)", "carbs": 15, "protein": 2, "fat": 10, "fiber": 1, "calories": 150}}
]

Provide reasonable estimates for typical serving sizes."""
                }
            ],
            temperature=0.7,
            max_tokens=1024
        )

        response_text = response.choices[0].message.content.strip()

        if response_text.startswith('```'):
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:-1])

        foods = json.loads(response_text)

        return jsonify({"foods": foods}), 200

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Failed to parse AI response: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analyze-activity', methods=['POST'])
def analyze_activity():
    try:
        data = request.get_json()
        description = data.get('description', '').strip()

        if not description:
            return jsonify({"error": "No description provided"}), 400

        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            return jsonify({"error": "OPENAI_API_KEY not set"}), 500

        client = OpenAI(api_key=api_key)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a fitness expert. Analyze activity descriptions and calculate calories burned based on typical metabolic equivalents (METs). Return JSON only."
                },
                {
                    "role": "user",
                    "content": f"""Analyze this activity description and calculate calories burned.

Activity description: {description}

Return ONLY a valid JSON object with no additional text:
{{
  "activity_type": "the activity name (e.g., Basketball, Running, Yoga)",
  "minutes": duration in minutes,
  "calories": estimated calories burned (use standard MET values for average adult)
}}

Use typical MET values:
- Walking (3 mph): 3.5 METs (~4 cal/min)
- Running (6 mph): 10 METs (~11 cal/min)
- Cycling (moderate): 8 METs (~9 cal/min)
- Swimming: 8 METs (~9 cal/min)
- Basketball: 6.5 METs (~7 cal/min)
- Yoga: 2.5 METs (~3 cal/min)
- Strength training: 5 METs (~6 cal/min)
- Sports (general): 7 METs (~8 cal/min)

Calculate calories as: minutes × calories_per_minute for the activity type."""
                }
            ],
            temperature=0.5,
            max_tokens=256
        )

        response_text = response.choices[0].message.content.strip()

        if response_text.startswith('```'):
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:-1])

        result = json.loads(response_text)

        return jsonify(result), 200

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Failed to parse AI response: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analyze-barcode-photo', methods=['POST'])
def analyze_barcode_photo():
    try:
        data = request.get_json()
        image_data = data.get('image', '').strip()

        if not image_data:
            return jsonify({"error": "No image provided"}), 400

        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            return jsonify({"error": "OPENAI_API_KEY not set"}), 500

        client = OpenAI(api_key=api_key)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at reading nutrition labels and product information. Extract nutritional data directly from photos when possible."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Look at this product image and extract all available information:

1. CAREFULLY read the COMPLETE barcode number below the barcode lines
   - UPC-A barcodes have 12 digits
   - EAN-13 barcodes have 13 digits
   - Look for ALL digits including those on the far left and right edges
   - Common mistake: missing the first 1-2 digits - please check the edges carefully
2. If Nutrition Facts label is visible, extract the nutrition values EXACTLY as shown
3. Get the product name if visible

Return ONLY valid JSON with no additional text:

{
  "barcode": "COMPLETE barcode number with ALL digits (usually 12-13 digits), null if not visible",
  "product_name": "name of product if visible",
  "servings": estimated servings in container,
  "has_nutrition_label": true or false,
  "nutrition": {
    "calories": calories per serving (if label visible),
    "carbs": carbs in grams per serving (if label visible),
    "protein": protein in grams per serving (if label visible),
    "fat": fat in grams per serving (if label visible),
    "fiber": fiber in grams per serving (if label visible)
  },
  "confidence": "high" or "medium" or "low"
}

IMPORTANT:
- UPC barcodes should have exactly 12 digits - if you only see 10-11 digits, look more carefully at the edges
- Read the ENTIRE number from left edge to right edge
- If nutrition label is not visible, set has_nutrition_label to false
- Always try to extract the complete barcode even if nutrition label is visible"""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data
                            }
                        }
                    ]
                }
            ],
            max_tokens=500
        )

        response_text = response.choices[0].message.content.strip()

        if response_text.startswith('```'):
            lines = response_text.split('\n')
            response_text = '\n'.join(lines[1:-1])

        result = json.loads(response_text)

        return jsonify(result), 200

    except json.JSONDecodeError as e:
        return jsonify({"error": f"Failed to parse AI response: {str(e)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/analyze-goals', methods=['POST'])
@require_auth
def analyze_goals():
    try:
        data = request.get_json()

        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            return jsonify({"error": "OPENAI_API_KEY not set"}), 500

        goals = data.get('goals', {})
        recent_data = data.get('recent_data', {})

        prompt = f"""You are a diabetes prevention coach. Analyze the user's progress towards their health goals and provide encouraging, actionable insights for preventing diabetes.

User's Goals:
{json.dumps(goals, indent=2)}

Recent Data (last 7 days):
{json.dumps(recent_data, indent=2)}

Provide a brief analysis in JSON format with these fields:
{{
  "overall_status": "on_track" | "needs_attention" | "excellent",
  "summary": "2-3 sentence overall assessment",
  "insights": [
    {{
      "category": "glucose" | "nutrition" | "activity" | "weight",
      "status": "on_track" | "needs_improvement" | "excellent",
      "message": "brief encouraging message with specific data"
    }}
  ],
  "recommendations": ["actionable tip 1", "actionable tip 2"]
}}

Be encouraging, specific, and focus on progress. Use actual numbers from the data. Always include insights for weight if weight data exists, as weight loss is critical for diabetes prevention."""

        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a supportive diabetes management coach. Provide analysis in JSON format only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=800
        )

        response_text = response.choices[0].message.content.strip()

        if response_text.startswith('```'):
            response_text = response_text.split('```')[1]
            if response_text.startswith('json'):
                response_text = response_text[4:]
            response_text = response_text.strip()

        analysis = json.loads(response_text)
        return jsonify(analysis), 200

    except Exception as e:
        print(f"Error in goal analysis: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/data/streaks', methods=['GET'])
@require_auth
def get_streaks():
    db = get_db()
    cursor = db.cursor()

    cursor.execute('''SELECT current_streak, longest_streak, last_activity_date
                      FROM streaks WHERE user_id = ?''', (g.user_id,))
    row = cursor.fetchone()

    if row:
        return jsonify({
            "current_streak": row[0],
            "longest_streak": row[1],
            "last_activity_date": row[2]
        }), 200
    else:
        return jsonify({
            "current_streak": 0,
            "longest_streak": 0,
            "last_activity_date": None
        }), 200

@app.route('/data/milestones', methods=['GET'])
@require_auth
def get_milestones():
    db = get_db()
    cursor = db.cursor()

    cursor.execute('''SELECT milestone_type, milestone_name, achieved_at
                      FROM milestones WHERE user_id = ?
                      ORDER BY achieved_at DESC''', (g.user_id,))
    rows = cursor.fetchall()

    return jsonify([{
        "type": row[0],
        "name": row[1],
        "achieved_at": row[2]
    } for row in rows]), 200

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "model_loaded": bundle is not None
    }), 200

if __name__ == '__main__':
    print("Starting Flask API server...")
    print("API will be available at http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
