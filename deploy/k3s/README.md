# Manifest on the shared k3s cluster

This overlay targets the existing production-compatible layout in namespace `platform`:

- shared CNPG PostgreSQL via `manifest-db-credentials`;
- existing runtime and recording secrets;
- Garage S3 request recordings;
- Traefik Ingress for `manifest.swopn.com`;
- UID/GID `65532`, read-only root filesystem, and `Recreate` strategy;
- GHCR images published by `.github/workflows/ghcr-main.yml`;
- native Vertex ADC through the `vertex-token-refresh` sidecar.

The manifests intentionally do **not** contain database passwords, Better Auth keys,
encryption keys, service-account JSON, or GHCR credentials.

## One-time cluster prerequisites

Create a GHCR pull secret in `platform` using a GitHub token with package read access:

```bash
kubectl -n platform create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=andreybotkin \
  --docker-password="$CR_PAT"
```

Copy the existing Vertex service-account JSON from the `alm-erp` namespace into a
platform-scoped Secret without printing it:

```bash
kubectl get secret alm-erp-vertex-sa -n alm-erp \
  -o jsonpath='{.data.vertex-sa\.json}' \
  | base64 -d > /tmp/vertex-sa.json
kubectl -n platform create secret generic manifest-vertex-credentials \
  --from-file=vertex-sa.json=/tmp/vertex-sa.json
rm -f /tmp/vertex-sa.json
```

The deployment expects the existing secrets:

```text
manifest-db-credentials
manifest-runtime
manifest-recording-credentials
```

## Publish and deploy a commit

Every push to `main` publishes:

```text
ghcr.io/andreybotkin/llm-gateway:main
ghcr.io/andreybotkin/llm-gateway:sha-<commit>
ghcr.io/andreybotkin/llm-gateway/vertex-token-refresh:main
ghcr.io/andreybotkin/llm-gateway/vertex-token-refresh:sha-<commit>
```

Prefer the immutable commit tag or digest for a production rollout. The normal
sequence is:

```bash
kubectl apply -k deploy/k3s/jobs
kubectl wait --for=condition=complete --timeout=10m \
  -l app.kubernetes.io/name=manifest-db-migrate -n platform job
kubectl wait --for=condition=complete --timeout=10m \
  -l app.kubernetes.io/name=manifest-schema-reconcile -n platform job
kubectl wait --for=condition=complete --timeout=10m \
  -l app.kubernetes.io/name=manifest-vertex-bootstrap -n platform job
kubectl apply -k deploy/k3s
kubectl rollout status deployment/manifest -n platform --timeout=10m
```

The bootstrap Job is idempotent. It creates or activates one tenant-global
`vertex / vertex_adc / default` provider and enables it for every existing agent.
It stores only an encrypted non-secret marker in `api_key_encrypted`; real Google
OAuth access tokens remain in the shared in-memory token volume and are never
stored in the database.

Before the first production cutover, export the live Deployment and database
backup according to the cluster change procedure. Do not apply the overlay while
another Manifest migration Job is running.
