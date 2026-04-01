from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import gspread
from google.oauth2.service_account import Credentials
import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Configuration
SHEET_ID = '1Hp3hgrOlOQm4ngFK0BsKrOHK1VIXlRp4d6XCVyZ0CRY'
CREDENTIALS_FILE = 'credentials.json'

# Google Sheets API Setup
def get_gspread_client():
    # 1. Try loading from environment variable GOOGLE_CREDENTIALS (JSON string)
    env_creds = os.environ.get('GOOGLE_CREDENTIALS')
    if env_creds:
        try:
            import json
            creds_dict = json.loads(env_creds)
            scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
            creds = Credentials.from_service_account_info(creds_dict, scopes=scope)
            return gspread.authorize(creds), None
        except Exception as e:
            return None, f"Error parsing GOOGLE_CREDENTIALS env var: {str(e)}"
            
    # 2. Try loading from backend/credentials.json
    backend_path = os.path.join(os.path.dirname(__file__), CREDENTIALS_FILE)
    if os.path.exists(backend_path):
        try:
            scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
            creds = Credentials.from_service_account_file(backend_path, scopes=scope)
            return gspread.authorize(creds), None
        except Exception as e:
            return None, f"Error loading backend/credentials.json: {str(e)}"

    # 3. Try loading from root/credentials.json (useful for some Render setups)
    root_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), CREDENTIALS_FILE)
    if os.path.exists(root_path):
        try:
            scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
            creds = Credentials.from_service_account_file(root_path, scopes=scope)
            return gspread.authorize(creds), None
        except Exception as e:
            return None, f"Error loading root/credentials.json: {str(e)}"
    
    return None, "No credentials found (check GOOGLE_CREDENTIALS env var or credentials.json file)"

@app.route('/')
def home():
    return app.send_static_file('index.html')

@app.route('/api/incentives', methods=['GET'])
def get_incentives():
    """Fetch data using gspread (authenticated) to avoid CORS/Auth issues."""
    try:
        client, error = get_gspread_client()
        if not client:
            return jsonify({"error": error}), 400
            
        sheet = client.open_by_key(SHEET_ID).sheet1
        data = sheet.get_all_values()
        
        # Return as JSON to be handled by the frontend
        return jsonify(data)
    except Exception as e:
        print(f"Error fetching data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/incentives', methods=['POST'])
def add_incentive():
    """Adds a new row to the spreadsheet using Service Account."""
    try:
        data = request.json
        client, error = get_gspread_client()
        
        if not client:
            return jsonify({"error": error}), 400
        
        sheet = client.open_by_key(SHEET_ID).sheet1
        
        # Mapping frontend data to spreadsheet columns
        new_row = [
            data.get('tipo-incentivo'),
            data.get('num-sow'),
            data.get('nome-cliente'),
            data.get('approval-date'),
            data.get('approval-date', '2025')[:4], # Year
            data.get('ano-entrega'),
            data.get('valor-aprovado'),
            0, # Paid
            0, # Investment
            'Ongoing' # Status
        ]
        
        sheet.append_row(new_row)
        return jsonify({"status": "success"}), 201
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Incentivos Google Backend running on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
