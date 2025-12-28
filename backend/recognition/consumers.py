import json
import base64
import numpy as np
import cv2
import face_recognition
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from pathlib import Path
import os
import glob
import time
from ultralytics import YOLO

class FaceRecognitionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        self.known_face_encodings = []
        self.known_face_names = []
        self.load_known_faces()
        
        # Load YOLO Model
        print("Loading YOLOv8 model...")
        self.model = YOLO('yolov8n.pt') 
        print("YOLOv8 model loaded.")

        # Traffic Simulation State
        self.light_state = "GREEN" # RED or GREEN
        self.road_zone = None 
        
        # Tracking violations: { track_id: { 'start_time': float, 'class': str, 'frames': [], 'recorded': bool, 'name': str } }
        self.violation_tracker = {}
        
        # Load Settings
        await self.update_settings()
        self.frame_count = 0

    @database_sync_to_async
    def update_settings(self):
        from .models import GlobalSettings
        settings = GlobalSettings.load()
        self.settings = {
            'road_zone_x_percent': settings.road_zone_x_percent,
            'roi_x': settings.roi_x,
            'roi_y': settings.roi_y,
            'roi_w': settings.roi_w,
            'roi_h': settings.roi_h,
        }
        # print(f"Settings Updated: {self.settings}")

    def load_known_faces(self):
        base_dir = Path(__file__).resolve().parent.parent / "known_faces"
        if not base_dir.exists():
            base_dir.mkdir(parents=True, exist_ok=True)

        print(f"Loading faces from {base_dir}")
        for image_path in glob.glob(str(base_dir / "*")):
            try:
                dirname, filename = os.path.split(image_path)
                name = os.path.splitext(filename)[0]
                face_image = face_recognition.load_image_file(image_path)
                encodings = face_recognition.face_encodings(face_image)
                if encodings:
                    self.known_face_encodings.append(encodings[0])
                    self.known_face_names.append(name)
                    print(f"Loaded: {name}")
            except Exception as e:
                print(f"Error loading {image_path}: {e}")

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        self.frame_count += 1
        if self.frame_count % 30 == 0:
             await self.update_settings()

        data = json.loads(text_data)
        if 'image' not in data:
            return

        # Decode base64 image
        image_data = base64.b64decode(data['image'])
        np_arr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return
            
        height, width, _ = frame.shape
        road_x_start = int(width * self.settings['road_zone_x_percent'])
        self.road_zone = [0, width, height, road_x_start]

        # --- Traffic Light (HSV) ---
        # Dynamic ROI from settings
        rx = self.settings.get('roi_x', 0)
        ry = self.settings.get('roi_y', 0)
        rw = self.settings.get('roi_w', 100)
        rh = self.settings.get('roi_h', 100)
        
        # Ensure ROI is within frame
        rx = max(0, min(rx, width-1))
        ry = max(0, min(ry, height-1))
        rw = max(1, min(rw, width - rx))
        rh = max(1, min(rh, height - ry))

        roi = frame[ry:ry+rh, rx:rx+rw]
        
        # Detect Red/Green in ROI
        hsv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        
        # Green Range
        opt_green_lower = np.array([40, 40, 40])
        opt_green_upper = np.array([80, 255, 255])
        
        # Red Range (two bands)
        opt_red_lower1 = np.array([0, 50, 50])
        opt_red_upper1 = np.array([10, 255, 255])
        opt_red_lower2 = np.array([170, 50, 50])
        opt_red_upper2 = np.array([180, 255, 255])
        
        mask_green = cv2.inRange(hsv_roi, opt_green_lower, opt_green_upper)
        mask_red1 = cv2.inRange(hsv_roi, opt_red_lower1, opt_red_upper1)
        mask_red2 = cv2.inRange(hsv_roi, opt_red_lower2, opt_red_upper2)
        mask_red = cv2.bitwise_or(mask_red1, mask_red2)
        
        green_pixels = cv2.countNonZero(mask_green)
        red_pixels = cv2.countNonZero(mask_red)
        
        if red_pixels > green_pixels and red_pixels > 50:
             self.light_state = "RED"
        elif green_pixels > red_pixels and green_pixels > 50:
             self.light_state = "GREEN"
        # Else keep previous state (simple hysteresis)
        # --- YOLO Object Tracking ---
        # Classes: 0=Person, 1=Bicycle, 2=Car, 3=Motorcycle, 5=Bus, 7=Truck
        target_classes = [0, 1, 2, 3, 5, 7]
        class_names = {0: 'Person', 1: 'Bicycle', 2: 'Car', 3: 'Motorcycle', 5: 'Bus', 7: 'Truck'}
        
        results = self.model.track(frame, persist=True, verbose=False, classes=target_classes)
        
        detected_objects = []
        violations = []
        current_violation_ids = set()

        if results and results[0].boxes and results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
            ids = results[0].boxes.id.cpu().numpy().astype(int)
            clss = results[0].boxes.cls.cpu().numpy().astype(int)
            
            for box, track_id, cls_id in zip(boxes, ids, clss):
                x1, y1, x2, y2 = box
                center_x = (x1 + x2) / 2
                class_name = class_names.get(cls_id, 'Unknown')
                display_name = f"{class_name} #{track_id}"
                
                # Check for Face Identity (Only if Person)
                final_box = [int(y1), int(x2), int(y2), int(x1)] # Default to YOLO Body Box
                
                if cls_id == 0:
                    # Run face recognition on the crop
                    face_name = "Unknown"
                    face_crop = frame[y1:y2, x1:x2]
                    
                    if face_crop.size > 0:
                        # Resize for speed? Or just run on crop
                        rgb_detect = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
                        f_encs = []
                        try:
                             f_locs = face_recognition.face_locations(rgb_detect)
                             f_encs = face_recognition.face_encodings(rgb_detect, f_locs)
                        except Exception as e:
                             print(f"Face Rec Error: {e}")

                        if f_encs:
                            # We found a face!
                            top_f, right_f, bottom_f, left_f = f_locs[0]
                            # Convert face coords (local to crop) to global frame coords
                            final_box = [y1 + top_f, x1 + right_f, y1 + bottom_f, x1 + left_f]
                            
                            matches = face_recognition.compare_faces(self.known_face_encodings, f_encs[0])
                            if True in matches:
                                first_match = matches.index(True)
                                face_name = self.known_face_names[first_match]
                                print(f"MATCH: {face_name}")
                        else:
                             # Fallback: if we can't find a face in the box, maybe just show body box?
                             # Or maybe the box is just the back of the head.
                             pass

                    if face_name != "Unknown":
                        display_name = f"{face_name}"
                    
                    # Store name in tracker so we remember it
                    if track_id in self.violation_tracker:
                        if self.violation_tracker[track_id]['name'] == 'Unknown' and face_name != 'Unknown':
                             self.violation_tracker[track_id]['name'] = face_name
                             print(f"Updated Track {track_id} to {face_name}")
                    
                    if track_id in self.violation_tracker and face_name == 'Unknown':
                         # Keep previous name if we lose face for a frame but still track person
                         face_name = self.violation_tracker[track_id]['name']
                         if face_name != "Unknown":
                             display_name = face_name

                # Check Zone
                is_in_road = center_x > road_x_start
                is_violation = False

                if is_in_road and self.light_state == "RED":
                    current_violation_ids.add(track_id)
                    
                    if track_id not in self.violation_tracker:
                        self.violation_tracker[track_id] = {
                            'start_time': time.time(),
                            'class': class_name,
                            'name': face_name,
                            'frames': [],
                            'recorded': False
                        }
                    
                    tracker = self.violation_tracker[track_id]
                    # Update name if we just found it
                    if tracker['name'] == 'Unknown' and face_name != 'Unknown':
                        tracker['name'] = face_name
                        
                    tracker['frames'].append(frame)
                    duration = time.time() - tracker['start_time']
                    
                    # 5 Second Rule
                    if duration > 5:
                        is_violation = True
                        violator_label = tracker['name'] if tracker['class'] == 'Person' and tracker['name'] != "Unknown" else f"{tracker['class']} #{track_id}"
                        violations.append(f"{violator_label} ({int(duration)}s)")
                        
                        if not tracker['recorded']:
                            tracker['recorded'] = True
                            timestamp = time.strftime("%Y%m%d-%H%M%S")
                            filename = f"violations/{timestamp}_{violator_label.replace(' ', '_')}.mp4"
                            filepath = Path(__file__).resolve().parent.parent / filename
                            
                            fourcc = cv2.VideoWriter_fourcc(*'avc1')
                            out = cv2.VideoWriter(str(filepath), fourcc, 5.0, (width, height))
                            for f in tracker['frames']:
                                out.write(f)
                            out.release()
                            print(f"Violation Video Saved: {filepath}")
                            
                            # Save to Database
                            await self.save_violation_to_db(
                                name=tracker['name'] if tracker['name'] != "Unknown" else tracker['class'],
                                v_type=tracker['class'],
                                video_path=filename
                            )



                detected_objects.append({
                    'name': display_name,
                    'box': [int(b) for b in final_box], # Ensure int
                    'is_violation': is_violation
                })
        
        # Cleanup Tracker
        if self.light_state == "GREEN":
            self.violation_tracker.clear()
        else:
            for tid in list(self.violation_tracker.keys()):
                if tid not in current_violation_ids:
                    del self.violation_tracker[tid]

        await self.send(text_data=json.dumps({
            'faces': detected_objects, # Frontend expects 'faces', we send objects
            'traffic_light': self.light_state,
            'road_zone_x': int(road_x_start), # Ensure int
            'roi': {'x': rx, 'y': ry, 'w': rw, 'h': rh}, # Send used ROI
            'violations': violations
        }))

    @database_sync_to_async
    def save_violation_to_db(self, name, v_type, video_path):
        from .models import Violation
        Violation.objects.create(
            violator_name=name,
            violation_type=v_type,
            video_file=video_path
        )
        print(f"DB Record created for {name}")
