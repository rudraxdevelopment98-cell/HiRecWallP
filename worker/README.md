# Forensic watermark worker

Separately-deployed Python service that embeds an invisible, per-buyer
watermark (DWT-DCT) encoding the **order id** plus best-effort XMP metadata,
and decodes a leaked file back to its order id. The Next.js app calls it on the
first paid download of each variant (result cached per entitlement).

## Run locally

```bash
cd worker
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export WATERMARK_WORKER_SECRET="dev-secret"
uvicorn app:app --reload --port 8080
```

## Endpoints

- `GET /health`
- `POST /embed` — multipart `file`, `payload` (32 hex chars = UUID w/o dashes),
  `licence`, `order_ref`; returns the watermarked JPEG.
- `POST /decode` — multipart `file`; returns `{ order_hex, order_id }`.

All non-health requests require header `x-worker-secret: $WATERMARK_WORKER_SECRET`.

## Deploy

Build the Docker image and deploy to Railway / Fly.io / Cloud Run. Set
`WATERMARK_WORKER_SECRET` there, and in the Next.js app set:

```
WATERMARK_WORKER_URL=https://<your-worker-host>
WATERMARK_WORKER_SECRET=<same secret>
```

## Verify the acceptance criterion

"A leaked test file can be decoded back to its order_id":

```bash
# embed order id 11111111-2222-3333-4444-555555555555 into sample.jpg
curl -s -H "x-worker-secret: $WATERMARK_WORKER_SECRET" \
  -F file=@sample.jpg -F payload=11111111222233334444555555555555 \
  -F licence=personal -F order_ref=order_123 \
  http://localhost:8080/embed -o marked.jpg

# decode it back
curl -s -H "x-worker-secret: $WATERMARK_WORKER_SECRET" \
  -F file=@marked.jpg http://localhost:8080/decode
# -> {"order_hex":"11111111222233334444555555555555","order_id":"11111111-2222-3333-4444-555555555555"}
```
