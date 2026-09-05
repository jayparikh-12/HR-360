import json
with open(r'D:\ODOO\server\package.json') as f:
    d = json.load(f)
print(d.get('type', 'unknown'))