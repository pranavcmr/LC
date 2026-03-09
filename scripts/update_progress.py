import requests
import json
import datetime
import os
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# --- CONFIGURATION ---
FRIENDS = ["Pranav_MP","khizer12","khrshtt","theLumberJack79"] 
# ^^^ REPLACE THESE with real LeetCode handles!

JSON_FILE = "frontend/public/stats.json"
LEETCODE_URL = "https://leetcode.com/graphql"
REQUEST_HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com/",
    "Origin": "https://leetcode.com",
    "User-Agent": "Mozilla/5.0 (compatible; LC-Stats-Bot/1.0)",
}


def build_session():
    session = requests.Session()
    retries = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["POST"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retries)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def extract_counts(ac_submission_num):
    counts = {'All': 0, 'Easy': 0, 'Medium': 0, 'Hard': 0}
    for item in ac_submission_num or []:
        difficulty = item.get('difficulty')
        if difficulty in counts:
            counts[difficulty] = item.get('count', 0)

    return {
        'count': counts['All'],
        'easy': counts['Easy'],
        'medium': counts['Medium'],
        'hard': counts['Hard'],
    }

def get_solved_stats(username):
    query = """
    query userProblemsSolved($username: String!) {
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
    """
    try:
        session = build_session()
        response = session.post(
            LEETCODE_URL,
            json={"query": query, "variables": {"username": username}},
            headers=REQUEST_HEADERS,
            timeout=20,
        )
        if response.status_code != 200:
            print(f"Error fetching {username}: HTTP {response.status_code}")
            return None

        data = response.json()
        if 'errors' in data:
            print(f"Error fetching {username}: {data['errors']}")
            return None

        matched_user = (data.get('data') or {}).get('matchedUser')
        if not matched_user:
            print(f"Error fetching {username}: matchedUser was null. Check username spelling/case.")
            return None

        stats = (
            ((matched_user.get('submitStatsGlobal') or {}).get('acSubmissionNum'))
            or ((matched_user.get('submitStats') or {}).get('acSubmissionNum'))
            or []
        )
        return extract_counts(stats)
    except Exception as e:
        print(f"Failed to fetch {username}: {e}")
        return None


def normalize_history(history):
    normalized = False
    for user, entries in history.items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            if 'date' not in entry:
                entry['date'] = datetime.datetime.utcnow().strftime('%Y-%m-%d')
                normalized = True
            if 'timestamp' not in entry:
                entry['timestamp'] = f"{entry['date']}T00:00:00Z"
                normalized = True
            if 'count' not in entry:
                entry['count'] = 0
                normalized = True
            for field in ('easy', 'medium', 'hard'):
                if field not in entry:
                    entry[field] = 0
                    normalized = True
    return normalized

def main():
    # 1. Load existing data
    if os.path.exists(JSON_FILE):
        with open(JSON_FILE, 'r') as f:
            try:
                history = json.load(f)
            except json.JSONDecodeError:
                history = {}
    else:
        history = {}

    updated = normalize_history(history)

    now_utc = datetime.datetime.utcnow().replace(microsecond=0)
    today = now_utc.strftime('%Y-%m-%d')
    current_timestamp = f"{now_utc.isoformat()}Z"
    print(f"--- Running Update for {today} @ {current_timestamp} ---")

    # 2. Fetch new data
    for user in FRIENDS:
        solved = get_solved_stats(user)
        
        if solved is not None:
            if user not in history:
                history[user] = []
            
            last_entry = history[user][-1] if history[user] else None

            has_changed = (
                not last_entry
                or last_entry.get('count') != solved['count']
                or last_entry.get('easy') != solved['easy']
                or last_entry.get('medium') != solved['medium']
                or last_entry.get('hard') != solved['hard']
            )

            if has_changed:
                history[user].append({
                    "date": today,
                    "timestamp": current_timestamp,
                    "count": solved['count'],
                    "easy": solved['easy'],
                    "medium": solved['medium'],
                    "hard": solved['hard'],
                })
                updated = True
                print(f"Added {user}: {solved['count']}")

    # 3. Save
    if updated:
        with open(JSON_FILE, 'w') as f:
            json.dump(history, f, indent=2)
        print("Successfully saved stats.json")
    else:
        print("No changes detected.")

if __name__ == "__main__":
    main()
