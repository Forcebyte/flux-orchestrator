# Resource Diff Viewer & Log Aggregation

## Overview

This document describes two new debugging and observability features added to Flux Orchestrator:

1. **Resource Diff Viewer**: Compare desired vs actual state for Flux resources
2. **Log Aggregation**: Centralized multi-cluster log collection and viewing

---

## Resource Diff Viewer

### Description

The Resource Diff Viewer provides a visual comparison between the desired state (from Git/Helm) and the actual state (in the cluster) for any Flux resource. This helps quickly identify configuration drift, reconciliation issues, and resource mismatches.

### Features

- **Split View**: Side-by-side comparison of desired vs actual state
- **Unified View**: Combined diff with additions/deletions highlighted
- **Status Conditions**: Display resource conditions (Ready, Reconciling, Stalled)
- **YAML Formatting**: Clean, readable YAML output with managed fields removed
- **Syntax Highlighting**: Color-coded diff for easy identification

### Usage

#### From UI

1. Navigate to a cluster detail page
2. Find any resource (Kustomization, HelmRelease, GitRepository, etc.)
3. Click the **🔍 View Diff** button next to the resource
4. The diff viewer modal opens showing:
   - Current view toggle (Split/Unified)
   - Desired state (left/green)
   - Actual state (right/red)
   - Status conditions at the bottom

#### API Endpoints

**Get Resource Manifest:**
```http
GET /api/clusters/{clusterId}/resources/{kind}/{namespace}/{name}/manifest
```

**Get Resource Diff:**
```http
GET /api/clusters/{clusterId}/resources/{kind}/{namespace}/{name}/diff
```

Response:
```json
{
  "desired": "apiVersion: kustomize.toolkit.fluxcd.io/v1\nkind: Kustomization\n...",
  "actual": "apiVersion: kustomize.toolkit.fluxcd.io/v1\nkind: Kustomization\n...",
  "conditions": [
    {
      "type": "Ready",
      "status": "True",
      "reason": "ReconciliationSucceeded",
      "message": "Applied revision: main/abc123"
    }
  ]
}
```

### Implementation Details

**Backend (Go):**
- `k8s.Client.GetResourceManifest()`: Fetches full resource YAML using dynamic client
- `k8s.Client.GetResourceDiff()`: Retrieves both desired and actual state, includes status conditions
- Handles all Flux resource types via Group-Version-Resource (GVR) mapping

**Frontend (React):**
- `ResourceDiffViewer.tsx`: Modal component with split/unified diff views
- Uses `diff` npm package for generating line-by-line diffs
- Cleans YAML by removing managedFields and resourceVersion
- Responsive design with scrollable content areas

---

## Log Aggregation

### Description

Log Aggregation provides a centralized interface to collect, filter, and view logs from multiple pods across multiple clusters. Ideal for debugging Flux controllers and application workloads.

### Features

- **Multi-Cluster Support**: View logs from all connected clusters simultaneously
- **Namespace Filtering**: Filter by specific namespaces (e.g., flux-system)
- **Label Selector**: Target specific pods using Kubernetes label selectors
- **Log Search**: Full-text search across aggregated logs
- **Log Level Detection**: Automatically highlights ERROR, WARN, INFO, DEBUG levels
- **Auto-Refresh**: Toggle automatic log updates (10-second interval)
- **Tail Logs**: Limit to last N lines (default: 100)
- **Download Logs**: Export logs as text file for offline analysis
- **Dark Terminal Theme**: Easy-to-read monospace font with syntax highlighting

### Usage

#### From UI

1. Navigate to **Logs** page from the main menu (or `/logs` route)
2. Configure filters:
   - **Clusters**: Select one or more clusters (default: all)
   - **Namespaces**: Comma-separated namespaces (default: flux-system)
   - **Label Selector**: K8s label query (e.g., `app=controller`)
   - **Tail Lines**: Number of recent lines to show (default: 100)
3. Click **Fetch Logs** to retrieve logs
4. Use the search box to filter log lines
5. Enable **Auto-refresh** for live updates
6. Click **Download Logs** to save as text file

#### API Endpoint

**Get Aggregated Logs:**
```http
POST /api/logs/aggregated

{
  "cluster_ids": ["cluster-1", "cluster-2"],
  "namespaces": ["flux-system", "default"],
  "label_selector": "app=source-controller",
  "tail_lines": 100
}
```

Response:
```json
{
  "logs": [
    {
      "cluster_id": "cluster-1",
      "cluster_name": "production",
      "pod_name": "source-controller-7d6c9d4f8-abc12",
      "namespace": "flux-system",
      "container": "manager",
      "timestamp": "2025-01-15T10:30:45Z",
      "message": "INFO: Successfully fetched artifact"
    }
  ]
}
```

### Implementation Details

**Backend (Go):**
- `k8s.Client.GetAggregatedLogs()`: Collects logs from multiple clusters/pods
- Filters pods by namespace and label selector using typed clientset
- Retrieves container logs via PodLogOptions with tail support
- Returns structured `AggregatedLogEntry` with cluster context

**Frontend (React):**
- `LogAggregation.tsx`: Full-page log viewer component
- Real-time filtering with JavaScript array methods
- Log level detection using regex patterns
- Auto-refresh using setInterval with cleanup
- Download functionality using Blob API and data URLs
- Responsive grid layout for filters and log display

---

## Common Use Cases

### Debugging Reconciliation Failures

1. Go to cluster detail page
2. Find the failing Kustomization/HelmRelease
3. Click **View Diff** to see configuration drift
4. Navigate to **Logs** page
5. Filter by `flux-system` namespace
6. Search for the resource name to see reconciliation errors

### Monitoring Controller Health

1. Open **Logs** page
2. Set namespace to `flux-system`
3. Use label selectors:
   - `app=source-controller` - Git/Helm source logs
   - `app=kustomize-controller` - Kustomization logs
   - `app=helm-controller` - HelmRelease logs
4. Enable **Auto-refresh** for live monitoring
5. Watch for ERROR/WARN level messages

### Investigating Multi-Cluster Issues

1. Select multiple clusters in **Logs** page
2. Use same namespace/label filters across clusters
3. Compare log outputs to identify cluster-specific issues
4. Download logs for offline analysis

---

## Security Considerations

### RBAC Integration

Both features respect RBAC permissions:

- **Diff Viewer**: Requires `resources.read` permission
- **Log Aggregation**: Requires `logs.read` permission

Users without proper permissions will receive 403 Forbidden errors.

### Sensitive Data

- Logs may contain sensitive information (secrets, credentials)
- Diff viewer shows full resource specs (may include secret references)
- Ensure proper RBAC configuration to restrict access
- Consider implementing log redaction for sensitive patterns

---

## Troubleshooting

### Diff Viewer Shows "No Differences"

- Resource may be perfectly reconciled
- Check if resource exists in cluster (actual state should not be empty)
- Verify Flux has successfully applied the resource

### Diff Viewer Modal Won't Open

- Check browser console for JavaScript errors
- Verify cluster is connected and healthy
- Ensure resource kind/namespace/name are correct

### Log Aggregation Returns Empty Results

- Verify namespace exists in selected clusters
- Check label selector syntax (use `kubectl get pods -l <selector>` to test)
- Ensure pods are running (logs only available from active pods)
- Increase tail_lines if logs are too old

### Logs Not Auto-Refreshing

- Check if Auto-refresh toggle is enabled
- Verify browser tab is active (some browsers throttle background tabs)
- Look for API errors in browser console
- Ensure backend API is responsive

---

## Performance Considerations

### Resource Diff Viewer

- Diff generation is lightweight (single resource fetch)
- No performance impact on cluster operations
- Modal is lazy-loaded (only fetches data when opened)

### Log Aggregation

- **Multi-cluster queries can be expensive**: Limit clusters when possible
- **Tail lines impacts performance**: Start with 100 lines, increase if needed
- **Auto-refresh adds load**: Use sparingly on production clusters
- **Label selectors reduce load**: Target specific pods instead of all pods

**Recommendations:**
- Start with single cluster + specific namespace
- Use label selectors to limit pod count
- Set reasonable tail_lines (100-500)
- Disable auto-refresh when not actively monitoring

---

## Future Enhancements

### Planned Features

- **Diff History**: View historical diffs to track changes over time
- **Diff Export**: Download diff as patch file
- **Log Streaming**: WebSocket-based real-time log streaming
- **Log Filters**: Pre-built filters for common log patterns
- **Log Alerts**: Configure alerts for specific log patterns
- **Syntax Highlighting**: Better YAML/JSON diff highlighting

### Integration Ideas

- Link from diff viewer to logs for same resource
- Show recent logs in resource detail pages
- Diff viewer in dashboard for at-a-glance status
- Log aggregation widget in dashboard

---

## Related Documentation

- [RBAC Documentation](./RBAC.md) - Permission requirements
- [Architecture](./ARCHITECTURE.md) - System design
- [Development Guide](./DEVELOPMENT.md) - Contributing guidelines
- [API Documentation](../docs/swagger.yaml) - OpenAPI specification

---

## Support

For issues or questions:
1. Check this documentation first
2. Review related documentation links above
3. Check GitHub issues: https://github.com/forcebyte/flux-orchestrator/issues
4. Open a new issue with detailed reproduction steps
