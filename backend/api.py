from fastapi import FastAPI
import subprocess
import requests
import sys
import json
from pathlib import Path

CONFIG_PATH = Path("assets/config.json")

def load_config():
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    return {}

def save_config(config):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

app = FastAPI()
@app.get("/status")
async def root():
    return {"message": "We are alive!"}

@app.get("/search/{query}")
def search(query: str):
    # maybe open up other search params
    response = requests.get(f"https://www.songsterr.com/api/search?pattern={query}&inst=undefined&tuning=undefined&difficulty=undefined&size=50&from=0&more=true").json()
    return response

@app.get("/videos/{song_id}")
def get_videos(song_id: int):

    meta = requests.get(f"https://www.songsterr.com/api/meta/{song_id}").json()
    revision = meta.get("revisionId")
    video_points = requests.get(f"https://www.songsterr.com/api/video-points/{song_id}/{revision}/list").json()

    videos = []
    for index, video_point in enumerate(video_points):
        feature = video_point.get("feature")
        feature = feature if feature else "main"

        tracks = video_point.get("tracks")
        tracks = tracks if tracks else "All"

        url = f"https://youtu.be/{video_point.get('videoId')}"

        if tracks[0] == 0: # Discard tracks with no instruments
            #print(f"Discarding {feature} - {tracks} - {url}. Missing instruments.")
            continue

        videos.append([feature, tracks, url, index])

        print(f"{feature} {tracks} {url}")

    best = {}
    for video in videos:
        feature = video[0]
        tracks = video[1]
        url = video[2]
        index = video[3]

        candidate = {"feature": feature, "tracks": tracks, "url": url, "index": index}

        if feature not in best:
            best[feature] = candidate
            continue

        current_tracks = best[feature]
        if tracks == "All" and current_tracks!= "All":
            best[feature] = candidate

        elif current_tracks!="All" and len(tracks) > len(current_tracks):
            best[feature] = candidate


    return {"output": list(best.values())}

@app.post("/download/{song_id}/{index}")
def download(song_id: int, index: int):
    config = load_config()
    cookies = config.get("cookies", None)
    path = config.get("path", None)


    subprocess.run([sys.executable, "sync.py", "--song", str(song_id) , "--video-index", str(index), "--output-dir", "/downloads"], check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    return {"message": "Download started"}

@app.post("/set-browser/{browser}")
def set_browser(browser: str):
    if browser not in ["chrome", "firefox", "safari", "edge", "brave", "opera", "vivaldi"]:
        return {"message": "Invalid browser"}

    try:
        config = load_config()
        config["browser"] = browser
        save_config(config)
        return {"message": "Browser saved"}
    except Exception as e:
        return {"message": f"Error saving browser: {e}"}

@app.post("/set-path/{path}")
def set_path(path: str):
    try:
        config = load_config()
        config["path"] = path
        save_config(config)
        return {"message": "Path saved"}
    except Exception as e:
        return {"message": f"Error saving path: {e}"}


