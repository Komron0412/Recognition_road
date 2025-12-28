# Real-Time Traffic Violation Detection System

An AI-powered system for detecting traffic violations in real-time using Computer Vision (YOLOv8, OpenCV, Face Recognition).

## Features
- **Real-time Detection**: Identifies Person, Car, Bike, Bus, Truck.
- **Traffic Light Analysis**: Visually detects Red/Green light state using HSV color analysis.
- **Violation Logic**: Flags objects remaining in the "Road Zone" for > 5 seconds during a Red light.
- **Evidence Recording**: Automatically records and saves video clips of violations.
- **Face Recognition**: Identifies known violators if their face is visible.
- **Dashboard**: View violation history and play back evidence videos.
- **Dynamic Settings**: Adjust Road Zone and Traffic Light ROI via the UI.

## Tech Stack
- **Backend**: Django, Django Channels (WebSocket), Daphne, PostgreSQL.
- **AI/CV**: YOLOv8, OpenCV, face_recognition, numpy.
- **Frontend**: React, Vite, WebSocket.
- **Infrastructure**: Docker, Docker Compose.

## 🚀 Quick Start (Docker)

The easiest way to run the project is using Docker.

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Komron0412/Recognition_road.git
    cd Recognition_road
    ```

2.  **Run with Docker Compose**:
    ```bash
    docker-compose up --build
    ```

3.  **Access the App**:
    - Frontend: `http://localhost:5173`
    - Backend API: `http://localhost:8000`

---

## 🛠 Manual Installation

### Backend
1.  Navigate to `backend/`:
    ```bash
    cd backend
    ```
2.  Create virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
    *Note: On Apple Silicon (M1/M2), you might need `cmake` installed via brew for `dlib`.*

4.  Set up environment (`.env`):
    Create a `.env` file in `backend/` consistent with your database credentials.

5.  Run Migrations:
    ```bash
    python manage.py migrate
    ```

6.  Run Server:
    ```bash
    daphne -p 8000 core.asgi:application
    ```

### Frontend
1.  Navigate to `frontend/`:
    ```bash
    cd frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Run Dev Server:
    ```bash
    npm run dev
    ```

## Usage
1.  **Go to Settings**: Adjust the "Traffic Light ROI" box to cover the traffic light in your camera view.
2.  **Define Road Zone**: Use the slider to set the boundary line for the road.
3.  **Monitor**: Switch to "Live Camera". The system will now track objects.
    - If the light is **RED** and an object crosses the line for **> 5 seconds**, a violation is recorded.
4.  **Dashboard**: Check the Dashboard tab to see the list of violations and watch recorded videos.

## License
MIT
