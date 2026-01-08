# DiaMetrics

Congressional App Challenge 2025
AI-based diabetes risk tracking and prevention web application.

1. Clone the repository:
```bash
git clone https://github.com/yourusername/DiaMetrics.git
cd DiaMetrics
```

2. Install Python dependencies:
```bash
export OPENAI_API_KEY
pip install -r requirements.txt
```

3. Train ML Model (required for first run)

   The trained model is not included in the repository due to size constraints. You need to train it:

   Download NHANES data and create `ml/clean.csv` with these columns:
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

   Run the training script:
   ```bash
   cd ml
   python train_model.py
   ```

   This will create `ml_outputs/risk_model_bundle.joblib`

4. Set up your OpenAI API key:

5. Run the backend:
```bash
python api.py
```

6. Open the app in your browser:
```bash
python -m http.server 8000
```

Navigate to `http://localhost:8000`

## License

MIT License

## Acknowledgments

- ML model trained on NHANES (National Health and Nutrition Examination Survey) data
- AI features powered by OpenAI GPT-4o-mini
