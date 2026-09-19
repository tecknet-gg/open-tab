from fastapi import FastAPI
import subprocess
import requests

app = FastAPI()
@app.get("/")
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

        url = f"https://youtu.be/{video_point.get("videoId")}"

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
