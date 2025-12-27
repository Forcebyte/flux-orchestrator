import React, { useState, useEffect } from 'react';
import { FluxResource } from '../types';
import '../styles/FluxResourceEditDialog.css';

interface FluxResourceEditDialogProps {
  resource: FluxResource;
  onClose: () => void;
  onSave: (updates: any) => Promise<void>;
}

const FluxResourceEditDialog: React.FC<FluxResourceEditDialogProps> = ({ resource, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    // Parse metadata to get current spec
    try {
      const metadata = resource.metadata ? JSON.parse(resource.metadata) : {};
      const spec = metadata.spec || {};
      
      // Initialize form based on resource kind
      if (resource.kind === 'GitRepository') {
        setFormData({
          url: spec.url || '',
          ref_branch: spec.ref?.branch || '',
          ref_tag: spec.ref?.tag || '',
          ref_semver: spec.ref?.semver || '',
          interval: spec.interval || '1m',
        });
      } else if (resource.kind === 'Kustomization') {
        setFormData({
          path: spec.path || './',
          prune: spec.prune !== undefined ? spec.prune : true,
          interval: spec.interval || '10m',
          sourceRef_name: spec.sourceRef?.name || '',
          sourceRef_namespace: spec.sourceRef?.namespace || resource.namespace,
        });
      } else if (resource.kind === 'HelmRelease') {
        setFormData({
          chart: spec.chart?.spec?.chart || '',
          version: spec.chart?.spec?.version || '',
          interval: spec.interval || '5m',
          sourceRef_name: spec.chart?.spec?.sourceRef?.name || '',
          sourceRef_namespace: spec.chart?.spec?.sourceRef?.namespace || resource.namespace,
          values: spec.values ? JSON.stringify(spec.values, null, 2) : '',
        });
      } else if (resource.kind === 'HelmRepository') {
        setFormData({
          url: spec.url || '',
          interval: spec.interval || '10m',
        });
      }
    } catch (err) {
      console.error('Failed to parse resource metadata:', err);
      setError('Failed to parse resource configuration');
    }
  }, [resource]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Build the patch based on resource kind
      const patch: any = { spec: {} };

      if (resource.kind === 'GitRepository') {
        patch.spec.url = formData.url;
        patch.spec.interval = formData.interval;
        patch.spec.ref = {};
        if (formData.ref_branch) patch.spec.ref.branch = formData.ref_branch;
        if (formData.ref_tag) patch.spec.ref.tag = formData.ref_tag;
        if (formData.ref_semver) patch.spec.ref.semver = formData.ref_semver;
      } else if (resource.kind === 'Kustomization') {
        patch.spec.path = formData.path;
        patch.spec.prune = formData.prune;
        patch.spec.interval = formData.interval;
        patch.spec.sourceRef = {
          kind: 'GitRepository',
          name: formData.sourceRef_name,
          namespace: formData.sourceRef_namespace,
        };
      } else if (resource.kind === 'HelmRelease') {
        patch.spec.interval = formData.interval;
        patch.spec.chart = {
          spec: {
            chart: formData.chart,
            version: formData.version,
            sourceRef: {
              kind: 'HelmRepository',
              name: formData.sourceRef_name,
              namespace: formData.sourceRef_namespace,
            },
          },
        };
        if (formData.values) {
          try {
            patch.spec.values = JSON.parse(formData.values);
          } catch (err) {
            setError('Invalid JSON in values field');
            return;
          }
        }
      } else if (resource.kind === 'HelmRepository') {
        patch.spec.url = formData.url;
        patch.spec.interval = formData.interval;
      }

      await onSave(patch);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update resource');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Edit {resource.kind}</h3>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="dialog-error">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="dialog-body">
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={resource.name} disabled className="form-control-disabled" />
            </div>

            <div className="form-group">
              <label>Namespace</label>
              <input type="text" value={resource.namespace} disabled className="form-control-disabled" />
            </div>

            {resource.kind === 'GitRepository' && (
              <>
                <div className="form-group">
                  <label>Repository URL *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.url || ''}
                    onChange={(e) => handleChange('url', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Branch</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.ref_branch || ''}
                    onChange={(e) => handleChange('ref_branch', e.target.value)}
                    placeholder="main"
                  />
                </div>

                <div className="form-group">
                  <label>Tag (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.ref_tag || ''}
                    onChange={(e) => handleChange('ref_tag', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Semver (optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.ref_semver || ''}
                    onChange={(e) => handleChange('ref_semver', e.target.value)}
                    placeholder=">=1.0.0"
                  />
                </div>

                <div className="form-group">
                  <label>Sync Interval *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.interval || ''}
                    onChange={(e) => handleChange('interval', e.target.value)}
                    placeholder="1m"
                    required
                  />
                  <small className="form-hint">e.g., 1m, 5m, 1h</small>
                </div>
              </>
            )}

            {resource.kind === 'Kustomization' && (
              <>
                <div className="form-group">
                  <label>Path *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.path || ''}
                    onChange={(e) => handleChange('path', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Source Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.sourceRef_name || ''}
                    onChange={(e) => handleChange('sourceRef_name', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Source Namespace</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.sourceRef_namespace || ''}
                    onChange={(e) => handleChange('sourceRef_namespace', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.prune || false}
                      onChange={(e) => handleChange('prune', e.target.checked)}
                    />
                    {' '}Prune resources
                  </label>
                </div>

                <div className="form-group">
                  <label>Sync Interval *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.interval || ''}
                    onChange={(e) => handleChange('interval', e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {resource.kind === 'HelmRelease' && (
              <>
                <div className="form-group">
                  <label>Chart Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.chart || ''}
                    onChange={(e) => handleChange('chart', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Chart Version</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.version || ''}
                    onChange={(e) => handleChange('version', e.target.value)}
                    placeholder="latest"
                  />
                </div>

                <div className="form-group">
                  <label>Helm Repository Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.sourceRef_name || ''}
                    onChange={(e) => handleChange('sourceRef_name', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Repository Namespace</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.sourceRef_namespace || ''}
                    onChange={(e) => handleChange('sourceRef_namespace', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Values (YAML/JSON)</label>
                  <textarea
                    className="form-control"
                    rows={8}
                    value={formData.values || ''}
                    onChange={(e) => handleChange('values', e.target.value)}
                    placeholder='{\n  "key": "value"\n}'
                  />
                </div>

                <div className="form-group">
                  <label>Sync Interval *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.interval || ''}
                    onChange={(e) => handleChange('interval', e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {resource.kind === 'HelmRepository' && (
              <>
                <div className="form-group">
                  <label>Repository URL *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.url || ''}
                    onChange={(e) => handleChange('url', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Sync Interval *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.interval || ''}
                    onChange={(e) => handleChange('interval', e.target.value)}
                    required
                  />
                </div>
              </>
            )}
          </div>

          <div className="dialog-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FluxResourceEditDialog;
