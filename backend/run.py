"""Start the Starlette API on port 8888."""

import uvicorn


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8888)
