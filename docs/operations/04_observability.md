# Observability

Server observability has three outputs: pretty stdout logs (not persisted locally, except SSH-managed launches at `~/.t0c/ssh-launch/<state>/server.log`), a local NDJSON trace file (always on), and optional OTLP export (traces, metrics, logs).

## Local traces and event-loop stalls

Default trace paths (`server.trace.ndjson`):

- Production / explicit `--home-dir` / `T0CODE_HOME`: `<home>/userdata/logs/server.trace.ndjson`
- Linked worktree dev run: `<worktree>/.t0c/userdata/logs/server.trace.ndjson`
- Non-worktree dev run: `~/.t0c/dev/logs/server.trace.ndjson`

Summarize counts, rates, and latency percentiles offline (even while a server is stalled or stopped):

```sh
t0c trace summary --since 30m --limit 40
# Set T0CODE_TRACE_FILE=/path/to/server.trace.ndjson for dev or copied traces
```

Logs emitted inside an active span (`Effect.log*`) attach as span events unless `T0CODE_OTLP_LOGS_URL` is configured (which exports all log records directly to avoid duplicates).

Event-loop stalls (>2 s) write `server.eventLoop.stall` spans and append to `event-loop-stalls.ndjson` beside the trace file. SQLite spans carry `db.connection` (`writer`/`reader`) and `db.lock_wait_ms` (queue wait off the event loop—subtract it before blaming query speed). Metrics live only in-process unless OTLP export is enabled.

## Local OTLP stack (Grafana LGTM)

```sh
docker run --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 --rm -ti grafana/otel-lgtm
```

Open `http://localhost:3000` (`admin`/`admin`), export OTLP URLs in the shell, and restart the server from that same shell (packaged desktop apps launched from Finder/Dock/Start Menu do not inherit shell env vars):

```sh
export T0CODE_OTLP_TRACES_URL=http://localhost:4318/v1/traces
export T0CODE_OTLP_METRICS_URL=http://localhost:4318/v1/metrics
export T0CODE_OTLP_LOGS_URL=http://localhost:4318/v1/logs
export OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=development
vp run dev
```

## OTLP configuration and kill switches

- **Endpoints:** `T0CODE_OTLP_{TRACES,METRICS,LOGS}_URL` outrank standard `OTEL_EXPORTER_OTLP_{TRACES,METRICS,LOGS}_ENDPOINT` and `OTEL_EXPORTER_OTLP_ENDPOINT`. `T0CODE_OTLP_HEADERS` / `T0CODE_OTLP_PROTOCOL` (`http/json` default) apply only to `T0CODE_OTLP_*` endpoints; `OTEL_EXPORTER_OTLP_*` endpoints read `OTEL_EXPORTER_OTLP_*` headers/protocol (`http/protobuf` default). See [user telemetry](../user/telemetry.md#export-diagnostics-to-your-own-receiver) for Settings precedence.
- **Service names are fixed:** `t0code-server` (backend), `t0code-desktop` (Electron main, traces/logs only), and `t0code-web` (UI). `OTEL_SERVICE_NAME` is ignored—distinguish installs with `OTEL_RESOURCE_ATTRIBUTES` (e.g. `deployment.environment.name=staging`).
- **Kill switches:** `T0CODE_OTEL_SDK_DISABLED` (outranks `OTEL_SDK_DISABLED`, accepts standard boolean spellings; `OTEL_SDK_DISABLED` only accepts `true`) disables all OTLP export in server and desktop while keeping local traces and stdout intact. `OTEL_{TRACES,METRICS,LOGS}_EXPORTER=none` disables a single signal unless overridden by `T0CODE_OTLP_*_URL`.
- **Trace tuning:** `T0CODE_TRACE_FILE`, `T0CODE_TRACE_MAX_BYTES`, `T0CODE_TRACE_MAX_FILES`, `T0CODE_TRACE_MIN_LEVEL`, `T0CODE_TRACE_TIMING_ENABLED`.
- **Instrumentation rules:** Trace operation boundaries via `Effect.fn("Service.operation")` (see [Effect services](../internals/02_effect-services.md)). Put high-cardinality IDs/paths on span attributes, never on metric labels.

## Heap snapshots

On macOS and Linux (not Windows), send `SIGUSR2` to the server PID from `server-runtime.json` (in the server's state dir beside `logs/`) to write `<logsDir>/server-<pid>-<timestamp>.heapsnapshot` for Chrome DevTools Memory tab:

```sh
pid="$(jq .pid "${T0CODE_HOME:-$HOME/.t3}/userdata/server-runtime.json")"
ps -p "$pid" -o command=   # verify it is the T0 Code server—never signal desktop or launcher
kill -USR2 "$pid"
```

- Writing pauses the server (up to a minute+ on large heaps) and needs roughly as much free RAM as the heap—send once, and avoid on a swapping host.
- Snapshots contain tokens, secrets, and thread content. Never share them publicly, and delete them manually when finished.
