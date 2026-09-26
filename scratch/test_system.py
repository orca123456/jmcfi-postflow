import requests
import json
import os
import tempfile
import time

BASE_URL = "https://jmcfi-postflow-production.up.railway.app/api"

def create_dummy_image(name, index=0):
    from PIL import Image, ImageDraw
    temp_dir = tempfile.gettempdir()
    file_path = os.path.join(temp_dir, name)
    
    # Modern brand palette (Teal, Royal Blue, Indigo, Purple, Emerald)
    colors = [
        (13, 148, 136),   # Teal
        (37, 99, 235),    # Royal Blue
        (30, 58, 138),    # Indigo
        (124, 58, 237),   # Purple
        (5, 150, 105)     # Emerald
    ]
    bg_color = colors[index % len(colors)]
    
    img = Image.new("RGB", (400, 400), color=bg_color)
    draw = ImageDraw.Draw(img)
    # Draw simple design accent shapes
    draw.rectangle([20, 20, 380, 380], outline=(255, 255, 255), width=4)
    draw.ellipse([100, 100, 300, 300], fill=(255, 255, 255, 50), outline=(255, 255, 255), width=2)
    
    img.save(file_path, "JPEG")
    return file_path

def login(email, password):
    print(f"Logging in {email}...", flush=True)
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=15)
    print(f"Login status: {resp.status_code}", flush=True)
    if resp.status_code == 200:
        data = resp.json()
        token = data.get("access_token") or data.get("token") or (data.get("data", {}).get("token"))
        user = data.get("user") or data.get("data", {}).get("user") or {}
        return token, user
    else:
        print(f"FAILED LOGIN for {email}: {resp.status_code} {resp.text}", flush=True)
        return None, None

def run_tests():
    print("=== STARTING LIVE SYSTEM TEST SUITE ===", flush=True)
    
    # 1. Admin Login Test
    print("\n--- TEST 1: Admin Login ---", flush=True)
    admin_token, admin_user = login("nyco.paderayon@jmc.edu.ph", "password123")
    if admin_token:
        print(f"SUCCESS: Admin logged in successfully as {admin_user.get('name')} (Role: {admin_user.get('role')})", flush=True)
    else:
        print("FAILED: Admin login failed!", flush=True)

    # 2. Requestor Login
    print("\n--- Requestor Login ---", flush=True)
    req_token, req_user = login("april.domopoy@jmc.edu.ph", "password123")
    if not req_token:
        print("CRITICAL: Requestor login failed. Aborting remaining tests.", flush=True)
        return

    headers = {"Authorization": f"Bearer {req_token}", "Accept": "application/json"}

    # Generate 5 test images with professional color palettes
    img_paths = [create_dummy_image(f"test_img_{i}.jpg", index=i) for i in range(5)]

    # 3. Photo Upload Tests: 1 to 5 Photos with ALL 3 Platforms (FB, IG, Portal/Website)
    all_platforms = ["facebook", "instagram", "portal"]
    print("\n--- TEST 2: Multi-Photo Uploads (1 to 5 photos) with 3 Platforms ---", flush=True)

    for count in range(1, 6):
        time.sleep(2) # Avoid hitting rapid submission lock
        print(f"\nSubmitting request with {count} photo(s) and 3 platforms...", flush=True)
        files = []
        opened_files = []
        for i in range(count):
            f = open(img_paths[i], "rb")
            opened_files.append(f)
            files.append(("media[]", (f"photo_{i+1}.jpg", f, "image/jpeg")))

        data = [
            ("title", f"Test Post - {count} Image(s) - 3 Platforms"),
            ("caption_narrative", f"Automated test caption narrative for {count} image upload with FB, IG, Portal."),
            ("is_draft", "0")
        ]
        for p in all_platforms:
            data.append(("target_platforms[]", p))

        try:
            res = requests.post(f"{BASE_URL}/posts", headers=headers, data=data, files=files, timeout=30)
            if res.status_code in [200, 201]:
                res_json = res.json()
                post_data = res_json.get("data") or res_json.get("post") or res_json
                media_list = post_data.get("media", [])
                print(f"SUCCESS ({count} photos): Post ID {post_data.get('id')} created. Status: {post_data.get('status')}. Uploaded Media Count: {len(media_list)}", flush=True)
                if len(media_list) > 0:
                    first_m = media_list[0]
                    m_url = first_m.get('file_path') or first_m.get('file_url') or first_m.get('url')
                    print(f"   Sample Media URL: {m_url}", flush=True)
            else:
                print(f"FAILED ({count} photos): HTTP {res.status_code} - {res.text}", flush=True)
        except Exception as e:
            print(f"EXCEPTION sending post: {e}", flush=True)
        finally:
            for f in opened_files:
                f.close()

    # 4. Single Platform Tests (FB only, IG only, Portal only)
    print("\n--- TEST 3: Single Platform Selections ---", flush=True)
    single_platforms = ["facebook", "instagram", "portal"]

    for plat_name in single_platforms:
        time.sleep(2)
        print(f"\nSubmitting request with 1 photo for SINGLE platform: {plat_name}...", flush=True)
        with open(img_paths[0], "rb") as f:
            files = [("media[]", ("single_photo.jpg", f, "image/jpeg"))]
            data = [
                ("title", f"Test Post - Single Platform ({plat_name})"),
                ("caption_narrative", f"Automated test caption for single platform {plat_name}."),
                ("target_platforms[]", plat_name),
                ("is_draft", "0")
            ]
            try:
                res = requests.post(f"{BASE_URL}/posts", headers=headers, data=data, files=files, timeout=30)
                if res.status_code in [200, 201]:
                    res_json = res.json()
                    post_data = res_json.get("data") or res_json.get("post") or res_json
                    print(f"SUCCESS ({plat_name}): Post ID {post_data.get('id')} created. Platforms: {post_data.get('target_platforms')}", flush=True)
                else:
                    print(f"FAILED ({plat_name}): HTTP {res.status_code} - {res.text}", flush=True)
            except Exception as e:
                print(f"EXCEPTION sending single platform post: {e}", flush=True)

    # 5. End-to-End Approval Lifecycle Test
    print("\n--- TEST 4: End-to-End Approval Workflow (Requestor -> Office Head -> VP -> IMC QA -> Admin) ---", flush=True)
    time.sleep(2)
    
    # Step 5a: Submit Request by Requestor
    print("1. Requestor submitting new request for E2E flow...", flush=True)
    with open(img_paths[0], "rb") as f:
        files = [("media[]", ("e2e_photo.jpg", f, "image/jpeg"))]
        data = [
            ("title", "E2E Workflow Test Post"),
            ("caption_narrative", "Testing full multi-level approval pipeline."),
            ("is_draft", "0")
        ]
        for p in all_platforms:
            data.append(("target_platforms[]", p))

        res = requests.post(f"{BASE_URL}/posts", headers=headers, data=data, files=files, timeout=30)
        if res.status_code not in [200, 201]:
            print(f"FAILED E2E initial request: HTTP {res.status_code} - {res.text}", flush=True)
            return
        post_data = res.json().get("data") or res.json().get("post") or res.json()
        post_id = post_data["id"]
        print(f"Request created with Post ID: {post_id}. Status: {post_data.get('status')}", flush=True)

    # Helper function for approval step
    def approve_step(role_name, email, password):
        print(f"\nApproving as {role_name} ({email})...", flush=True)
        token, user = login(email, password)
        if not token:
            print(f"FAILED login for {role_name}", flush=True)
            return False
        h = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        app_res = requests.post(f"{BASE_URL}/posts/{post_id}/approve", headers=h, json={"action": "approve", "notes": f"Approved by {role_name}"}, timeout=30)
        if app_res.status_code == 200:
            updated_post = app_res.json().get("data") or app_res.json().get("post") or app_res.json()
            print(f"SUCCESS: {role_name} approved. New Post Status: {updated_post.get('status')}", flush=True)
            return True
        else:
            print(f"FAILED: {role_name} approval failed - HTTP {app_res.status_code}: {app_res.text}", flush=True)
            return False

    # Step 5b: Office Head Approval
    approve_step("Office Head", "kyra.horie@jmc.edu.ph", "password123")

    # Step 5c: Vice President Approval
    approve_step("Vice President", "dr@jmc.edu.ph", "password123")

    # Step 5d: IMC QA Approval
    approve_step("IMC QA", "ryan@jmc.edu.ph", "password123")

    # Step 5e: Admin Check / Final Verification
    print("\nFinal verification as Admin...", flush=True)
    admin_headers = {"Authorization": f"Bearer {admin_token}", "Accept": "application/json"}
    final_res = requests.get(f"{BASE_URL}/posts/{post_id}", headers=admin_headers, timeout=30)
    if final_res.status_code == 200:
        final_post = final_res.json().get("data") or final_res.json().get("post") or final_res.json()
        media = final_post.get("media", [])
        print(f"\n=== FINAL POST VERIFICATION (Post ID {post_id}) ===", flush=True)
        print(f"Title: {final_post.get('title')}", flush=True)
        print(f"Status: {final_post.get('status')}", flush=True)
        print(f"Platforms: {final_post.get('target_platforms')}", flush=True)
        print(f"Media Count: {len(media)}", flush=True)
        for idx, m in enumerate(media):
            m_url = m.get('file_path') or m.get('file_url') or m.get('url')
            print(f"  Media #{idx+1} URL: {m_url}", flush=True)
    else:
        print(f"FAILED to fetch post details as Admin: {final_res.status_code} - {final_res.text}", flush=True)

    print("\n=== LIVE SYSTEM TEST SUITE COMPLETED ===", flush=True)

if __name__ == "__main__":
    run_tests()
