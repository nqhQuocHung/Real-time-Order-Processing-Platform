#!/usr/bin/env bash
set -euo pipefail

BOOTSTRAP_SERVER="${BOOTSTRAP_SERVER:-kafka:29092}"
PARTITIONS="${PARTITIONS:-3}"
REPLICATION_FACTOR="${REPLICATION_FACTOR:-1}"

TOPICS=(
  "order.lifecycle.created.v1"
  "inventory.reservation.succeeded.v1"
  "inventory.reservation.failed.v1"
  "payment.transaction.succeeded.v1"
  "payment.transaction.failed.v1"
  "order.lifecycle.completed.v1"
  "order.lifecycle.failed.v1"
  "order.lifecycle.paid.v1"

  "partner.request.created.v1"
  "partner.request.decided.v1"
)

echo "[kafka-init] Waiting for Kafka broker at ${BOOTSTRAP_SERVER}..."
for i in {1..30}; do
  if kafka-topics.sh --bootstrap-server "${BOOTSTRAP_SERVER}" --list >/dev/null 2>&1; then
    echo "[kafka-init] Kafka is ready."
    break
  fi
  echo "[kafka-init] Broker not ready yet (attempt ${i}/30)."
  sleep 2
done

for topic in "${TOPICS[@]}"; do
  kafka-topics.sh \
    --bootstrap-server "${BOOTSTRAP_SERVER}" \
    --create \
    --if-not-exists \
    --topic "${topic}" \
    --partitions "${PARTITIONS}" \
    --replication-factor "${REPLICATION_FACTOR}"

  kafka-topics.sh \
    --bootstrap-server "${BOOTSTRAP_SERVER}" \
    --create \
    --if-not-exists \
    --topic "${topic}.retry.v1" \
    --partitions "${PARTITIONS}" \
    --replication-factor "${REPLICATION_FACTOR}"

  kafka-topics.sh \
    --bootstrap-server "${BOOTSTRAP_SERVER}" \
    --create \
    --if-not-exists \
    --topic "${topic}.dlq.v1" \
    --partitions "${PARTITIONS}" \
    --replication-factor "${REPLICATION_FACTOR}"
done

echo "[kafka-init] Created/verified topics:"
kafka-topics.sh --bootstrap-server "${BOOTSTRAP_SERVER}" --list | sort
