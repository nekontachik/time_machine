# Kling API test commands
## 1. Mock test (no API key needed)
curl -X POST http://localhost:3000/api/video/create \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://placehold.co/1280x720","prompt":"Camera slowly pulls back revealing transformed cityscape"}'
## 2. Poll for result (replace TASK_ID)
curl "http://localhost:3000/api/video/status?taskId=TASK_ID"
(run 3 times — 3rd call returns completed + videoUrl)
## 3. Real API test (after adding KLING_API_KEY to .env.local)
curl -X POST http://localhost:3000/api/video/create \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://placehold.co/1280x720","prompt":"Camera slowly pulls back, dramatic storm clouds, cinematic"}'
