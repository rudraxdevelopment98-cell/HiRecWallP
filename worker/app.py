"""
HirecWallp — forensic watermark worker (Phase 2).

A small FastAPI service that embeds an *invisible* per-buyer watermark
(DWT-DCT via invisible-watermark) encoding the order id, plus best-effort XMP
metadata (licence + order reference), and can decode a leaked file back to its
order id. Deployed separately (Railway / Fly / Cloud Run) and called by the
Next.js app with a shared secret.

Endpoints:
  POST /embed   (multipart: file, payload=<32 hex chars>, licence, order_ref)
  POST /decode  (multipart: file)   -> { "order_hex": "...", "order_id": "..." }
  GET  /health

Auth: every request must carry  x-worker-secret: $WATERMARK_WORKER_SECRET
"""

from __future__ import annotations

import io
import os

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from imwatermark import WatermarkDecoder, WatermarkEncoder
from PIL import Image

PAYLOAD_BYTES = 16  # a UUID without dashes = 32 hex chars = 16 bytes = 128 bits
PAYLOAD_BITS = PAYLOAD_BYTES * 8

app = FastAPI(title="HirecWallp Watermark Worker", version="1.0.0")


def _check_secret(provided: str | None) -> None:
    expected = os.environ.get("WATERMARK_WORKER_SECRET")
    if not expected or provided != expected:
        raise HTTPException(status_code=401, detail="unauthorized")


def _read_image(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="invalid image")
    return img


def _xmp_packet(licence: str, order_ref: str) -> bytes:
    return (
        '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/">'
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        '<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:hw="https://hirecwallp.com/ns#" '
        f'hw:licence="{licence}" hw:order="{order_ref}" '
        'dc:rights="Licensed via HirecWallp. Resale/redistribution prohibited."/>'
        "</rdf:RDF></x:xmpmeta>"
        '<?xpacket end="w"?>'
    ).encode("utf-8")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/embed")
async def embed(
    file: UploadFile = File(...),
    payload: str = Form(...),
    licence: str = Form("personal"),
    order_ref: str = Form(""),
    x_worker_secret: str | None = Header(default=None),
) -> Response:
    _check_secret(x_worker_secret)

    payload = payload.strip().lower().replace("-", "")
    if len(payload) != PAYLOAD_BYTES * 2:
        raise HTTPException(status_code=400, detail=f"payload must be {PAYLOAD_BYTES * 2} hex chars")
    try:
        payload_bytes = bytes.fromhex(payload)
    except ValueError as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="payload must be hex") from exc

    img = _read_image(await file.read())

    encoder = WatermarkEncoder()
    encoder.set_watermark("bytes", payload_bytes)
    watermarked = encoder.encode(img, "dwtDct")

    ok, buf = cv2.imencode(".jpg", watermarked, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not ok:
        raise HTTPException(status_code=500, detail="encode failed")

    # Best-effort XMP metadata via Pillow (ignored if the build lacks support).
    out = buf.tobytes()
    try:
        pil = Image.open(io.BytesIO(out))
        rebuf = io.BytesIO()
        pil.save(rebuf, format="JPEG", quality=95, xmp=_xmp_packet(licence, order_ref))
        out = rebuf.getvalue()
    except Exception:  # noqa: BLE001
        pass

    return Response(content=out, media_type="image/jpeg")


@app.post("/decode")
async def decode(
    file: UploadFile = File(...),
    x_worker_secret: str | None = Header(default=None),
) -> JSONResponse:
    _check_secret(x_worker_secret)

    img = _read_image(await file.read())
    decoder = WatermarkDecoder("bytes", PAYLOAD_BITS)
    recovered = decoder.decode(img, "dwtDct")
    order_hex = recovered.hex()

    order_id = None
    if len(order_hex) == 32:
        order_id = f"{order_hex[0:8]}-{order_hex[8:12]}-{order_hex[12:16]}-{order_hex[16:20]}-{order_hex[20:32]}"

    return JSONResponse({"order_hex": order_hex, "order_id": order_id})
