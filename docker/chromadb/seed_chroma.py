import os
import sys
import time

import requests


BASE_URL = os.getenv("CHROMA_BASE_URL", "http://localhost:8000/api/v2").rstrip("/")
TENANT = os.getenv("CHROMA_TENANT", "default_tenant")
DATABASE = os.getenv("CHROMA_DATABASE", "default_database")
COLLECTION_NAME = os.getenv("TEST_COLLECTION", "test_table")


def wait_for_chroma(max_attempts: int = 40, sleep_seconds: float = 1.5) -> None:
    heartbeat_url = f"{BASE_URL}/heartbeat"
    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.get(heartbeat_url, timeout=5)
            if response.ok:
                print("ChromaDB heartbeat is healthy.")
                return
        except requests.RequestException:
            pass
        print(f"Waiting for ChromaDB... attempt {attempt}/{max_attempts}")
        time.sleep(sleep_seconds)
    raise RuntimeError("ChromaDB did not become healthy in time.")


def seed() -> None:
    base_db_url = f"{BASE_URL}/tenants/{TENANT}/databases/{DATABASE}"
    headers = {"Content-Type": "application/json"}

    create_collection_payload = {
        "name": COLLECTION_NAME,
        "metadata": {"purpose": "local-testing"},
        "get_or_create": True,
    }
    response = requests.post(
        f"{base_db_url}/collections",
        json=create_collection_payload,
        headers=headers,
        timeout=15,
    )
    response.raise_for_status()
    collection = response.json()
    collection_id = collection["id"]
    print(f"Collection ready: {COLLECTION_NAME} ({collection_id})")

    upsert_payload = {
        "ids": ["row-1", "row-2", "row-3"],
        "documents": [
            "First test record",
            "Second test record",
            "Third test record",
        ],
        "metadatas": [
            {"source": "docker-seed", "rank": 1},
            {"source": "docker-seed", "rank": 2},
            {"source": "docker-seed", "rank": 3},
        ],
        "embeddings": [
            [0.11, 0.22, 0.33],
            [0.21, 0.42, 0.63],
            [0.31, 0.62, 0.93],
        ],
    }
    response = requests.post(
        f"{base_db_url}/collections/{collection_id}/upsert",
        json=upsert_payload,
        headers=headers,
        timeout=15,
    )
    response.raise_for_status()
    print("Seeded sample rows into test collection.")


if __name__ == "__main__":
    try:
        wait_for_chroma()
        seed()
    except Exception as error:  # pragma: no cover
        print(f"Seeding failed: {error}", file=sys.stderr)
        sys.exit(1)
