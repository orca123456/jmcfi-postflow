import sys
import os
import json
import re
import xlsxwriter
from xlsxwriter.utility import xl_col_to_name

def generate_template(output_path, config_data=None):
    if config_data is None:
        # Default system configuration if no payload passed
        config_data = {
            "roles": [
                {"name": "Requestor", "key": "requestor"},
                {"name": "Approver", "key": "approver"},
                {"name": "Admin", "key": "admin"}
            ],
            "mappings": {
                "Requestor": [
                    "College of Information Technology",
                    "College of Arts and Sciences",
                    "College of Business Administration",
                    "College of Education",
                    "College of Engineering",
                    "College of Nursing"
                ],
                "Approver": [
                    "Institutional Marketing Communication",
                    "Vice President of Academic Affairs",
                    "College of Information Technology",
                    "College of Arts and Sciences",
                    "College of Business Administration",
                    "College of Education",
                    "College of Engineering",
                    "College of Nursing"
                ],
                "Admin": [
                    "Information Technology Office"
                ]
            }
        }

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    wb = xlsxwriter.Workbook(output_path)

    # Worksheets
    ws = wb.add_worksheet('User Accounts')
    data_ws = wb.add_worksheet('SystemData')
    data_ws.hide()

    # Formats
    fmt_logo_cell = wb.add_format({
        'align': 'center',
        'valign': 'vcenter'
    })

    fmt_institution_title = wb.add_format({
        'font_name': 'Georgia',
        'font_size': 16,
        'bold': True,
        'font_color': '#1E3A8A', # Deep Navy
        'align': 'center',
        'valign': 'vcenter'
    })

    fmt_foundation = wb.add_format({
        'font_name': 'Calibri',
        'font_size': 11,
        'bold': True,
        'font_color': '#374151', # Charcoal Gray
        'align': 'center',
        'valign': 'vcenter'
    })

    fmt_address = wb.add_format({
        'font_name': 'Calibri',
        'font_size': 8.5,
        'italic': True,
        'underline': True,
        'font_color': '#4B5563',
        'align': 'center',
        'valign': 'vcenter'
    })

    fmt_contact = wb.add_format({
        'font_name': 'Calibri',
        'font_size': 8.5,
        'font_color': '#4B5563',
        'align': 'center',
        'valign': 'vcenter'
    })

    fmt_motto = wb.add_format({
        'font_name': 'Calibri',
        'font_size': 8.5,
        'italic': True,
        'bold': True,
        'font_color': '#5B0FB8', # Royal Purple
        'align': 'center',
        'valign': 'vcenter'
    })

    fmt_divider = wb.add_format({
        'bg_color': '#5B0FB8',
        'border': 0
    })

    fmt_table_header = wb.add_format({
        'font_name': 'Calibri',
        'font_size': 11,
        'bold': True,
        'font_color': '#FFFFFF',
        'bg_color': '#5B0FB8', # Royal Purple
        'align': 'center',
        'valign': 'vcenter',
        'top': 1,
        'bottom': 1,
        'left': 1,
        'right': 1,
        'border_color': '#5B0FB8'
    })

    fmt_data_cell = wb.add_format({
        'font_name': 'Calibri',
        'font_size': 10,
        'align': 'left',
        'valign': 'vcenter',
        'top': 1,
        'bottom': 1,
        'left': 1,
        'right': 1,
        'border_color': '#D1D5DB'
    })

    # Column Widths
    ws.set_column('A:A', 18) # first_name
    ws.set_column('B:B', 18) # last_name
    ws.set_column('C:C', 30) # email
    ws.set_column('D:D', 18) # password
    ws.set_column('E:E', 20) # role
    ws.set_column('F:F', 38) # department

    # Row Heights
    ws.set_row(0, 24) # Row 1: JOSE MARIA COLLEGE
    ws.set_row(1, 16) # Row 2: FOUNDATION, INC.
    ws.set_row(2, 14) # Row 3: Address
    ws.set_row(3, 14) # Row 4: Contacts
    ws.set_row(4, 14) # Row 5: Motto
    ws.set_row(5, 6)  # Row 6: Purple Divider Bar
    ws.set_row(6, 26) # Row 7: Table Headers

    # Populate Letterhead
    ws.merge_range('A1:A5', '', fmt_logo_cell)
    ws.merge_range('B1:F1', 'JOSE MARIA COLLEGE', fmt_institution_title)
    ws.merge_range('B2:F2', 'FOUNDATION, INC.', fmt_foundation)
    ws.merge_range('B3:F3', 'KJC Compound, Phil-Jap Friendship Highway, Sasa, Davao City, Philippines', fmt_address)
    ws.merge_range('B4:F4', 'Portal: www.jmc.edu.ph | communications@jmc.edu.ph | (+639) 994970107', fmt_contact)
    ws.merge_range('B5:F5', 'Assured • Consistent • Quality Education', fmt_motto)

    # Purple Divider Line on Row 6 (A6:F6)
    ws.merge_range('A6:F6', '', fmt_divider)

    # Insert Logo if present
    logo_candidates = [
        os.path.join(os.path.dirname(__file__), '..', 'public', 'images', 'jmc_logo.png'),
        os.path.join(os.path.dirname(__file__), '..', '..', 'frontend-rn', 'assets', 'images', 'jmc_logo.png'),
        os.path.join(os.path.dirname(__file__), '..', '..', 'frontend-rn', 'assets', 'images', 'jmc_logo_sm.png')
    ]
    for logo_path in logo_candidates:
        if os.path.exists(logo_path):
            ws.insert_image('A1', logo_path, {
                'x_offset': 16,
                'y_offset': 4,
                'x_scale': 0.17,
                'y_scale': 0.17,
                'object_position': 1
            })
            break

    # Table Headers on Row 7
    headers = ['first_name', 'last_name', 'email', 'password', 'role', 'department']
    for c_idx, h in enumerate(headers):
        ws.write(6, c_idx, h, fmt_table_header)

    # ── Populate SystemData Sheet & Dynamic Named Ranges ──
    roles = config_data.get("roles", [])
    mappings = config_data.get("mappings", {})

    # Write roles into Column A of SystemData
    role_names = [r["name"] for r in roles] if roles else ["Requestor", "Approver", "Admin"]
    for r_idx, r_name in enumerate(role_names):
        data_ws.write(r_idx, 0, r_name)

    # Named Range for Roles: SystemRoles
    wb.define_name('SystemRoles', f'=SystemData!$A$1:$A${max(1, len(role_names))}')

    # Write Empty cell for roles with 0 departments: Column Z (col index 25)
    data_ws.write(0, 25, '')
    wb.define_name('Empty_List', '=SystemData!$Z$1')

    # Populate department lists for each role in subsequent columns
    for role_idx, r_name in enumerate(role_names):
        col_idx = role_idx + 1 # Col B is 1, Col C is 2, etc.
        col_letter = xl_col_to_name(col_idx)
        
        # In Excel, defined range names cannot contain spaces or special punctuation
        named_range_id = re.sub(r'[^a-zA-Z0-9_]', '_', r_name.strip()).replace(' ', '_')
        
        dept_list = mappings.get(r_name, [])
        if not dept_list:
            # Check by key or case-insensitive name
            for k, v in mappings.items():
                if k.lower() == r_name.lower():
                    dept_list = v
                    break

        if dept_list and len(dept_list) > 0:
            for d_idx, dept_name in enumerate(dept_list):
                data_ws.write(d_idx, col_idx, dept_name)
            wb.define_name(named_range_id, f'=SystemData!${col_letter}$1:${col_letter}${len(dept_list)}')
        else:
            # If no departments exist for this role, point named range to the empty cell
            wb.define_name(named_range_id, '=SystemData!$Z$1')

    # Rows 8 to 60: Empty formatted data rows with dynamic dropdowns
    for r in range(7, 60):
        excel_row_num = r + 1
        ws.set_row(r, 20)
        for c in range(6):
            ws.write_blank(r, c, '', fmt_data_cell)

        # Role Dropdown in Column E (index 4)
        ws.data_validation(r, 4, r, 4, {
            'validate': 'list',
            'source': '=SystemRoles',
            'ignore_blank': True,
            'input_title': 'Select Role',
            'input_message': 'Choose a valid system role (Approver, Requestor, Admin)',
            'error_title': 'Invalid Role',
            'error_message': 'Please select a valid role from the dropdown list.'
        })

        # Dependent Department Dropdown in Column F (index 5)
        # Evaluates =INDIRECT(SUBSTITUTE($E8, " ", "_"))
        ws.data_validation(r, 5, r, 5, {
            'validate': 'list',
            'source': f'=INDIRECT(SUBSTITUTE($E{excel_row_num}, " ", "_"))',
            'ignore_blank': True,
            'input_title': 'Select Department',
            'input_message': 'Select role in Column E first, then choose from role-assigned departments.',
            'error_title': 'Invalid Department',
            'error_message': 'Please select a department that belongs to the selected role.'
        })

    wb.close()
    print(f"Successfully generated dynamic template at: {output_path}")

if __name__ == '__main__':
    target_out = sys.argv[1] if len(sys.argv) > 1 else 'jmcfi_user_accounts_template.xlsx'
    json_input = None

    if len(sys.argv) > 2:
        arg2 = sys.argv[2]
        if os.path.exists(arg2):
            with open(arg2, 'r', encoding='utf-8') as f:
                json_input = json.load(f)
        else:
            try:
                json_input = json.loads(arg2)
            except Exception:
                json_input = None

    generate_template(target_out, json_input)
