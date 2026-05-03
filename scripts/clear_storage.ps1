$ErrorActionPreference = "Stop"

Write-Host "Removing docker volumes with stored files and DB..."
docker compose down -v

Write-Host "Done. Volumes db_data, backend_files, minio_data, chain_shared were removed."
