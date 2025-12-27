import React, { useState, useEffect } from 'react';
import { activityApi } from '../api';
import { Activity } from '../types';
import '../styles/ActivityFeed.css';

interface ActivityFeedProps {
  clusterId?: string;
  limit?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ clusterId, limit = 50 }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();
  }, [clusterId, limit]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await activityApi.list({ limit, cluster_id: clusterId });
      setActivities(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      'reconcile': '🔄',
      'suspend': '⏸️',
      'resume': '▶️',
      'create': '➕',
      'delete': '🗑️',
      'update': '✏️',
      'export': '📥',
      'toggle_favorite': '⭐',
      'sync': '🔄',
    };
    return icons[action] || '📝';
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="activity-feed-loading">Loading activity feed...</div>;
  }

  if (error) {
    return <div className="activity-feed-error">{error}</div>;
  }

  if (activities.length === 0) {
    return <div className="activity-feed-empty">No recent activity</div>;
  }

  return (
    <div className="activity-feed">
      <h3>Recent Activity</h3>
      <div className="activity-list">
        {activities.map((activity) => (
          <div 
            key={activity.id} 
            className={`activity-item activity-${activity.status}`}
          >
            <div className="activity-icon">{getActionIcon(activity.action)}</div>
            <div className="activity-content">
              <div className="activity-header">
                <span className="activity-action">{activity.action}</span>
                <span className="activity-resource-type">{activity.resource_type}</span>
                <span className="activity-time">{formatTimestamp(activity.created_at)}</span>
              </div>
              <div className="activity-details">
                <strong>{activity.resource_name}</strong>
                {activity.cluster_name && (
                  <span className="activity-cluster"> in {activity.cluster_name}</span>
                )}
              </div>
              {activity.message && (
                <div className="activity-message">{activity.message}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;
