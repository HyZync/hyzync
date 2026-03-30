"""
Data export utility for user data downloads.
Handles conversion of user data to various formats (JSON, CSV) and ZIP packaging.
"""

import json
import csv
import io
import zipfile
from datetime import datetime
from typing import Dict, List, Any


def create_export_archive(user_data: Dict[str, Any]) -> bytes:
    """
    Create a ZIP archive containing all user data in JSON and CSV formats.
    Returns ZIP file as bytes for download.
    """
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Add complete JSON export
        json_data = json.dumps(user_data, indent=2, default=str)
        zip_file.writestr('complete_export.json', json_data)
        
        # Add user profile as CSV
        if 'user' in user_data:
            user_csv = _dict_to_csv([user_data['user']])
            zip_file.writestr('user_profile.csv', user_csv)
        
        # Add analyses as CSV
        if 'analyses' in user_data and user_data['analyses']:
            analyses_csv = format_analysis_csv(user_data['analyses'])
            zip_file.writestr('analyses_history.csv', analyses_csv)
        
        # Add tickets as CSV
        if 'tickets' in user_data and user_data['tickets']:
            tickets_csv = format_tickets_csv(user_data['tickets'])
            zip_file.writestr('support_tickets.csv', tickets_csv)
        
        # Add usage stats as CSV
        if 'usage' in user_data and user_data['usage']:
            usage_csv = _dict_to_csv(user_data['usage'])
            zip_file.writestr('usage_statistics.csv', usage_csv)
        
        # Add billing as CSV
        if 'billing' in user_data and user_data['billing']:
            billing_csv = _dict_to_csv(user_data['billing'])
            zip_file.writestr('billing_history.csv', billing_csv)
        
        # Add README
        readme = _create_readme(user_data)
        zip_file.writestr('README.txt', readme)
    
    zip_buffer.seek(0)
    return zip_buffer.getvalue()


def format_analysis_csv(analyses: List[Dict]) -> str:
    """Convert analyses list to CSV format."""
    if not analyses:
        return ""
    
    output = io.StringIO()
    
    # Simplified columns (excluding complex nested JSON)
    fieldnames = ['id', 'timestamp', 'vertical', 'source_type', 'total_reviews']
    
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    
    for analysis in analyses:
        # Flatten the analysis data
        row = {
            'id': analysis.get('id'),
            'timestamp': analysis.get('timestamp'),
            'vertical': analysis.get('vertical'),
            'source_type': analysis.get('source_type'),
            'total_reviews': analysis.get('total_reviews')
        }
        writer.writerow(row)
    
    return output.getvalue()


def format_tickets_csv(tickets: List[Dict]) -> str:
    """Convert tickets list to CSV format."""
    if not tickets:
        return ""
    
    output = io.StringIO()
    
    fieldnames = ['id', 'subject', 'status', 'priority', 'created_at', 'updated_at', 'message_count']
    
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    
    for ticket in tickets:
        writer.writerow(ticket)
    
    return output.getvalue()


def _dict_to_csv(data: List[Dict]) -> str:
    """Generic function to convert list of dicts to CSV."""
    if not data:
        return ""
    
    output = io.StringIO()
    
    # Get all unique keys from all dicts
    fieldnames = set()
    for item in data:
        fieldnames.update(item.keys())
    
    fieldnames = sorted(list(fieldnames))
    
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    
    for item in data:
        # Convert any complex types to strings
        row = {k: str(v) if not isinstance(v, (str, int, float, type(None))) else v 
               for k, v in item.items()}
        writer.writerow(row)
    
    return output.getvalue()


def _create_readme(user_data: Dict) -> str:
    """Create a README file for the export."""
    export_date = user_data.get('export_date', datetime.now().isoformat())
    user_email = user_data.get('user', {}).get('email', 'Unknown')
    
    readme = f"""HORIZON DATA EXPORT
===================

Export Date: {export_date}
User Email: {user_email}

This archive contains all of your data from the Horizon platform.

FILES INCLUDED:
--------------

1. complete_export.json
   Complete data export in JSON format with full fidelity.

2. user_profile.csv
   Your user profile information.

3. analyses_history.csv
   History of all analyses you've run.

4. support_tickets.csv
   Your support tickets and their status.

5. usage_statistics.csv
   Detailed usage metrics.

6. billing_history.csv
   Billing history and cost breakdown.


DATA PRIVACY:
------------
This export contains sensitive personal information. Please store it securely
and delete it when no longer needed.


QUESTIONS?
---------
Contact support@hyzync.com for assistance.


© 2024 Hyzync. All rights reserved.
"""
    return readme
