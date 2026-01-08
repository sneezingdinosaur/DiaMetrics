# DiaMetrics

A diabetes risk assessment and management web application with machine learning-powered predictions and AI-assisted health tracking.

## Features

- **Risk Calculator**: ML-powered diabetes risk prediction (AUROC: 0.89)
- **Health Tracking**: Monitor glucose, nutrition, activity, and weight
- **AI Food Analysis**: Describe meals in natural language for automatic nutrition tracking
- **Activity Logging**: AI-powered activity recognition and calorie estimation
- **Goal Setting**: Set personalized health goals with progress tracking
- **Streak Tracking**: Gamified engagement with milestones and achievements
- **AI Insights**: Personalized health recommendations based on your data

## Tech Stack

- **Frontend**: Vanilla JavaScript, Chart.js
- **Backend**: Flask (Python)
- **ML Model**: Ensemble model (AUROC: 0.89)
- **AI**: OpenAI GPT-4o-mini for food/activity analysis
- **Database**: SQLite

## Setup

### Prerequisites

- Python 3.8+
- pip
- OpenAI API key
- NHANES dataset (for training the ML model)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/DiaMetrics.git
cd DiaMetrics
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. **Train the ML model** (required on first setup):

   The trained model file is not included in the repository due to size constraints (678 MB). You need to train it:

   a. Download NHANES data and create `ml/clean.csv` with these columns:
      - `SEQN` (participant ID)
      - `DIQ010` (diabetes diagnosis: 1=Yes, 2=No)
      - `RIAGENDR` (gender: 1=Male, 2=Female)
      - `RIDAGEYR` (age in years)
      - `RIDRETH1` (race/ethnicity: 1-5)
      - `BMXWT` (weight in kg)
      - `BMXHT` (height in cm)
      - `BMXBMI` (BMI)
      - `BMXWAIST` (waist circumference in cm)
      - `BMXHIP` (hip circumference in cm)

   b. Run the training script:
   ```bash
   cd ml
   python train_model.py
   ```

   This will create `ml_outputs/risk_model_bundle.joblib` (takes ~10-15 minutes)

4. Set up your OpenAI API key:
```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

5. Run the backend server:
```bash
python api.py
```

6. Open the app in your browser:
```
Open index.html in your browser or serve it with a simple HTTP server:
python -m http.server 8000
```

Then navigate to `http://localhost:8000`

## Usage

### First Time Setup

1. Open the app and create an account
2. Fill out the risk assessment form with your health metrics
3. Set your health goals on the Dashboard
4. Start logging your daily health data

### Daily Use

1. **Glucose**: Log blood glucose readings
2. **Nutrition**: Describe what you ate (AI will extract nutrition info)
3. **Activity**: Describe your exercise (AI will calculate calories)
4. **Weight**: Track weight changes over time
5. **Dashboard**: View streaks, milestones, and AI-powered insights

## ML Model

The risk prediction model is an ensemble (voting classifier) trained on NHANES data:
- **AUROC**: 0.89
- **Features**: Demographics (age, sex, ethnicity), anthropometrics (BMI, waist, hip)
- **Models**: Logistic Regression, Random Forest, Gradient Boosting, XGBoost, LightGBM, Extra Trees
- **Preprocessing**: Median imputation, MinMax scaling, SMOTE for class imbalance
- **Calibration**: Isotonic calibration for accurate probability estimates

### Training Your Own Model

The model training script (`ml/train_model.py`) includes:
- Data preprocessing and cleaning
- SMOTE oversampling for imbalanced classes
- Multiple classifier training (6 models)
- Ensemble voting classifier
- Isotonic calibration
- Feature importance analysis
- Performance metrics (AUROC, precision, recall, F1)

Training outputs:
- `ml_outputs/risk_model_bundle.joblib` - Main model bundle
- `ml_outputs/*.joblib` - Individual trained models
- `ml_outputs/per_class_metrics.csv` - Model performance metrics
- `ml_outputs/feature_importance_*.csv` - Feature importance scores

## API Endpoints

### Authentication
- `POST /auth/signup` - Create account
- `POST /auth/login` - Login
- `POST /auth/logout` - Logout

### Data
- `GET/POST /data/glucose` - Glucose readings
- `GET/POST /data/nutrition` - Nutrition logs
- `GET/POST /data/activity` - Activity logs
- `GET/POST /data/weight` - Weight logs
- `GET/POST /data/goals` - Health goals
- `GET /data/streaks` - Streak data
- `GET /data/milestones` - Achievements

### ML & AI
- `POST /predict` - Get diabetes risk prediction
- `POST /analyze-food` - AI food analysis
- `POST /analyze-activity` - AI activity analysis
- `POST /analyze-goals` - AI progress insights

## Database Schema

The app uses SQLite with the following tables:
- `users` - User accounts
- `auth_tokens` - Session tokens
- `glucose_data` - Glucose readings
- `nutrition_data` - Food logs
- `activity_data` - Exercise logs
- `weight_data` - Weight tracking
- `risk_assessments` - Risk predictions
- `goals` - User health goals
- `streaks` - Activity streaks
- `milestones` - Achievements

## Project Structure

```
DiaMetrics/
├── api.py                 # Flask backend
├── index.html            # Main HTML file
├── app.js                # Frontend logic
├── auth.js               # Authentication module
├── styles.css            # Styling
├── DiaMetrics.png        # Logo
├── ml/
│   ├── train_model.py    # Model training script
│   ├── scorer.py         # ML prediction logic
│   └── ml_outputs/
│       └── risk_model_bundle.joblib  # Trained model (generated)
├── requirements.txt      # Python dependencies
├── .env.example         # Environment variables template
└── README.md            # This file
```

## License

MIT License

## Acknowledgments

- ML model trained on NHANES (National Health and Nutrition Examination Survey) data
- AI features powered by OpenAI GPT-4o-mini
