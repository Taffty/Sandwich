# Redis click verification

The project now includes a Node.js API in `server/`. The browser sends each manual click to `/api/click`; the API uses Redis to limit each user to 15 accepted clicks per second. In production, the API verifies the Firebase ID token and calculates the reward from trusted Firestore data.

## Quick local test

You need Docker Desktop or Docker Engine installed.

From the project root, run:

```bash
TEST_MODE=true docker compose -f docker-compose.redis.yml up --build
```

In a second terminal, check the health endpoint:

```bash
curl http://localhost:3000/health
```

You should see Redis reported as connected.

Test one accepted click:

```bash
curl -i -X POST http://localhost:3000/api/click \
  -H "Content-Type: application/json" \
  -H "x-test-user: justin" \
  -d '{"requestId":"test-1"}'
```

Send the same request again. It should return HTTP `409` because the request ID was already processed.

To test the rate limit, send more than 15 unique requests during one second. The later requests should return HTTP `429`:

```bash
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/click \
    -H "Content-Type: application/json" \
    -H "x-test-user: justin" \
    -d "{\"requestId\":\"burst-$i\"}"
done
```

The `x-test-user` header and `TEST_MODE=true` are only for local testing. Do not use them in production.

## Connecting the browser

The frontend currently points to `http://localhost:3000` in `public/script.js`. Serve `public/` with Live Server, then click the sandwich. The browser should call the API instead of adding the reward locally.

For an EC2 deployment, change `CLICK_API_URL` to your HTTPS API address, or reverse-proxy the API through the same domain and set it to an empty string.

## Production Firebase setup

Run the API with `TEST_MODE=false`. The server then requires Firebase Admin credentials, verifies the Firebase ID token, and writes the approved balance to Firestore. On EC2, provide a least-privilege Firebase service-account credential through a protected secret or environment configuration; never place the service-account JSON in `public/` or commit it to Git.

The current client still contains older direct Firestore save paths for upgrades, rebirths, and offline income. For complete anti-cheat protection, those actions should also be moved behind server endpoints before treating the game as secure.
