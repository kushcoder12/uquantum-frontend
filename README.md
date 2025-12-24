## How can I edit this code?

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Activate Backend
cd /home/kush/Desktop/uniq-quantum-hub-main/backend
pip install pydantic-settings
uvicorn app:app --reload --host 0.0.0.0 --port 8000

# Step 4: Check on new terminal is it up and running
curl -X POST http://localhost:8000/llm/chat -H "Content-Type: application/json" -d '{"prompt":"hello","model":"llama-3.1-8b-instant"}'

# Step 5: On New Terminal Install the necessary dependencies.
npm i

# Step 6: Start the development server with auto-reloading and an instant preview.
npm run dev
```

